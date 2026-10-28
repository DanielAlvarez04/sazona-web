"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { Loader2Icon, PlusIcon, SaveIcon, Trash2Icon } from "lucide-react"

import { deleteRecipe, saveRecipe } from "@/app/(app)/catalog/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { FieldError } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useActionForm } from "@/hooks/use-action-form"
import {
  UNIT_CODES,
  UNIT_LABELS,
  unitLabel,
  type Ingredient,
  type ProductDetail,
  type Recipe,
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
  return `recipe-row-${rowCounter}`
}

function rowsFrom(recipe: Recipe | undefined): RecipeRow[] {
  if (!recipe) return []

  return recipe.ingredients.map((item) => ({
    key: nextKey(),
    ingredientId: item.ingredient.id,
    quantity: item.quantity,
    unit: item.ingredient.baseUnit,
  }))
}

export function ProductRecipes({
  product,
  ingredients,
  canManage,
}: {
  product: ProductDetail
  ingredients: Ingredient[]
  canManage: boolean
}) {
  const baseRecipe = product.recipes.find((recipe) => recipe.variantId === null)

  // Una receta de variante sustituye a la base solo para esa variante.
  const slots: Array<{
    variantId: string | null
    title: string
    hint: string
    recipe: Recipe | undefined
  }> = [
    {
      variantId: null,
      title: "Receta base",
      hint: "Se usa cuando el producto no tiene una receta propia para la variante elegida.",
      recipe: baseRecipe,
    },
    ...product.variants.map((variant) => ({
      variantId: variant.id,
      title: `Variante · ${variant.name}`,
      hint: "Si existe, sustituye a la receta base al vender esta variante.",
      recipe: product.recipes.find((recipe) => recipe.variantId === variant.id),
    })),
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recetas y consumo</CardTitle>
        <CardDescription>
          Las cantidades se guardan en la unidad base de cada ingrediente. Al
          preparar un pedido, el inventario se descuenta con esta receta.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {slots.map((slot) => (
          <RecipeEditor
            key={`${slot.variantId ?? "base"}-${slot.recipe?.id ?? "nueva"}`}
            productId={product.id}
            variantId={slot.variantId}
            title={slot.title}
            hint={slot.hint}
            recipe={slot.recipe}
            ingredients={ingredients}
            canManage={canManage}
          />
        ))}
      </CardContent>
    </Card>
  )
}

function RecipeEditor({
  productId,
  variantId,
  title,
  hint,
  recipe,
  ingredients,
  canManage,
}: {
  productId: string
  variantId: string | null
  title: string
  hint: string
  recipe: Recipe | undefined
  ingredients: Ingredient[]
  canManage: boolean
}) {
  const router = useRouter()
  const saveForm = useActionForm(() => router.refresh())
  const deleteForm = useActionForm(() => router.refresh())
  const [rows, setRows] = useState<RecipeRow[]>(() => rowsFrom(recipe))

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

  function save() {
    const payload = rows
      .filter((row) => row.ingredientId)
      .map((row) => ({
        ingredientId: row.ingredientId,
        quantity: Number(row.quantity.replace(",", ".")),
        ...(row.unit ? { unit: row.unit as (typeof UNIT_CODES)[number] } : {}),
      }))

    saveForm.run(() =>
      saveRecipe(productId, { variantId, ingredients: payload })
    )
  }

  const pending = saveForm.pending || deleteForm.pending

  return (
    <div className="flex flex-col gap-3 rounded-md border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium">{title}</p>
            {recipe ? (
              <Badge variant="secondary">Guardada</Badge>
            ) : (
              <Badge variant="outline">Sin receta</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>

        {canManage && recipe ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => {
              if (!window.confirm(`¿Eliminar la receta "${recipe.name}"?`)) {
                return
              }
              deleteForm.run(() => deleteRecipe(productId, recipe.id))
            }}
          >
            {deleteForm.pending ? (
              <Loader2Icon className="animate-spin" />
            ) : (
              <Trash2Icon />
            )}
            Eliminar receta
          </Button>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Sin ingredientes. Añade al menos uno para poder calcular el consumo.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((row) => (
            <div
              key={row.key}
              className="grid gap-2 sm:grid-cols-[minmax(0,2fr)_7rem_6rem_auto]"
            >
              <Select
                aria-label="Ingrediente de la receta"
                value={row.ingredientId || "none"}
                disabled={!canManage}
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
                <SelectTrigger className="w-full" aria-label="Ingrediente">
                  <SelectValue placeholder="Elige un ingrediente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Elige un ingrediente</SelectItem>
                  {ingredients.map((ingredient) => (
                    <SelectItem key={ingredient.id} value={ingredient.id}>
                      {ingredient.name} ({unitLabel(ingredient.baseUnit)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                aria-label="Cantidad"
                type="number"
                min="0.0001"
               
                placeholder="Cantidad"
                value={row.quantity}
                disabled={!canManage}
                onChange={(event) =>
                  updateRow(row.key, { quantity: event.target.value })
                }
              />

              <Select
                aria-label="Unidad"
                value={row.unit || "base"}
                disabled={!canManage}
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
                <SelectTrigger className="w-full" aria-label="Unidad">
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

              {canManage ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Quitar ingrediente de la receta"
                  onClick={() => removeRow(row.key)}
                >
                  <Trash2Icon />
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {canManage ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={addRow}>
            <PlusIcon />
            Añadir ingrediente
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={pending || rows.every((row) => !row.ingredientId)}
            onClick={save}
          >
            {saveForm.pending ? (
              <Loader2Icon className="animate-spin" />
            ) : (
              <SaveIcon />
            )}
            {recipe ? "Reemplazar receta" : "Crear receta"}
          </Button>
        </div>
      ) : null}

      {saveForm.error ? <FieldError>{saveForm.error}</FieldError> : null}
      {deleteForm.error ? <FieldError>{deleteForm.error}</FieldError> : null}
    </div>
  )
}
