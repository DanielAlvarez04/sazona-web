"use client"

import { useRouter } from "next/navigation"
import type { ReactNode } from "react"
import { BoxesIcon, PackageSearchIcon } from "lucide-react"
import { toast } from "sonner"

import {
  setCoreIngredientCategoriesActive,
  setUseCoreSuggestions,
} from "@/app/(app)/settings/actions"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { FieldError } from "@/components/ui/field"
import { Switch } from "@/components/ui/switch"
import { useActionForm } from "@/hooks/use-action-form"
import type { IngredientCategory } from "@/lib/catalog"

function PreferenceRow({
  icon,
  title,
  description,
  checked,
  disabled,
  onCheckedChange,
}: {
  icon: ReactNode
  title: string
  description: string
  checked: boolean
  disabled: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 text-muted-foreground">{icon}</span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-xs text-muted-foreground">
          {checked ? "Activo" : "Inactivo"}
        </span>
        <Switch
          aria-label={title}
          checked={checked}
          disabled={disabled}
          onCheckedChange={onCheckedChange}
        />
      </div>
    </div>
  )
}

export function InventoryPreferencesCard({
  categories,
  useCoreSuggestions,
  canManage,
  canManageSuggestions,
}: {
  categories: IngredientCategory[]
  useCoreSuggestions: boolean
  canManage: boolean
  /** El flag de sugerencias es una preferencia de la organización (ADMIN). */
  canManageSuggestions: boolean
}) {
  const router = useRouter()
  const form = useActionForm(() => router.refresh())

  const coreCategories = categories.filter((category) => category.isCore)
  const allActive =
    coreCategories.length > 0 &&
    coreCategories.every((category) => category.isActive)

  function handleCategoriesToggle(checked: boolean) {
    if (
      !checked &&
      !window.confirm(
        "¿Desactivar todas las categorías core de inventario? Se quitarán de los insumos que las usen y no podrás clasificar insumos nuevos hasta reactivarlas."
      )
    ) {
      return
    }

    form.run(() =>
      setCoreIngredientCategoriesActive(checked).then((result) => {
        if (result.ok) {
          toast.success(
            checked
              ? "Categorías de inventario activadas"
              : "Categorías de inventario desactivadas"
          )
        }
        return result
      })
    )
  }

  function handleSuggestionsToggle(checked: boolean) {
    form.run(() =>
      setUseCoreSuggestions(checked).then((result) => {
        if (result.ok) {
          toast.success(
            checked
              ? "Insumos core sugeridos activados"
              : "Insumos core sugeridos desactivados"
          )
        }
        return result
      })
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Preferencias de inventario</CardTitle>
        <CardDescription>
          Activa o desactiva las categorías core del inventario y la sección de
          insumos sugeridos.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        <PreferenceRow
          icon={<BoxesIcon className="size-4" />}
          title="Categorías de inventario"
          description={
            coreCategories.length > 0
              ? `${coreCategories.length} categorías core compartidas para clasificar insumos.`
              : "No hay categorías core disponibles."
          }
          checked={allActive}
          disabled={!canManage || form.pending || coreCategories.length === 0}
          onCheckedChange={handleCategoriesToggle}
        />

        <PreferenceRow
          icon={<PackageSearchIcon className="size-4" />}
          title="Insumos core sugeridos"
          description="Muestra la sección para agregar insumos sugeridos al inventario."
          checked={useCoreSuggestions}
          disabled={!canManageSuggestions || form.pending}
          onCheckedChange={handleSuggestionsToggle}
        />

        {!canManage ? (
          <p className="text-xs text-muted-foreground">
            Solo un administrador o encargado de inventario puede cambiar estas
            preferencias.
          </p>
        ) : !canManageSuggestions ? (
          <p className="text-xs text-muted-foreground">
            Solo un administrador puede activar o desactivar los insumos
            sugeridos.
          </p>
        ) : null}

        {form.error ? <FieldError>{form.error}</FieldError> : null}
      </CardContent>
    </Card>
  )
}
