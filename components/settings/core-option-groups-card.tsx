"use client"

import { useRouter } from "next/navigation"
import { ListChecksIcon } from "lucide-react"
import { toast } from "sonner"

import { setCoreOptionGroupsActive } from "@/app/(app)/settings/actions"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { FieldError } from "@/components/ui/field"
import { Switch } from "@/components/ui/switch"
import { useActionForm } from "@/hooks/use-action-form"
import type { OptionGroupPreset } from "@/lib/catalog"

/**
 * Activa/desactiva los grupos de opciones core sugeridos.
 *
 * Al desactivarlos dejan de ofrecerse en el editor de artículos, pero los
 * grupos que ya se crearon en la biblioteca se conservan.
 */
export function CoreOptionGroupsCard({
  presets,
  active,
  canManage,
}: {
  presets: OptionGroupPreset[]
  active: boolean
  canManage: boolean
}) {
  const router = useRouter()
  const form = useActionForm(() => router.refresh())

  function toggle(checked: boolean) {
    form.run(() =>
      setCoreOptionGroupsActive(checked).then((result) => {
        if (result.ok) {
          toast.success(
            checked
              ? "Grupos de opciones core activados"
              : "Grupos de opciones core desactivados"
          )
        }
        return result
      })
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ListChecksIcon className="size-4" />
          Grupos de opciones core
        </CardTitle>
        <CardDescription>
          Salsas, proteínas, leches, término, extras y “sin…”. Se ofrecen como
          sugerencia al configurar las opciones de un artículo y, al elegirlos,
          se crea una copia editable en tu biblioteca.
        </CardDescription>
        <CardAction>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {active ? "Activos" : "Inactivos"}
            </span>
            <Switch
              aria-label={
                active
                  ? "Desactivar grupos de opciones core"
                  : "Activar grupos de opciones core"
              }
              checked={active}
              disabled={!canManage || form.pending || presets.length === 0}
              onCheckedChange={toggle}
            />
          </div>
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-1.5">
          {presets.map((preset) => (
            <Badge
              key={preset.name}
              variant={active ? "secondary" : "outline"}
            >
              {preset.name}
            </Badge>
          ))}
        </div>

        <p className="text-xs text-muted-foreground">
          Desactivarlos no borra los grupos que ya estén en tu biblioteca ni las
          opciones asignadas a los artículos.
        </p>

        {!canManage ? (
          <p className="text-xs text-muted-foreground">
            Solo un administrador o encargado de catálogo puede cambiar esta
            preferencia.
          </p>
        ) : null}

        {form.error ? <FieldError>{form.error}</FieldError> : null}
      </CardContent>
    </Card>
  )
}
