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
import {
  UNIT_SELECT_ITEMS,
  type Ingredient,
  type IngredientCategory,
  type IngredientLocation,
} from "@/lib/catalog"

export function IngredientDialog({
  open,
  onOpenChange,
  ingredient,
  categories = [],
  locations = [],
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  ingredient?: Ingredient | null
  categories: IngredientCategory[]
  locations: IngredientLocation[]
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

  const categoryItems = categories
    .filter((c) => c.isActive)
    .map((c) => ({ value: c.id, label: c.name }))

  const locationItems = locations
    .filter((l) => l.isActive)
    .map((l) => ({ value: l.id, label: l.name }))

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
              <FieldLabel htmlFor="ingredient-sku">SKU</FieldLabel>
              <Input
                id="ingredient-sku"
                name="sku"
                defaultValue={ingredient?.sku ?? ""}
                maxLength={60}
                placeholder="SKU-001"
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
                <FieldLabel htmlFor="ingredient-category">Categoría</FieldLabel>
                <Select
                  name="categoryId"
                  defaultValue={ingredient?.category?.id ?? ""}
                  items={[{ value: "", label: "Sin categoría" }, ...categoryItems]}
                >
                  <SelectTrigger
                    id="ingredient-category"
                    className="w-full"
                    aria-label="Categoría"
                  >
                    <SelectValue placeholder="Seleccionar categoría" />
                  </SelectTrigger>
                  <SelectContent className="w-(--anchor-width)">
                    {categoryItems.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field>
                <FieldLabel htmlFor="ingredient-location">Ubicación</FieldLabel>
                <Select
                  name="locationId"
                  defaultValue={ingredient?.location?.id ?? ""}
                  items={[{ value: "", label: "Sin ubicación" }, ...locationItems]}
                >
                  <SelectTrigger
                    id="ingredient-location"
                    className="w-full"
                    aria-label="Ubicación"
                  >
                    <SelectValue placeholder="Seleccionar ubicación" />
                  </SelectTrigger>
                  <SelectContent className="w-(--anchor-width)">
                    {locationItems.map((loc) => (
                      <option key={loc.value} value={loc.value}>
                        {loc.label}
                      </option>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="ingredient-unit-cost">Costo unitario</FieldLabel>
                <Input
                  id="ingredient-unit-cost"
                  name="unitCost"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0"
                  defaultValue={ingredient?.unitCost ?? ""}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="ingredient-max-stock">Existencia máxima</FieldLabel>
                <Input
                  id="ingredient-max-stock"
                  name="maxStock"
                  type="number"
                  min="0"
                  step="0.0001"
                  placeholder="0"
                  defaultValue={ingredient?.maxStock ?? ""}
                />
              </Field>
            </div>

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
