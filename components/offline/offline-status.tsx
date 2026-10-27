"use client"

import { Loader2Icon, RefreshCwIcon, WifiOffIcon } from "lucide-react"

import { useOfflineSync } from "@/components/offline/offline-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

/**
 * Indicador global de conectividad y de la cola offline (plan.md §7.1).
 * Solo aparece cuando hay algo que contar: sin conexión o con pendientes.
 */
export function OfflineStatus() {
  const { isOnline, pendingCount, errorCount, syncing, syncNow } =
    useOfflineSync()

  if (isOnline && pendingCount === 0) {
    return null
  }

  return (
    <div className="ml-auto flex items-center gap-2">
      {!isOnline ? (
        <Badge
          variant="outline"
          className="border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300"
        >
          <WifiOffIcon data-icon="inline-start" />
          Sin conexión
        </Badge>
      ) : null}

      {pendingCount > 0 ? (
        <Button
          type="button"
          variant={errorCount > 0 ? "destructive" : "outline"}
          size="sm"
          disabled={!isOnline || syncing}
          onClick={() => void syncNow()}
          title={
            isOnline
              ? "Enviar las comandas pendientes"
              : "Se enviarán cuando vuelva la conexión"
          }
        >
          {syncing ? (
            <Loader2Icon className="animate-spin" />
          ) : (
            <RefreshCwIcon />
          )}
          {errorCount > 0
            ? `${errorCount} con error`
            : `${pendingCount} pendiente${pendingCount === 1 ? "" : "s"}`}
        </Button>
      ) : null}
    </div>
  )
}
