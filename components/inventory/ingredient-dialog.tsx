"use client"

import { useRouter } from "next/navigation"
import { Loader2Icon, SaveIcon } from "lucide-react"

import {
  createIngredient,
  updateIngredient,
} from "@/app/(app)/inventory/actions"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { UnitOptions } from "@/components/ui/unit-options"
import { useActionForm } from "@/hooks/use-action-form"
import { UNIT_SELECT_ITEMS, type Ingredient } from "@/lib/catalog"

export function IngredientDialog({
  open,
  onOpenChange,
  ingredient,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  ingredient?: Ingredient | null
}) {
  const router = useRouter()
  const isEdit = Boolean(ingredient)
  const { pending, error, run } = useActionForm(() => {
    onOpenChange(false)
    router.refresh()
  })

  // Cambiar la unidad de un ingrediente ya usado en recetas rompe las
  // cantidades guardadas; la API lo rechaza con 409.
  const unitLocked = Boolean(ingredient?._count?.recipeIngredients)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? `Editar ${ingredient?.name}` : "Nuevo ingrediente"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "El stock solo cambia con ajustes auditables, no editando el ingrediente."
              : "El stock inicial queda registrado como un movimiento de ajuste."}
          </DialogDescription>
        </DialogHeader>

        <form
          key={ingredient?.id ?? "nuevo"}
          onSubmit={(event) => {
            event.preventDefault()
            const formData = new FormData(event.currentTarget)
            run(() =>
              ingredient
                ? updateIngredient(ingredient.id, formData)
                : createIngredient(formData)
            )
          }}
        >
          <div className="flex flex-col gap-4">
            <Field>
              <FieldLabel htmlFor="ingredient-name">Nombre</FieldLabel>
              <Input
                id="ingredient-name"
                name="name"
                defaultValue={ingredient?.name ?? ""}
                required
                maxLength={120}
                placeholder="Leche entera"
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="ingredient-unit">Unidad base</FieldLabel>
              <Select
                name="baseUnit"
                defaultValue={ingredient?.baseUnit ?? "UNIT"}
                disabled={unitLocked}
                items={UNIT_SELECT_ITEMS}
              >
                <SelectTrigger
                  id="ingredient-unit"
                  className="w-full"
                  aria-label="Unidad base"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="w-(--anchor-width)">
                  <UnitOptions />
                </SelectContent>
              </Select>
            </Field>

            {unitLocked ? (
              <p className="text-xs text-muted-foreground">
                La unidad base no se puede cambiar porque el ingrediente se usa
                en recetas.
              </p>
            ) : null}

            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="ingredient-min">Stock mínimo</FieldLabel>
                <Input
                  id="ingredient-min"
                  name="minStock"
                  type="number"
                  min="0"
                  step="0.0001"
                  placeholder="0"
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="ingredient-stock">Stock inicial</FieldLabel>
                <Input
                  id="ingredient-stock"
                  name="currentStock"
                  type="number"
                  min="0"
                  step="0.0001"
                  placeholder="0"
                />
              </Field>
            </div>

            {ingredient ? (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="isActive"
                  defaultChecked={ingredient.isActive}
                  className="size-4 accent-primary"
                />
                Activo
              </label>
            ) : null}

            {error ? <FieldError>{error}</FieldError> : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? (
                  <Loader2Icon className="animate-spin" />
                ) : (
                  <SaveIcon />
                )}
                {isEdit ? "Guardar cambios" : "Crear ingrediente"}
              </Button>
            </DialogFooter>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
