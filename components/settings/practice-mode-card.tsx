"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ClockIcon } from "lucide-react"
import { toast } from "sonner"

import { setPracticeMode } from "@/app/(app)/settings/actions"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"

/**
 * Modo práctica: pausa la analítica de operación para que las pruebas del
 * equipo no contaminen los tiempos ni la fricción de los reportes.
 *
 * No afecta ventas, pagos, inventario ni caja: solo deja de registrar eventos.
 */
export function PracticeModeCard({
  active,
  expired,
  until,
  canManage,
}: {
  active: boolean
  /** La ventana de 48 h terminó y el aviso aún no se confirmó. */
  expired: boolean
  /** Fin automático de la ventana de 48 h; `null` = manual. */
  until: string | null
  canManage: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()

  const update = (next: boolean) => {
    if (!canManage) return

    startTransition(async () => {
      const result = await setPracticeMode(next)

      if (!result.ok) {
        toast.error(result.message ?? "No se pudo actualizar el modo práctica")
        return
      }

      toast.success(
        next ? "Modo práctica activado" : "Modo práctica desactivado"
      )
      router.refresh()
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Modo práctica</CardTitle>
        <CardDescription>
          Capacita al equipo sin que las pruebas cuenten en los reportes de
          operación.
        </CardDescription>
        <CardAction>
          {active ? (
            <Badge variant="secondary">Activo</Badge>
          ) : expired ? (
            <Badge variant="outline">Expirado</Badge>
          ) : (
            <Badge variant="outline">Inactivo</Badge>
          )}
        </CardAction>
      </CardHeader>
      <CardContent className="gap-4">
        <div className="flex items-start justify-between gap-4 rounded-lg border border-border/60 p-3">
          <div className="flex items-start gap-3">
            <ClockIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div className="flex flex-col gap-1 text-sm">
              <span className="font-medium">
                {active
                  ? until
                    ? `Se desactiva automáticamente el ${formatDate(until)}`
                    : "Activo hasta que lo desactives"
                  : expired && until
                    ? `Terminó el ${formatDate(until)}`
                    : "Los pedidos se están midiendo"}
              </span>
              <span className="text-muted-foreground">
                {active
                  ? "Mientras esté activo no se guardan tiempos de captura, búsquedas ni fricción del catálogo."
                  : "Actívalo para capacitar al equipo y desactívalo al terminar."}
              </span>
            </div>
          </div>
          <Switch
            checked={active}
            onCheckedChange={update}
            disabled={!canManage || pending}
            aria-label="Activar modo práctica"
          />
        </div>

        <p className="text-xs text-muted-foreground">
          Solo pausa la analítica de operación. Las ventas, pagos, caja e
          inventario se registran normal. Al activarlo dura 48 horas; un
          administrador puede desactivarlo antes.
        </p>
      </CardContent>
    </Card>
  )
}

function formatDate(value: string): string {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}
