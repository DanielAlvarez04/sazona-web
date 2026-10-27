"use server"

import type { ImportResult, UnitCode } from "@/lib/catalog"
import { mutateApi, type ActionResult } from "@/lib/server-api"

const CATALOG_PATHS = ["/catalog"]
const productPaths = (productId: string) => ["/catalog", `/catalog/${productId}`]

function text(formData: FormData, key: string): string | undefined {
  const value = formData.get(key)
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed === "" ? undefined : trimmed
}

function numeric(formData: FormData, key: string): number | undefined {
  const value = text(formData, key)
  if (value === undefined) return undefined
  const parsed = Number(value.replace(",", "."))
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

function checkbox(formData: FormData, key: string): boolean {
  return formData.get(key) === "on"
}

// ---------------------------------------------------------------------------
// Categorías
// ---------------------------------------------------------------------------

export async function createCategory(
  formData: FormData
): Promise<ActionResult> {
  return mutateApi(
    "/catalog/categories",
    "POST",
    {
      name: text(formData, "name"),
      description: text(formData, "description"),
    },
    CATALOG_PATHS
  )
}

export async function deactivateCategory(id: string): Promise<ActionResult> {
  return mutateApi(
    `/catalog/categories/${id}`,
    "DELETE",
    undefined,
    CATALOG_PATHS
  )
}

// ---------------------------------------------------------------------------
// Productos
// ---------------------------------------------------------------------------

export async function createProduct(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  return mutateApi<{ id: string }>(
    "/catalog/products",
    "POST",
    {
      name: text(formData, "name"),
      description: text(formData, "description"),
      sku: text(formData, "sku"),
      categoryId: text(formData, "categoryId"),
      price: numeric(formData, "price"),
    },
    CATALOG_PATHS
  )
}

export async function updateProduct(
  productId: string,
  formData: FormData
): Promise<ActionResult> {
  return mutateApi(
    `/catalog/products/${productId}`,
    "PATCH",
    {
      name: text(formData, "name"),
      description: text(formData, "description") ?? null,
      sku: text(formData, "sku") ?? null,
      categoryId: text(formData, "categoryId") ?? null,
      price: numeric(formData, "price"),
      isCombo: checkbox(formData, "isCombo"),
      isActive: checkbox(formData, "isActive"),
    },
    productPaths(productId)
  )
}

export async function deactivateProduct(id: string): Promise<ActionResult> {
  return mutateApi(`/catalog/products/${id}`, "DELETE", undefined, CATALOG_PATHS)
}

// ---------------------------------------------------------------------------
// Variantes
// ---------------------------------------------------------------------------

export async function createVariant(
  productId: string,
  formData: FormData
): Promise<ActionResult> {
  return mutateApi(
    `/catalog/products/${productId}/variants`,
    "POST",
    {
      name: text(formData, "name"),
      priceAdjust: numeric(formData, "priceAdjust") ?? 0,
    },
    productPaths(productId)
  )
}

export async function updateVariant(
  productId: string,
  variantId: string,
  formData: FormData
): Promise<ActionResult> {
  return mutateApi(
    `/catalog/products/${productId}/variants/${variantId}`,
    "PATCH",
    {
      name: text(formData, "name"),
      priceAdjust: numeric(formData, "priceAdjust"),
      isActive: checkbox(formData, "isActive"),
    },
    productPaths(productId)
  )
}

export async function deactivateVariant(
  productId: string,
  variantId: string
): Promise<ActionResult> {
  return mutateApi(
    `/catalog/products/${productId}/variants/${variantId}`,
    "DELETE",
    undefined,
    productPaths(productId)
  )
}

// ---------------------------------------------------------------------------
// Extras
// ---------------------------------------------------------------------------

export async function createExtra(
  productId: string,
  formData: FormData
): Promise<ActionResult> {
  const ingredientId = text(formData, "ingredientId")

  return mutateApi(
    `/catalog/products/${productId}/extras`,
    "POST",
    {
      name: text(formData, "name"),
      price: numeric(formData, "price"),
      ...(ingredientId
        ? {
            ingredients: [
              {
                ingredientId,
                quantity: numeric(formData, "quantity"),
                unit: text(formData, "unit") as UnitCode | undefined,
              },
            ],
          }
        : {}),
    },
    productPaths(productId)
  )
}

export async function deactivateExtra(
  productId: string,
  extraId: string
): Promise<ActionResult> {
  return mutateApi(
    `/catalog/products/${productId}/extras/${extraId}`,
    "DELETE",
    undefined,
    productPaths(productId)
  )
}

// ---------------------------------------------------------------------------
// Exclusiones, combos y recetas
// ---------------------------------------------------------------------------

export async function replaceExclusions(
  productId: string,
  ingredientIds: string[]
): Promise<ActionResult> {
  return mutateApi(
    `/catalog/products/${productId}/exclusions`,
    "PUT",
    { exclusions: ingredientIds.map((ingredientId) => ({ ingredientId })) },
    productPaths(productId)
  )
}

export interface ComboComponentInput {
  productId: string
  variantId?: string
  quantity: number
}

export async function replaceComboComponents(
  productId: string,
  components: ComboComponentInput[]
): Promise<ActionResult> {
  return mutateApi(
    `/catalog/products/${productId}/combo-components`,
    "PUT",
    { components },
    productPaths(productId)
  )
}

export interface RecipeInput {
  variantId: string | null
  name?: string
  ingredients: Array<{ ingredientId: string; quantity: number; unit?: UnitCode }>
}

export async function saveRecipe(
  productId: string,
  input: RecipeInput
): Promise<ActionResult> {
  return mutateApi(
    `/catalog/products/${productId}/recipes`,
    "PUT",
    {
      variantId: input.variantId,
      name: input.name,
      ingredients: input.ingredients,
    },
    productPaths(productId)
  )
}

export async function deleteRecipe(
  productId: string,
  recipeId: string
): Promise<ActionResult> {
  return mutateApi(
    `/catalog/products/${productId}/recipes/${recipeId}`,
    "DELETE",
    undefined,
    productPaths(productId)
  )
}

// ---------------------------------------------------------------------------
// Importación CSV
// ---------------------------------------------------------------------------

export async function importProducts(
  csv: string,
  dryRun: boolean
): Promise<ActionResult<ImportResult>> {
  return mutateApi<ImportResult>(
    "/catalog/products/import",
    "POST",
    { csv, dryRun },
    dryRun ? [] : CATALOG_PATHS
  )
}
