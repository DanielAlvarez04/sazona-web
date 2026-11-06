"use client"

import { useCallback, useSyncExternalStore } from "react"

interface ColumnsStore {
  value: number | null
  listeners: Set<() => void>
}

const stores = new Map<string, ColumnsStore>()

function getStore(storageKey: string): ColumnsStore {
  const existing = stores.get(storageKey)
  if (existing) return existing

  const store: ColumnsStore = { value: null, listeners: new Set() }
  stores.set(storageKey, store)
  return store
}

function readNumber(storageKey: string, fallback: number): number {
  if (typeof window === "undefined") return fallback

  try {
    const stored = window.localStorage.getItem(storageKey)
    if (stored === null) return fallback

    const parsed = Number(stored)
    if (Number.isInteger(parsed) && parsed > 0) return parsed
  } catch {
    // Sin `localStorage` (modo privado) se usa el valor por defecto.
  }

  return fallback
}

/**
 * Número de columnas de la vista de tarjetas, persistido en `localStorage`.
 *
 * Se guarda por página (`catalog-card-columns`, `menus-card-columns`) para que
 * el tamaño elegido sobreviva a recargas y cambios de ruta. El valor leído se
 * acota al rango vigente del control para no quedar fuera de los límites si el
 * rango cambia entre páginas.
 */
export function usePersistentCardColumns(
  storageKey: string | null,
  fallback: number,
  min: number,
  max: number
) {
  const clamp = useCallback(
    (value: number) => Math.min(max, Math.max(min, value)),
    [min, max]
  )

  const getSnapshot = useCallback(() => {
    if (!storageKey) return fallback

    const store = getStore(storageKey)
    const current = store.value ?? readNumber(storageKey, fallback)
    if (store.value === null) store.value = current

    return current
  }, [storageKey, fallback])

  const getServerSnapshot = useCallback(() => fallback, [fallback])

  const subscribe = useCallback(
    (listener: () => void) => {
      if (!storageKey) return () => {}

      const store = getStore(storageKey)
      store.listeners.add(listener)

      const onStorage = (event: StorageEvent) => {
        if (event.key !== null && event.key !== storageKey) return

        store.value = readNumber(storageKey, fallback)
        for (const notify of store.listeners) notify()
      }

      window.addEventListener("storage", onStorage)

      return () => {
        store.listeners.delete(listener)
        window.removeEventListener("storage", onStorage)
      }
    },
    [storageKey, fallback]
  )

  const stored = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  )

  const setColumns = useCallback(
    (next: number | ((current: number) => number)) => {
      if (!storageKey) return

      const store = getStore(storageKey)
      const current = clamp(store.value ?? readNumber(storageKey, fallback))
      const resolved = clamp(
        typeof next === "function" ? next(current) : next
      )

      if (resolved === current && store.value !== null) return

      store.value = resolved

      try {
        window.localStorage.setItem(storageKey, String(resolved))
      } catch {
        // Sin persistencia disponible: el tamaño solo dura esta sesión.
      }

      for (const notify of store.listeners) notify()
    },
    [storageKey, fallback, clamp]
  )

  return [clamp(stored), setColumns] as const
}
