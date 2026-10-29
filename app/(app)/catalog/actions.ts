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
// Artículos
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
      recipeFactor: numeric(formData, "recipeFactor") ?? 1,
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
      recipeFactor: numeric(formData, "recipeFactor"),
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
// Recetas
// ---------------------------------------------------------------------------

export interface RecipeIngredientInput {
  ingredientId: string
  quantity: number
  unit?: UnitCode
  label?: string
  isOptional?: boolean
  alternatives?: Array<{
    ingredientId: string
    quantity: number
    unit?: UnitCode
  }>
}

export interface RecipePublishInput {
  price: number
  sku?: string
  categoryId?: string
  taxRate?: number | null
  variants?: Array<{
    name: string
    priceAdjust?: number
    recipeFactor?: number
    sortOrder?: number
    isActive?: boolean
  }>
}

export interface RecipeInput {
  name: string
  description?: string
  categoryId?: string | null
  isActive?: boolean
  ingredients?: RecipeIngredientInput[]
  publish?: RecipePublishInput
  produce?: { displayUnit: UnitCode; yieldQuantity: number }
}

export async function createRecipe(
  input: RecipeInput
): Promise<ActionResult<{ id: string }>> {
  return mutateApi<{ id: string }>("/catalog/recipes", "POST", input, [
    "/catalog",
  ])
}

export async function updateRecipe(
  recipeId: string,
  input: Partial<RecipeInput>
): Promise<ActionResult> {
  return mutateApi(`/catalog/recipes/${recipeId}`, "PATCH", input, [
    "/catalog",
  ])
}

export async function updateRecipeIngredients(
  recipeId: string,
  ingredients: RecipeIngredientInput[]
): Promise<ActionResult> {
  return mutateApi(
    `/catalog/recipes/${recipeId}/ingredients`,
    "PUT",
    { ingredients },
    ["/catalog"]
  )
}

export async function deleteRecipe(recipeId: string): Promise<ActionResult> {
  return mutateApi(`/catalog/recipes/${recipeId}`, "DELETE", undefined, [
    "/catalog",
  ])
}

export async function publishRecipe(
  recipeId: string,
  input: RecipePublishInput
): Promise<ActionResult> {
  return mutateApi(
    `/catalog/recipes/${recipeId}/publish`,
    "POST",
    input,
    ["/catalog"]
  )
}

export async function unpublishRecipe(
  recipeId: string
): Promise<ActionResult> {
  return mutateApi(
    `/catalog/recipes/${recipeId}/publish`,
    "DELETE",
    undefined,
    ["/catalog"]
  )
}

export async function produceRecipe(
  recipeId: string,
  input: { quantity?: number; unit?: UnitCode; reason?: string }
): Promise<ActionResult> {
  return mutateApi(
    `/catalog/recipes/${recipeId}/produce`,
    "POST",
    input,
    ["/catalog", "/inventory"]
  )
}

// ---------------------------------------------------------------------------
// Artículos
// ---------------------------------------------------------------------------

export interface ArticleInput {
  name: string
  description?: string | null
  sku?: string | null
  categoryId?: string | null
  price: number
  taxRate?: number | null
  isActive?: boolean
  variants?: Array<{
    name: string
    priceAdjust?: number
    recipeFactor?: number
    sortOrder?: number
    isActive?: boolean
  }>
}

export async function createArticle(
  input: ArticleInput
): Promise<ActionResult<{ id: string }>> {
  return mutateApi<{ id: string }>("/catalog/products", "POST", input, [
    "/catalog",
  ])
}

export async function updateArticle(
  articleId: string,
  input: ArticleInput
): Promise<ActionResult> {
  return mutateApi(`/catalog/products/${articleId}`, "PATCH", input, [
    "/catalog",
  ])
}

// ---------------------------------------------------------------------------
// Exclusiones y combos
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

