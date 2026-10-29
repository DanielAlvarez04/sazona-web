"use client"

import { useRouter } from "next/navigation"
import { useRef, useState } from "react"
import { Loader2Icon, SaveIcon } from "lucide-react"

import {
  createIngredient,
  updateIngredient,
} from "@/app/(app)/inventory/actions"
import { Button } from "@/components/ui/button"
import { ClearFieldsButton } from "@/components/ui/clear-fields-button"
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
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group"
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
  convertUnitValue,
  UNIT_SELECT_ITEMS,
  unitLabel,
  unitsOfDimension,
  type Ingredient,
  type IngredientCategory,
  type IngredientLocation,
  type UnitCode,
} from "@/lib/catalog"
import { clearDraft, formValues, readDraft, writeDraft } from "@/lib/drafts"

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

  // Borrador: lo que se escribe se guarda al cerrar y se recupera al reabrir.
  // Se descarta solo cuando el formulario se guarda con éxito.
  const draftKey = ingredient ? `ingredient:${ingredient.id}` : "ingredient:new"
  const [draft, setDraft] = useState(() =>
    readDraft<Record<string, string>>(draftKey)
  )
  const formRef = useRef<HTMLFormElement>(null)
  // Cambiar la clave remonta el formulario: así los campos no controlados
  // vuelven a su `defaultValue` cuando se limpian.
  const [formKey, setFormKey] = useState(0)

  const { pending, error, run } = useActionForm(() => {
    clearDraft(draftKey)
    onOpenChange(false)
    router.refresh()
  })

  // Unidad visible: se puede cambiar en cualquier momento. La API guarda los
  // valores en la unidad canónica de la dimensión, así que no se reescriben.
  const [displayUnit, setDisplayUnit] = useState<UnitCode>(
    (draft?.displayUnit as UnitCode | undefined) ??
      ingredient?.displayUnit ??
      "UNIT"
  )
  const unitSymbol = unitLabel(displayUnit)
  // Al editar solo se ofrecen unidades de la misma dimensión: la API rechaza
  // cambiar de masa a volumen o conteo.
  const unitChoices = isEdit
    ? unitsOfDimension(ingredient?.displayUnit ?? "UNIT")
    : undefined
  const unitItems = unitChoices
    ? unitChoices.map((unit) => ({ value: unit.code, label: unit.symbol }))
    : UNIT_SELECT_ITEMS

  const categoryItems = categories
    .filter((c) => c.isActive)
    .map((c) => ({ value: c.id, label: c.name }))

  const locationItems = locations
    .filter((l) => l.isActive)
    .map((l) => ({ value: l.id, label: l.name }))

  /** Guarda lo escrito antes de cerrar para poder recuperarlo al reabrir. */
  function handleOpenChange(next: boolean) {
    if (!next && formRef.current) {
      writeDraft(draftKey, { ...formValues(formRef.current), displayUnit })
    }

    onOpenChange(next)
  }

  /** Devuelve los campos a su valor inicial y descarta el borrador. */
  function handleClear() {
    clearDraft(draftKey)
    setDraft(null)
    setDisplayUnit(ingredient?.displayUnit ?? "UNIT")
    setFormError(null)
    setFormKey((key) => key + 1)
  }

  /**
   * Cambiar la unidad visible no toca la BD, pero los valores del formulario se
   * reescriben para que representen la misma cantidad física.
   */
  function handleUnitChange(next: UnitCode) {
    if (next === displayUnit) return

    const form = formRef.current

    if (form) {
      const values = formValues(form)

      const quantities = ["minStock", "maxStock"]
      for (const field of quantities) {
        const raw = values[field]
        if (!raw) continue
        const parsed = Number(raw.replace(",", "."))
        if (!Number.isFinite(parsed)) continue
        const converted = convertUnitValue(parsed, displayUnit, next)
        if (converted !== null) values[field] = String(converted)
      }

      if (values.unitCost) {
        const parsed = Number(values.unitCost.replace(",", "."))
        // El costo por unidad se mueve al revés que la cantidad.
        const converted = Number.isFinite(parsed)
          ? convertUnitValue(parsed, next, displayUnit)
          : null
        if (converted !== null) values.unitCost = String(converted)
      }

      setDraft(values)
    }

    setDisplayUnit(next)
    setFormKey((key) => key + 1)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? `Editar ${ingredient?.name}` : "Nuevo producto"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "El stock solo cambia con ajustes auditables, no editando el producto."
              : branchName
                ? `El stock inicial se registra en ${branchName} como un movimiento de ajuste.`
                : "En la vista de organización no se puede definir stock inicial. Use una sucursal para dar de alta stock."}
          </DialogDescription>
        </DialogHeader>

        <form
          key={`${ingredient?.id ?? "nuevo"}-${formKey}`}
          ref={formRef}
          onSubmit={(event) => {
            event.preventDefault()
            const formData = new FormData(event.currentTarget)

            const name = String(formData.get("name") ?? "").trim()
            if (!name) {
              setFormError("Escribe el nombre del producto.")
              return
            }

            if (!formData.get("displayUnit")) {
              setFormError("Selecciona la unidad.")
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
            {/* Fila 1: Nombre y Unidad */}
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="ingredient-name">
                  Nombre <span className="text-destructive">*</span>
                </FieldLabel>
                <Input
                  id="ingredient-name"
                  name="name"
                  defaultValue={draft?.name ?? ingredient?.name ?? ""}
                  required
                  maxLength={120}
                  placeholder="Leche entera"
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="ingredient-unit">
                  Unidad <span className="text-destructive">*</span>
                </FieldLabel>
                <Select
                  name="displayUnit"
                  value={displayUnit}
                  onValueChange={(value) =>
                    handleUnitChange((value as UnitCode) ?? "UNIT")
                  }
                  items={unitItems}
                >
                  <SelectTrigger
                    id="ingredient-unit"
                    className="w-full"
                    aria-label="Unidad"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <UnitOptions dimension={unitChoices?.[0]?.dimension} />
                  </SelectContent>
                </Select>
              </Field>
            </div>

            {/* Fila 2: Categoría y Ubicación */}
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="ingredient-category">
                  Categoría <span className="text-destructive">*</span>
                </FieldLabel>
                <Select
                  name="categoryId"
                  defaultValue={draft?.categoryId ?? ingredient?.category?.id ?? ""}
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
                  defaultValue={draft?.locationId ?? ingredient?.location?.id ?? ""}
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

            {/* Fila 3: Stock inicial (nuevo) / Stock actual (editar) y Costo unitario */}
            {!isOrgView && (
              <div className="grid grid-cols-2 gap-3">
                {isEdit ? (
                  <Field data-disabled>
                    <FieldLabel htmlFor="ingredient-current-stock">
                      Stock actual
                    </FieldLabel>
                    <InputGroup
                      className="bg-muted dark:bg-muted"
                      data-disabled
                    >
                      <InputGroupInput
                        id="ingredient-current-stock"
                        type="number"
                        min="0"
                        value={ingredient?.currentStock ?? "0"}
                        readOnly
                        className="cursor-not-allowed"
                      />
                      <InputGroupAddon align="inline-end">
                        <InputGroupText>{unitSymbol}</InputGroupText>
                      </InputGroupAddon>
                    </InputGroup>
                  </Field>
                ) : (
                  <Field>
                    <FieldLabel htmlFor="ingredient-stock">
                      Stock inicial
                    </FieldLabel>
                    <InputGroup>
                      <InputGroupInput
                        id="ingredient-stock"
                        name="currentStock"
                        type="number"
                        min="0"
                        placeholder="0"
                        defaultValue={draft?.currentStock ?? ""}
                      />
                      <InputGroupAddon align="inline-end">
                        <InputGroupText>{unitSymbol}</InputGroupText>
                      </InputGroupAddon>
                    </InputGroup>
                  </Field>
                )}

                <Field>
                  <FieldLabel htmlFor="ingredient-unit-cost">
                    Costo unitario
                  </FieldLabel>
                  <InputGroup>
                    <InputGroupAddon align="inline-start">
                      <InputGroupText>$</InputGroupText>
                    </InputGroupAddon>
                    <InputGroupInput
                      id="ingredient-unit-cost"
                      name="unitCost"
                      type="number"
                      min="0"
                      placeholder="0"
                      defaultValue={draft?.unitCost ?? ingredient?.unitCost ?? ""}
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupText>MXN</InputGroupText>
                    </InputGroupAddon>
                  </InputGroup>
                </Field>
              </div>
            )}

            {/* Fila 3 alternativa (vista org): solo Costo unitario (full width) */}
            {isOrgView && (
              <Field>
                <FieldLabel htmlFor="ingredient-unit-cost">
                  Costo unitario
                </FieldLabel>
                <InputGroup>
                  <InputGroupAddon align="inline-start">
                    <InputGroupText>$</InputGroupText>
                  </InputGroupAddon>
                  <InputGroupInput
                    id="ingredient-unit-cost"
                    name="unitCost"
                    type="number"
                    min="0"
                    placeholder="0"
                    defaultValue={draft?.unitCost ?? ingredient?.unitCost ?? ""}
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupText>MXN</InputGroupText>
                  </InputGroupAddon>
                </InputGroup>
              </Field>
            )}

            {/* Fila 4: Stock mínimo y Stock máximo (ocultar en vista org) */}
            {!isOrgView && (
              <div className="grid grid-cols-2 gap-3">
                <Field>
                  <FieldLabel htmlFor="ingredient-min">Stock mínimo</FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      id="ingredient-min"
                      name="minStock"
                      type="number"
                      min="0"
                      placeholder="0"
                      defaultValue={draft?.minStock ?? ingredient?.minStock ?? ""}
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupText>{unitSymbol}</InputGroupText>
                    </InputGroupAddon>
                  </InputGroup>
                </Field>

                <Field>
                  <FieldLabel htmlFor="ingredient-max-stock">
                    Stock máximo
                  </FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      id="ingredient-max-stock"
                      name="maxStock"
                      type="number"
                      min="0"
                      placeholder="0"
                      defaultValue={draft?.maxStock ?? ingredient?.maxStock ?? ""}
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupText>{unitSymbol}</InputGroupText>
                    </InputGroupAddon>
                  </InputGroup>
                </Field>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              {isEdit
                ? `SKU: ${ingredient?.sku ?? "—"}. Cambiar la categoría genera un SKU nuevo.`
                : "El SKU se genera automáticamente según la categoría (ej. FVE100)."}
            </p>
            {formError ? <FieldError>{formError}</FieldError> : null}
            {error ? <FieldError>{error}</FieldError> : null}

            <DialogFooter>
              {!isEdit ? (
                <ClearFieldsButton
                  onClick={handleClear}
                  disabled={pending}
                  className="sm:mr-auto"
                />
              ) : null}
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
                {isEdit ? "Guardar cambios" : "Crear producto"}
              </Button>
            </DialogFooter>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
