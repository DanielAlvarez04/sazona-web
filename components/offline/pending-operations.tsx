"use client"

import {
  CircleAlertIcon,
  CloudUploadIcon,
  Loader2Icon,
  RefreshCwIcon,
  Trash2Icon,
} from "lucide-react"

import { useOfflineSync } from "@/components/offline/offline-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatMoney } from "@/lib/catalog"
import { QUEUED_STATUS_LABELS, type QueuedRound } from "@/lib/offline/types"
import { cn } from "cn"

function statusVariant(status: QueuedRound["status"]) {
  if (status === "error") return "destructive" as const
  if (status === "syncing") return "default" as const
  return "secondary" as const
}

/**
 * Comandas guardadas en el dispositivo (plan.md §7.1).
 *
 * Deja claro que cocina **no** las ha recibido hasta que el servidor confirma
 * el envío: aquí nunca se usa la palabra "enviada" para una operación local.
 */
export function PendingOperations() {
  const { operations, isOnline, syncing, syncNow, retryOperation, discardOperation } =
    useOfflineSync()

  if (operations.length === 0) return null

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-dashed border-amber-500/50 bg-amber-500/5 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-medium">
          <CloudUploadIcon className="size-4" />
          Guardadas en este dispositivo
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!isOnline || syncing}
          onClick={() => void syncNow()}
        >
          {syncing ? <Loader2Icon className="animate-spin" /> : <RefreshCwIcon />}
          Sincronizar
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        {isOnline
          ? "Se envían al servidor y, solo cuando la API confirma, aparecen en cocina."
          : "Sin conexión: cocina no las recibirá hasta que vuelvas a estar en línea."}
      </p>

      <ul className="flex flex-col gap-2">
        {operations.map((operation) => (
          <li
            key={operation.id}
            className="flex flex-col gap-1 rounded-md border border-border/60 bg-background/70 p-2"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{operation.label}</p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {formatMoney(operation.total)} · {operation.attempts}{" "}
                  {operation.attempts === 1 ? "intento" : "intentos"}
                </p>
              </div>
              <Badge variant={statusVariant(operation.status)}>
                {QUEUED_STATUS_LABELS[operation.status]}
              </Badge>
            </div>

            {operation.lastError ? (
              <p
                className={cn(
                  "flex items-start gap-1 text-xs",
                  operation.status === "error"
                    ? "text-destructive"
                    : "text-muted-foreground"
                )}
              >
                <CircleAlertIcon className="mt-0.5 size-3 shrink-0" />
                {operation.lastError}
              </p>
            ) : null}

            <div className="flex gap-2">
              {operation.status === "error" ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!isOnline || syncing}
                  onClick={() => void retryOperation(operation.id)}
                >
                  <RefreshCwIcon />
                  Reintentar
                </Button>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={syncing}
                onClick={() => void discardOperation(operation.id)}
              >
                <Trash2Icon />
                Descartar
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
