"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { Loader2Icon, PlusIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"

import { createProduct, saveRecipe } from "@/app/(app)/catalog/actions"
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
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useActionForm } from "@/hooks/use-action-form"
import {
  UNIT_CODES,
  UNIT_LABELS,
  unitLabel,
  type Category,
  type Ingredient,
  type UnitCode,
} from "@/lib/catalog"

interface RecipeRow {
  key: string
  ingredientId: string
  quantity: string
  unit: string
}

let rowCounter = 0

function nextKey() {
  rowCounter += 1
  return `new-recipe-row-${rowCounter}`
}

export function ProductCreateDialog({
  open,
  onOpenChange,
  categories,
  ingredients,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: Category[]
  ingredients: Ingredient[]
}) {
  const router = useRouter()
  const [tab, setTab] = useState("data")
  const [withRecipe, setWithRecipe] = useState(false)
  const [rows, setRows] = useState<RecipeRow[]>([])
  const { pending, error, run, setError } = useActionForm(() => {
    onOpenChange(false)
    router.refresh()
  })

  function reset() {
    setTab("data")
    setWithRecipe(false)
    setRows([])
  }

  function updateRow(key: string, changes: Partial<RecipeRow>) {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...changes } : row))
    )
  }

  function addRow() {
    setRows((current) => [
      ...current,
      { key: nextKey(), ingredientId: "", quantity: "", unit: "" },
    ])
  }

  function removeRow(key: string) {
    setRows((current) => current.filter((row) => row.key !== key))
  }

  /** Receta válida: al menos un ingrediente con cantidad mayor que cero. */
  const recipeRows = rows
    .filter((row) => row.ingredientId)
    .map((row) => ({
      ingredientId: row.ingredientId,
      quantity: Number(row.quantity.replace(",", ".")),
      ...(row.unit ? { unit: row.unit as UnitCode } : {}),
    }))

  const recipeIncomplete =
    withRecipe &&
    recipeRows.some(
      (row) => !Number.isFinite(row.quantity) || row.quantity <= 0
    )

  async function handleSubmit(formData: FormData) {
    // Los campos de "Datos" siguen montados en la pestaña de Receta, pero el
    // formulario no usa la validación nativa (podría bloquear un campo oculto).
    const name = String(formData.get("name") ?? "").trim()
    const price = Number(String(formData.get("price") ?? "").replace(",", "."))

    if (name.length < 2) {
      setTab("data")
      setError("Escribe un nombre de al menos 2 caracteres.")
      return
    }

    if (!Number.isFinite(price) || price < 0) {
      setTab("data")
      setError("Escribe un precio válido (IVA incluido).")
      return
    }

    if (withRecipe && recipeRows.length === 0) {
      setError("Añade al menos un ingrediente a la receta o desactívala.")
      return
    }

    if (recipeIncomplete) {
      setError("Cada ingrediente de la receta necesita una cantidad mayor que 0.")
      return
    }

    // "none" evita el valor vacío del Select (que se trata como
    // "sin selección") y se normaliza antes de enviar.
    if (formData.get("categoryId") === "none") {
      formData.set("categoryId", "")
    }

    run(async () => {
      const created = await createProduct(formData)

      if (!created.ok) {
        return { ok: false, message: created.message }
      }

      if (!withRecipe) {
        return { ok: true }
      }

      const productId = created.data?.id

      // Si el producto ya se creó, no se deja el diálogo abierto: reintentar
      // crearía un duplicado. La receta se puede añadir desde la ficha.
      if (!productId) {
        toast.error("Producto creado, pero no se pudo guardar la receta")
        return { ok: true }
      }

      const recipe = await saveRecipe(productId, {
        variantId: null,
        ingredients: recipeRows,
      })

      if (!recipe.ok) {
        toast.error(
          `Producto creado, pero la receta falló: ${
            recipe.message ?? "añádela desde la ficha del producto"
          }`
        )
        return { ok: true }
      }

      toast.success("Producto y receta creados")
      return { ok: true }
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Nuevo producto</DialogTitle>
          <DialogDescription>
            El IVA del negocio se aplica automáticamente. Las variantes, extras y
            exclusiones se configuran después en la ficha del producto.
          </DialogDescription>
        </DialogHeader>

        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            void handleSubmit(new FormData(event.currentTarget))
          }}
        >
          <Tabs value={tab} onValueChange={setTab} className="gap-4">
            <TabsList>
              <TabsTrigger type="button" value="data">
                Datos
              </TabsTrigger>
              <TabsTrigger type="button" value="recipe">
                Receta
                {withRecipe && recipeRows.length > 0
                  ? ` (${recipeRows.length})`
                  : ""}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="data" keepMounted>
              <FieldGroup className="gap-4">
                <Field>
                  <FieldLabel htmlFor="product-name">Nombre</FieldLabel>
                  <Input
                    id="product-name"
                    name="name"
                    required
                    maxLength={120}
                    placeholder="Latte"
                  />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field>
                    <FieldLabel htmlFor="product-sku">SKU</FieldLabel>
                    <Input
                      id="product-sku"
                      name="sku"
                      maxLength={60}
                      placeholder="CAF-LAT"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="product-category">Categoría</FieldLabel>
                    <Select
                      name="categoryId"
                      defaultValue="none"
                      items={[
                        { value: "none", label: "Sin categoría" },
                        ...categories
                          .filter((category) => category.isActive)
                          .map((category) => ({
                            value: category.id,
                            label: category.name,
                          })),
                      ]}
                    >
                      <SelectTrigger
                        id="product-category"
                        className="w-full"
                        aria-label="Categoría"
                      >
                        <SelectValue placeholder="Sin categoría" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin categoría</SelectItem>
                        {categories
                          .filter((category) => category.isActive)
                          .map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>

                <Field>
                  <FieldLabel htmlFor="product-price">
                    Precio (IVA incl.)
                  </FieldLabel>
                  <Input
                    id="product-price"
                    name="price"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    placeholder="55.00"
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="product-description">
                    Descripción
                  </FieldLabel>
                  <Textarea
                    id="product-description"
                    name="description"
                    rows={3}
                    maxLength={500}
                    placeholder="Espresso con leche vaporizada"
                  />
                </Field>
              </FieldGroup>
            </TabsContent>

            <TabsContent value="recipe" keepMounted>
              <FieldGroup className="gap-4">
                <label className="flex items-start gap-2 rounded-lg border p-3 text-sm">
                  <Checkbox
                    checked={withRecipe}
                    onCheckedChange={(checked) => {
                      const next = checked === true
                      setWithRecipe(next)
                      if (next && rows.length === 0) addRow()
                      if (!next) setRows([])
                    }}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="font-medium">Añadir receta</span>
                    <span className="block text-xs text-muted-foreground">
                      Indica los ingredientes y cantidades que consume una venta.
                      Al empezar la comanda, el inventario se descuenta solo.
                    </span>
                  </span>
                </label>

                {!withRecipe ? (
                  <p className="text-sm text-muted-foreground">
                    Puedes crear el producto sin receta y añadirla después desde
                    su ficha.
                  </p>
                ) : (
                  <>
                    {rows.map((row, index) => (
                      <div
                        key={row.key}
                        className="grid gap-2 rounded-lg border p-2 sm:grid-cols-[minmax(0,2fr)_7rem_6rem_auto] sm:items-center sm:border-0 sm:p-0"
                      >
                        <Select
                          aria-label={`Ingrediente ${index + 1}`}
                          value={row.ingredientId || "none"}
                          onValueChange={(value) => {
                            const nextId = value === "none" ? "" : (value ?? "")
                            const ingredient = ingredients.find(
                              (candidate) => candidate.id === nextId
                            )
                            updateRow(row.key, {
                              ingredientId: nextId,
                              unit: ingredient?.baseUnit ?? "",
                            })
                          }}
                          items={[
                            { value: "none", label: "Elige un ingrediente" },
                            ...ingredients.map((ingredient) => ({
                              value: ingredient.id,
                              label: `${ingredient.name} (${unitLabel(ingredient.baseUnit)})`,
                            })),
                          ]}
                        >
                          <SelectTrigger
                            className="w-full"
                            aria-label={`Ingrediente ${index + 1}`}
                          >
                            <SelectValue placeholder="Elige un ingrediente" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">
                              Elige un ingrediente
                            </SelectItem>
                            {ingredients.map((ingredient) => (
                              <SelectItem
                                key={ingredient.id}
                                value={ingredient.id}
                              >
                                {ingredient.name} (
                                {unitLabel(ingredient.baseUnit)})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Input
                          aria-label={`Cantidad del ingrediente ${index + 1}`}
                          type="number"
                          min="0.0001"
                          step="0.0001"
                          placeholder="Cantidad"
                          value={row.quantity}
                          onChange={(event) =>
                            updateRow(row.key, {
                              quantity: event.target.value,
                            })
                          }
                        />

                        <Select
                          aria-label={`Unidad del ingrediente ${index + 1}`}
                          value={row.unit || "base"}
                          onValueChange={(value) =>
                            updateRow(row.key, {
                              unit: value === "base" ? "" : (value ?? ""),
                            })
                          }
                          items={[
                            { value: "base", label: "Unidad base" },
                            ...UNIT_CODES.map((code) => ({
                              value: code,
                              label: UNIT_LABELS[code],
                            })),
                          ]}
                        >
                          <SelectTrigger
                            className="w-full"
                            aria-label={`Unidad del ingrediente ${index + 1}`}
                          >
                            <SelectValue placeholder="Unidad base" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="base">Unidad base</SelectItem>
                            {UNIT_CODES.map((code) => (
                              <SelectItem key={code} value={code}>
                                {UNIT_LABELS[code]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Quitar ingrediente ${index + 1}`}
                          onClick={() => removeRow(row.key)}
                        >
                          <Trash2Icon />
                        </Button>
                      </div>
                    ))}

                    <div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addRow}
                      >
                        <PlusIcon />
                        Añadir ingrediente
                      </Button>
                    </div>

                    {ingredients.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No hay ingredientes en el inventario. Créalos en
                        Inventario y vuelve a intentarlo.
                      </p>
                    ) : null}
                  </>
                )}
              </FieldGroup>
            </TabsContent>
          </Tabs>

          {error ? <FieldError>{error}</FieldError> : null}

          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2Icon className="animate-spin" /> : null}
              Crear producto
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
