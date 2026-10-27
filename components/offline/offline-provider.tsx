"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { formatMoney } from "@/lib/catalog"
import {
  deleteQueuedRound,
  listQueuedRounds,
  putQueuedRound,
} from "@/lib/offline/db"
import type { QueuedRound, QueuedRoundItem } from "@/lib/offline/types"
import { createOrder, sendRound } from "@/lib/order-actions"
import type { ActionResult } from "@/lib/server-api"

export interface EnqueueRoundInput {
  /** Cuenta ya abierta en el servidor (si se conocía al encolar). */
  orderId?: string
  tableNumber?: string
  isTakeaway: boolean
  items: QueuedRoundItem[]
  /** Total estimado en el dispositivo; el servidor recalcula el definitivo. */
  total: number
  label: string
  /**
   * Claves ya usadas en un intento online que falló por red. Reutilizarlas
   * evita duplicar la cuenta o la ronda si el servidor sí llegó a procesarlas.
   */
  orderIdempotencyKey?: string
  roundIdempotencyKey?: string
}

interface OfflineSyncValue {
  isOnline: boolean
  operations: QueuedRound[]
  syncing: boolean
  pendingCount: number
  errorCount: number
  enqueueRound: (input: EnqueueRoundInput) => Promise<QueuedRound>
  syncNow: () => Promise<void>
  retryOperation: (id: string) => Promise<void>
  discardOperation: (id: string) => Promise<void>
}

const OfflineSyncContext = React.createContext<OfflineSyncValue | null>(null)

export function useOfflineSync(): OfflineSyncValue {
  const value = React.useContext(OfflineSyncContext)

  if (!value) {
    throw new Error("useOfflineSync debe usarse dentro de <OfflineProvider>")
  }

  return value
}

function newKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }

  return `op-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

/** Conectividad del navegador, sin setState dentro de un efecto. */
function subscribeToConnectivity(onChange: () => void) {
  window.addEventListener("online", onChange)
  window.addEventListener("offline", onChange)

  return () => {
    window.removeEventListener("online", onChange)
    window.removeEventListener("offline", onChange)
  }
}

const readOnline = () => navigator.onLine
// En el servidor y en la hidratación inicial se asume conexión: el primer
// valor real llega del navegador después de montar.
const readOnlineOnServer = () => true

type OperationOutcome = "done" | "offline" | "error"

export function OfflineProvider({
  userId,
  children,
}: {
  userId: string
  children: React.ReactNode
}) {
  const router = useRouter()
  const isOnline = React.useSyncExternalStore(
    subscribeToConnectivity,
    readOnline,
    readOnlineOnServer
  )

  const [operations, setOperations] = React.useState<QueuedRound[]>([])
  const [syncing, setSyncing] = React.useState(false)
  const syncingRef = React.useRef(false)

  const refresh = React.useCallback(async () => {
    const rows = await listQueuedRounds(userId)
    setOperations(rows.sort((a, b) => a.createdAt - b.createdAt))
  }, [userId])

  const persist = React.useCallback(
    async (operation: QueuedRound) => {
      await putQueuedRound(operation)
      await refresh()
    },
    [refresh]
  )

  const fail = React.useCallback(
    async (
      operation: QueuedRound,
      result: ActionResult<unknown>
    ): Promise<OperationOutcome> => {
      // Un fallo de red no es un rechazo del servidor: se reintenta solo.
      if (result.network) {
        await persist({
          ...operation,
          status: "queued",
          lastError: result.message,
          updatedAt: Date.now(),
        })
        return "offline"
      }

      const message = result.message ?? "La operación fue rechazada."
      await persist({
        ...operation,
        status: "error",
        lastError: message,
        updatedAt: Date.now(),
      })

      toast.error("Una comanda no se pudo sincronizar", { description: message })
      return "error"
    },
    [persist]
  )

  const runOperation = React.useCallback(
    async (operation: QueuedRound): Promise<OperationOutcome> => {
      const attempt: QueuedRound = {
        ...operation,
        status: "syncing",
        attempts: operation.attempts + 1,
        updatedAt: Date.now(),
      }

      await persist(attempt)

      try {
        let orderId = attempt.orderId

        if (!orderId) {
          const created = await createOrder({
            tableNumber: attempt.order.tableNumber,
            isTakeaway: attempt.order.isTakeaway,
            idempotencyKey: attempt.order.idempotencyKey,
          })

          if (!created.ok || !created.data) {
            return await fail(attempt, created)
          }

          orderId = created.data.id
          await persist({ ...attempt, orderId })
        }

        const sent = await sendRound(orderId, {
          items: attempt.round.items,
          idempotencyKey: attempt.round.idempotencyKey,
        })

        if (!sent.ok) {
          return await fail(attempt, sent)
        }

        await deleteQueuedRound(attempt.id)
        await refresh()

        toast.success(`Ronda sincronizada · ${formatMoney(attempt.total)}`, {
          description: attempt.label,
        })

        // Cocina ya la recibió: refresca los datos del servidor.
        router.refresh()
        return "done"
      } catch {
        await persist({
          ...attempt,
          status: "queued",
          lastError: "No se pudo contactar con la API.",
          updatedAt: Date.now(),
        })
        return "offline"
      }
    },
    [fail, persist, refresh, router]
  )

  const flush = React.useCallback(async () => {
    if (syncingRef.current) return
    if (!navigator.onLine) return

    syncingRef.current = true
    setSyncing(true)

    try {
      const queue = await listQueuedRounds(userId)
      // Los errores requieren intervención manual: no se reintentan solos.
      const pending = queue
        .filter((operation) => operation.status !== "error")
        .sort((a, b) => a.createdAt - b.createdAt)

      for (const operation of pending) {
        const outcome = await runOperation(operation)
        if (outcome === "offline") break
      }
    } finally {
      syncingRef.current = false
      setSyncing(false)
      await refresh()
    }
  }, [refresh, runOperation, userId])

  // Carga inicial de la cola y registro del service worker.
  React.useEffect(() => {
    // Diferido para no actualizar estado durante el efecto de montaje.
    const initial = window.setTimeout(() => {
      void refresh()
    }, 0)

    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .catch(() => {
          // Sin service worker la app sigue funcionando; solo pierde el
          // arranque offline.
        })
    }

    return () => window.clearTimeout(initial)
  }, [refresh])

  // Al recuperar la conexión se sincroniza lo pendiente.
  React.useEffect(() => {
    if (!isOnline) return

    const timer = window.setTimeout(() => {
      void flush()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [flush, isOnline])

  // Reintento periódico mientras haya pendientes y conexión.
  React.useEffect(() => {
    if (!isOnline || operations.length === 0) return

    const timer = window.setInterval(() => {
      void flush()
    }, 20000)

    return () => window.clearInterval(timer)
  }, [flush, isOnline, operations.length])

  const enqueueRound = React.useCallback(
    async (input: EnqueueRoundInput): Promise<QueuedRound> => {
      const now = Date.now()
      const operation: QueuedRound = {
        id: newKey(),
        userId,
        kind: "round",
        status: "queued",
        createdAt: now,
        updatedAt: now,
        attempts: 0,
        label: input.label,
        total: input.total,
        orderId: input.orderId,
        order: {
          tableNumber: input.tableNumber?.trim() || undefined,
          isTakeaway: input.isTakeaway,
          idempotencyKey: input.orderIdempotencyKey ?? newKey(),
        },
        round: {
          items: input.items,
          idempotencyKey: input.roundIdempotencyKey ?? newKey(),
        },
      }

      await persist(operation)
      return operation
    },
    [persist, userId]
  )

  const retryOperation = React.useCallback(
    async (id: string) => {
      const queue = await listQueuedRounds(userId)
      const operation = queue.find((candidate) => candidate.id === id)
      if (!operation) return

      await persist({
        ...operation,
        status: "queued",
        lastError: undefined,
        updatedAt: Date.now(),
      })
      await flush()
    },
    [flush, persist, userId]
  )

  const discardOperation = React.useCallback(
    async (id: string) => {
      await deleteQueuedRound(id)
      await refresh()
    },
    [refresh]
  )

  const pendingCount = operations.length
  const errorCount = operations.filter(
    (operation) => operation.status === "error"
  ).length

  const value = React.useMemo<OfflineSyncValue>(
    () => ({
      isOnline,
      operations,
      syncing,
      pendingCount,
      errorCount,
      enqueueRound,
      syncNow: flush,
      retryOperation,
      discardOperation,
    }),
    [
      discardOperation,
      enqueueRound,
      errorCount,
      flush,
      isOnline,
      operations,
      pendingCount,
      retryOperation,
      syncing,
    ]
  )

  return (
    <OfflineSyncContext.Provider value={value}>
      {children}
    </OfflineSyncContext.Provider>
  )
}
