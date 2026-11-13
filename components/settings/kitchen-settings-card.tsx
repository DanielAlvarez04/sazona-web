"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  ChartNoAxesColumnIcon,
  ClockIcon,
  HistoryIcon,
  Loader2Icon,
  SaveIcon,
} from "lucide-react"
import { toast } from "sonner"

import { updateKitchenSettings } from "@/app/(app)/settings/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { useActionForm } from "@/hooks/use-action-form"
import { sameNumber } from "@/lib/diff"
import type { KitchenSettings } from "@/lib/kitchen"

/**
 * Tiempo de preparación del negocio.
 *
 * El manual es el respaldo de los artículos sin tiempo propio. El histórico
 * usa la mediana real de `inicio → lista` y solo se habilita cuando hay
 * suficientes muestras o días de operación.
 */
export function KitchenPrepCard({
  settings,
  canManage,
}: {
  settings: KitchenSettings
  canManage: boolean
}) {
  const router = useRouter()
  const { pending, error, run } = useActionForm(() => router.refresh())
  const [value, setValue] = useState(String(settings.prepMinutes))

  const minutes = Number(value)
  const valid =
    Number.isInteger(minutes) && minutes >= 5 && minutes <= 180
  const historical = settings.historical
  const canUseHistorical =
    historical.available && historical.averageMinutes !== null

  const saveManual = () => {
    if (!valid) {
      toast.error("El tiempo debe ser un entero entre 5 y 180 minutos")
      return
    }

    if (sameNumber(minutes, settings.prepMinutes)) {
      toast.info("Sin cambios")
      return
    }

    run(() => updateKitchenSettings({ prepMinutes: minutes }))
  }

  const setSource = (useHistorical: boolean) => {
    const source = useHistorical ? "HISTORICAL" : "MANUAL"

    if (source === settings.source) return

    run(() => updateKitchenSettings({ source }))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClockIcon className="size-4" />
          Tiempo de preparación
        </CardTitle>
        <CardDescription>
          Es el respaldo de los artículos que no tienen un tiempo propio y la
          base para estimar cuándo estará lista una ronda.
        </CardDescription>
        <CardAction>
          <Badge variant={settings.usingHistorical ? "secondary" : "outline"}>
            {settings.usingHistorical
              ? `Histórico · ${settings.effectiveMinutes} min`
              : `Manual · ${settings.effectiveMinutes} min`}
          </Badge>
        </CardAction>
      </CardHeader>

      <CardContent className="gap-4">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            saveManual()
          }}
        >
          <Field className="max-w-44">
            <FieldLabel htmlFor="kitchen-prep-minutes">
              Tiempo manual (min)
            </FieldLabel>
            <Input
              id="kitchen-prep-minutes"
              type="number"
              min="5"
              max="180"
              step="1"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              disabled={!canManage || pending}
              required
            />
            <FieldDescription>
              Entre 5 y 180 minutos. Por defecto, 15.
            </FieldDescription>
          </Field>

          {canManage ? (
            <Button type="submit" disabled={pending || !valid}>
              {pending ? <Loader2Icon className="animate-spin" /> : <SaveIcon />}
              Guardar tiempo
            </Button>
          ) : null}
        </form>

        <div className="flex flex-col gap-3 rounded-lg border border-border/60 p-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <HistoryIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Usar el promedio real</span>
                <span className="text-muted-foreground">
                  {canUseHistorical
                    ? `Mediana real de ${historical.averageMinutes} min en los últimos ${historical.windowDays} días.`
                    : "Todavía no hay datos suficientes para usar el promedio real."}
                </span>
              </div>
            </div>
            <Switch
              checked={settings.source === "HISTORICAL"}
              onCheckedChange={setSource}
              disabled={!canManage || pending || !canUseHistorical}
              aria-label="Usar el promedio histórico de preparación"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="gap-1 tabular-nums">
              <ChartNoAxesColumnIcon className="size-3" />
              {historical.samples} / {historical.minRounds} rondas
            </Badge>
            <Badge variant="outline" className="tabular-nums">
              {historical.days} / {historical.minDays} días
            </Badge>
            {historical.available ? (
              <Badge variant="secondary">Calibración completa</Badge>
            ) : (
              <span>
                Se habilita con {historical.minRounds} rondas o{" "}
                {historical.minDays} días, lo que ocurra primero.
              </span>
            )}
          </div>

          {settings.source === "HISTORICAL" && !canUseHistorical ? (
            <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
              Elegiste el promedio histórico, pero aún no hay datos
              suficientes: se está usando el tiempo manual.
            </p>
          ) : null}
        </div>

        {!canManage ? (
          <p className="text-xs text-muted-foreground">
            Solo administración puede cambiar los tiempos de preparación.
          </p>
        ) : null}

        {error ? <FieldError>{error}</FieldError> : null}
      </CardContent>
    </Card>
  )
}

/**
 * Orden de la cola de cocina: urgencia (tiempo / estimado) o llegada.
 */
export function KitchenOrderCard({
  settings,
  canManage,
}: {
  settings: KitchenSettings
  canManage: boolean
}) {
  const router = useRouter()
  const { pending, error, run } = useActionForm(() => router.refresh())

  const toggle = (enabled: boolean) => {
    if (enabled === settings.suggestOrder) return

    run(() => updateKitchenSettings({ suggestOrder: enabled }))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Orden sugerido en cocina</CardTitle>
        <CardDescription>
          Prioriza las rondas que llevan más tiempo respecto a su estimado y
          muestra cuál conviene empezar primero.
        </CardDescription>
        <CardAction>
          <Badge variant="outline">
            {settings.suggestOrder ? "Sugerido" : "Llegada"}
          </Badge>
        </CardAction>
      </CardHeader>

      <CardContent className="gap-3">
        <div className="flex items-start justify-between gap-4 rounded-lg border border-border/60 p-3">
          <div className="flex flex-col gap-1 text-sm">
            <span className="font-medium">
              Ordenar por urgencia en el tablero
            </span>
            <span className="text-muted-foreground">
              En cocina puedes alternar entre «Sugerido» y «Llegada» sin
              cambiar esta preferencia.
            </span>
          </div>
          <Switch
            checked={settings.suggestOrder}
            onCheckedChange={toggle}
            disabled={!canManage || pending}
            aria-label="Ordenar la cola de cocina por urgencia"
          />
        </div>

        {!canManage ? (
          <p className="text-xs text-muted-foreground">
            Solo administración puede cambiar el orden de la cola.
          </p>
        ) : null}

        {error ? <FieldError>{error}</FieldError> : null}
      </CardContent>
    </Card>
  )
}
