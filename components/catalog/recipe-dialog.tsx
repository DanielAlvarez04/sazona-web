"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { Loader2Icon, PackageIcon, SaveIcon } from "lucide-react"
import { toast } from "sonner"

import {
  createRecipe,
  updateRecipe,
  type RecipeInput,
} from "@/app/(app)/catalog/actions"
import {
  IngredientRowsEditor,
  emptyIngredientRow,
  nextIngredientKey,
  toUnitCode,
  type IngredientRowState,
} from "@/components/catalog/ingredient-rows-editor"
import {
  PresentationEditor,
  defaultPresentationRows,
  type PresentationRow,
} from "@/components/catalog/presentation-editor"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
import { Textarea } from "@/components/ui/textarea"
import { useActionForm } from "@/hooks/use-action-form"
import {
  UNIT_LABELS,
  formatQuantity,
  type Category,
  type Ingredient,
  type Recipe,
  type UnitCode,
} from "@/lib/catalog"

const PRODUCTION_UNITS: UnitCode[] = ["KG", "G", "L", "ML", "UNIT"]

function rowsFrom(recipe: Recipe): IngredientRowState[] {
  return recipe.ingredients.map((line) => ({
    key: nextIngredientKey("edit"),
    ingredientId: line.ingredient.id,
    label: line.label ?? "",
    quantity: line.quantity,
    unit: line.ingredient.displayUnit,
    isOptional: line.isOptional,
    alternatives: line.options.map((option) => ({
      key: nextIngredientKey("edit-alt"),
      ingredientId: option.ingredient.id,
      quantity: option.quantity,
      unit: option.ingredient.displayUnit,
    })),
  }))
}

export function RecipeDialog({
  open,
  onOpenChange,
  recipe,
  categories,
  ingredients,
  initialPublish = false,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  recipe: Recipe | null
  categories: Category[]
  ingredients: Ingredient[]
  /** Abre la sección de publicación (acción "Publicar como artículo"). */
  initialPublish?: boolean
}) {
  const router = useRouter()
  const form = useActionForm(() => {
    toast.success(recipe ? "Receta actualizada" : "Receta creada")
    router.refresh()
    onOpenChange(false)
  })

  const [name, setName] = useState(recipe?.name ?? "")
  const [description, setDescription] = useState(recipe?.description ?? "")
  const [categoryId, setCategoryId] = useState(recipe?.categoryId ?? "")
  const [isActive, setIsActive] = useState(recipe?.isActive ?? true)
  const [rows, setRows] = useState<IngredientRowState[]>(() =>
    recipe ? rowsFrom(recipe) : [emptyIngredientRow()]
  )

  const [publish, setPublish] = useState(initialPublish)
  const [price, setPrice] = useState("")
  const [sku, setSku] = useState(recipe?.item?.sku ?? "")
  const [taxRate, setTaxRate] = useState("0.16")
  const [presentations, setPresentations] = useState<PresentationRow[]>(() =>
    defaultPresentationRows()
  )

  const [produce, setProduce] = useState(false)
  const [produceUnit, setProduceUnit] = useState<UnitCode>("KG")
  const [yieldQuantity, setYieldQuantity] = useState("")

  const published = Boolean(recipe?.itemId)
  const producesIngredient = Boolean(recipe?.producesIngredientId)

  function save() {
    const parsedRows = rows
      .filter(
        (row) => row.ingredientId && Number(row.quantity.replace(",", ".")) > 0
      )
      .map((row) => ({
        ingredientId: row.ingredientId,
        quantity: Number(row.quantity.replace(",", ".")),
        ...(row.unit ? { unit: toUnitCode(row.unit) } : {}),
        ...(row.label.trim() ? { label: row.label.trim() } : {}),
        isOptional: row.isOptional,
        alternatives: row.alternatives
          .filter(
            (alternative) =>
              alternative.ingredientId &&
              Number(alternative.quantity.replace(",", ".")) > 0
          )
          .map((alternative) => ({
            ingredientId: alternative.ingredientId,
            quantity: Number(alternative.quantity.replace(",", ".")),
            ...(alternative.unit
              ? { unit: toUnitCode(alternative.unit) }
              : {}),
          })),
      }))

    if (parsedRows.length === 0) {
      form.setError("Añade al menos un ingrediente con cantidad")
      return
    }

    if (!name.trim()) {
      form.setError("El nombre de la receta es obligatorio")
      return
    }

    const payload: RecipeInput = {
      name: name.trim(),
      description: description.trim() || undefined,
      categoryId: categoryId || null,
      isActive,
      ingredients: parsedRows,
    }

    if (!published && publish) {
      const publishPrice = Number(price.replace(",", "."))

      if (!Number.isFinite(publishPrice) || publishPrice < 0) {
        form.setError("Indica un precio válido para publicar el artículo")
        return
      }

      payload.publish = {
        price: publishPrice,
        ...(sku.trim() ? { sku: sku.trim() } : {}),
        ...(categoryId ? { categoryId } : {}),
        taxRate: Number(taxRate.replace(",", ".")),
        variants: presentations
          .filter((row) => row.name.trim())
          .map((row, index) => ({
            name: row.name.trim(),
            priceAdjust: Number(row.priceAdjust.replace(",", ".")) || 0,
            recipeFactor: Number(row.recipeFactor.replace(",", ".")) || 1,
            sortOrder: index,
          })),
      }
    }

    if (!producesIngredient && produce) {
      const yieldValue = Number(yieldQuantity.replace(",", "."))

      if (!Number.isFinite(yieldValue) || yieldValue <= 0) {
        form.setError("Indica el rendimiento por lote")
        return
      }

      payload.produce = {
        displayUnit: produceUnit,
        yieldQuantity: yieldValue,
      }
    }

    form.run(() =>
      recipe ? updateRecipe(recipe.id, payload) : createRecipe(payload)
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="no-scrollbar max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {recipe ? "Editar receta" : "Nueva receta"}
          </DialogTitle>
          <DialogDescription>
            Los ingredientes son insumos del inventario. Al vender el artículo,
            el stock se descuenta con esta receta.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="recipe-name">Nombre</FieldLabel>
              <Input
                id="recipe-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ej. Salsa verde"
              />
            </Field>

            <Field>
              <FieldLabel>Categoría</FieldLabel>
              <Select
                value={categoryId || "none"}
                onValueChange={(value) =>
                  setCategoryId(value === "none" ? "" : (value ?? ""))
                }
                items={[
                  { value: "none", label: "Sin categoría" },
                  ...categories.map((category) => ({
                    value: category.id,
                    label: category.name,
                  })),
                ]}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sin categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin categoría</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="recipe-description">Descripción</FieldLabel>
            <Textarea
              id="recipe-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Preparación, notas o rendimiento esperado"
            />
          </Field>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={isActive}
              onCheckedChange={(checked) => setIsActive(checked === true)}
            />
            Receta activa
          </label>

          <section className="flex flex-col gap-2 rounded-lg border p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-medium">Ingredientes</h3>
                <p className="text-xs text-muted-foreground">
                  Busca el insumo, indica la cantidad y añade alternativas si
                  aplica (ej. leche entera, deslactosada o de coco).
                </p>
              </div>
            </div>
            <IngredientRowsEditor
              rows={rows}
              ingredients={ingredients}
              onChange={setRows}
            />
          </section>

          <section className="flex flex-col gap-3 rounded-lg border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-medium">
                  <PackageIcon className="size-4" />
                  Publicar como artículo
                </h3>
                <p className="text-xs text-muted-foreground">
                  El artículo aparecerá en la tab Artículos y podrá usarse en
                  menús. No modifica el inventario por sí solo.
                </p>
              </div>
              {published ? (
                <Badge variant="secondary">
                  Publicada · {recipe?.item?.name}
                </Badge>
              ) : (
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={publish}
                    onCheckedChange={(checked) => setPublish(checked === true)}
                  />
                  Publicar
                </label>
              )}
            </div>

            {published ? (
              <p className="text-xs text-muted-foreground">
                Edita precio y presentaciones desde el artículo.
              </p>
            ) : publish ? (
              <>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field>
                    <FieldLabel htmlFor="recipe-price">Precio</FieldLabel>
                    <Input
                      id="recipe-price"
                      type="number"
                      min="0"
                      step="0.01"
                      value={price}
                      onChange={(event) => setPrice(event.target.value)}
                      placeholder="0.00"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="recipe-sku">SKU</FieldLabel>
                    <Input
                      id="recipe-sku"
                      value={sku}
                      onChange={(event) => setSku(event.target.value)}
                      placeholder="Opcional"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="recipe-tax">IVA (fracción)</FieldLabel>
                    <Input
                      id="recipe-tax"
                      type="number"
                      min="0"
                      max="1"
                      step="0.01"
                      value={taxRate}
                      onChange={(event) => setTaxRate(event.target.value)}
                    />
                  </Field>
                </div>
                <PresentationEditor
                  rows={presentations}
                  onChange={setPresentations}
                />
              </>
            ) : null}
          </section>

          <section className="flex flex-col gap-3 rounded-lg border p-4">
            <div>
              <h3 className="text-sm font-medium">Convertir en insumo</h3>
              <p className="text-xs text-muted-foreground">
                La receta también existirá en el inventario (ej. salsa verde).
                Podrás producir lotes y usarla como ingrediente de otras
                recetas.
              </p>
            </div>

            {producesIngredient ? (
              <Badge variant="secondary">
                Insumo: {recipe?.producesIngredient?.name} ·{" "}
                {formatQuantity(recipe?.yieldQuantity ?? 0)}{" "}
                {recipe?.yieldUnit
                  ? (UNIT_LABELS[recipe.yieldUnit] ?? recipe.yieldUnit)
                  : ""}
              </Badge>
            ) : (
              <>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={produce}
                    onCheckedChange={(checked) => setProduce(checked === true)}
                  />
                  Crear insumo con el nombre de la receta
                </label>

                {produce ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field>
                      <FieldLabel>Unidad de rendimiento</FieldLabel>
                      <Select
                        value={produceUnit}
                        onValueChange={(value) =>
                          setProduceUnit((value ?? "KG") as UnitCode)
                        }
                        items={PRODUCTION_UNITS.map((code) => ({
                          value: code,
                          label: UNIT_LABELS[code],
                        }))}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Unidad" />
                        </SelectTrigger>
                        <SelectContent>
                          {PRODUCTION_UNITS.map((code) => (
                            <SelectItem key={code} value={code}>
                              {UNIT_LABELS[code]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="recipe-yield">
                        Rendimiento por lote
                      </FieldLabel>
                      <Input
                        id="recipe-yield"
                        type="number"
                        min="0.0001"
                        step="any"
                        value={yieldQuantity}
                        onChange={(event) =>
                          setYieldQuantity(event.target.value)
                        }
                        placeholder="Ej. 2"
                      />
                    </Field>
                  </div>
                ) : null}
              </>
            )}
          </section>

          {form.error ? <FieldError>{form.error}</FieldError> : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={form.pending}
          >
            Cancelar
          </Button>
          <Button type="button" onClick={save} disabled={form.pending}>
            {form.pending ? <Loader2Icon className="animate-spin" /> : <SaveIcon />}
            {recipe ? "Guardar receta" : "Crear receta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
