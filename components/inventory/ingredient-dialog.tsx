"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
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
  SelectItem,
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
  branchName = null,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  ingredient?: Ingredient | null
  categories: IngredientCategory[]
  locations: IngredientLocation[]
  /** Sucursal donde se registra el stock inicial; `null` = organización. */
  branchName?: string | null
}) {
  const router = useRouter()
  const isEdit = Boolean(ingredient)
  const isOrgView = branchName === null
  const [formError, setFormError] = useState<string | null>(null)
  const { pending, error, run } = useActionForm(() => {
    onOpenChange(false)
    router.refresh()
  })

  // Cambiar la unidad de un insumo ya usado en recetas rompe las
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
            {isEdit ? `Editar ${ingredient?.name}` : "Nuevo insumo"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "El stock solo cambia con ajustes auditables, no editando el insumo."
              : branchName
              ? `El stock inicial se registra en ${branchName} como un movimiento de ajuste.`
              : "En la vista de organización no se puede definir stock inicial. Use una sucursal para dar de alta stock."}
          </DialogDescription>
        </DialogHeader>

        <form
          key={ingredient?.id ?? "nuevo"}
          onSubmit={(event) => {
            event.preventDefault()
            const formData = new FormData(event.currentTarget)

            const name = String(formData.get("name") ?? "").trim()
            if (!name) {
              setFormError("Escribe el nombre del insumo.")
              return
            }

            if (!formData.get("baseUnit")) {
              setFormError("Selecciona la unidad base.")
              return
            }

            if (!formData.get("categoryId")) {
              setFormError("Selecciona una categoría.")
              return
            }

            setFormError(null)
            run(() =>
              ingredient
                ? updateIngredient(ingredient.id, formData)
                : createIngredient(formData)
            )
          }}
        >
          <div className="flex flex-col gap-4">
            {/* Fila 1: Nombre y Unidad base */}
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="ingredient-name">
                  Nombre <span className="text-destructive">*</span>
                </FieldLabel>
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
                <FieldLabel htmlFor="ingredient-unit">
                  Unidad base <span className="text-destructive">*</span>
                </FieldLabel>
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
                  <SelectContent>
                    <UnitOptions />
                  </SelectContent>
                </Select>
              </Field>
            </div>

            {unitLocked ? (
              <p className="text-xs text-muted-foreground">
                La unidad base no se puede cambiar porque el insumo se usa
                en recetas.</p>
              
            ) : null}

            {/* Fila 2: Categoría y Ubicación */}
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="ingredient-category">
                  Categoría <span className="text-destructive">*</span>
                </FieldLabel>
                <Select
                  name="categoryId"
                  defaultValue={ingredient?.category?.id ?? ""}
                  items={categoryItems}
                >
                  <SelectTrigger
                    id="ingredient-category"
                    className="w-full"
                    aria-label="Categoría"
                  >
                    <SelectValue placeholder="Seleccionar categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryItems.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
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
                  <SelectContent>
                    {locationItems.map((loc) => (
                      <SelectItem key={loc.value} value={loc.value}>
                        {loc.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            {/* Fila 3: Stock inicial (nuevo) / Stock actual (editar) y Costo unitario (ocultar en vista org) */}
            {!isOrgView && (
              <div className="grid grid-cols-2 gap-3">
                {isEdit ? (
                  <Field>
                    <FieldLabel htmlFor="ingredient-current-stock">Stock actual</FieldLabel>
                    <Input
                      id="ingredient-current-stock"
                      type="number"
                      min="0"
                     
                      value={ingredient?.currentStock ?? "0"}
                      readOnly
                      className="bg-muted cursor-not-allowed"
                    />
                    
                      
                    
                  </Field>
                ) : (
                  <Field>
                    <FieldLabel htmlFor="ingredient-stock">Stock inicial</FieldLabel>
                    <Input
                      id="ingredient-stock"
                      name="currentStock"
                      type="number"
                      min="0"
                     
                      placeholder="0"
                    />
                  </Field>
                )}

                <Field>
                  <FieldLabel htmlFor="ingredient-unit-cost">Costo unitario</FieldLabel>
                  <Input
                    id="ingredient-unit-cost"
                    name="unitCost"
                    type="number"
                    min="0"
                   
                    placeholder="0"
                    defaultValue={ingredient?.unitCost ?? ""}
                  />
                </Field>
              </div>
            )}

            {/* Fila 3 alternativa (vista org): solo Costo unitario (full width) */}
            {isOrgView && (
              <Field>
                <FieldLabel htmlFor="ingredient-unit-cost">Costo unitario</FieldLabel>
                <Input
                  id="ingredient-unit-cost"
                  name="unitCost"
                  type="number"
                  min="0"
                 
                  placeholder="0"
                  defaultValue={ingredient?.unitCost ?? ""}
                />
              </Field>
            )}

            {/* Fila 4: Stock mínimo y Stock máximo (ocultar en vista org) */}
            {!isOrgView && (
              <div className="grid grid-cols-2 gap-3">
                <Field>
                  <FieldLabel htmlFor="ingredient-min">Stock mínimo</FieldLabel>
                  <Input
                    id="ingredient-min"
                    name="minStock"
                    type="number"
                    min="0"
                   
                    placeholder="0"
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="ingredient-max-stock">Stock máximo</FieldLabel>
                  <Input
                    id="ingredient-max-stock"
                    name="maxStock"
                    type="number"
                    min="0"
                   
                    placeholder="0"
                    defaultValue={ingredient?.maxStock ?? ""}
                  />
                </Field>
              </div>
            )}

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

            <p className="text-xs text-muted-foreground">
              {isEdit
                ? `SKU: ${ingredient?.sku ?? "—"}. Cambiar la categoría genera un SKU nuevo.`
                : "El SKU se genera automáticamente según la categoría (ej. FVE100)."}
            

            </p>
            {formError ? <FieldError>{formError}</FieldError> : null}
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
                {isEdit ? "Guardar cambios" : "Crear insumo"}
              </Button>
            </DialogFooter>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}