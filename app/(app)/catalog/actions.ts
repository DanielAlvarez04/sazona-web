"use server"

import type { ImportResult, UnitCode } from "@/lib/catalog"
import { mutateApi, type ActionResult } from "@/lib/server-api"

const CATALOG_PATHS = ["/catalog"]
const productPaths = (itemId: string) => ["/catalog", `/catalog/${itemId}`]

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
      kind: text(formData, "kind") ?? "ARTICLE",
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

export async function createItem(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  return mutateApi<{ id: string }>(
    "/catalog/items",
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

export async function updateItem(
  itemId: string,
  formData: FormData
): Promise<ActionResult> {
  return mutateApi(
    `/catalog/items/${itemId}`,
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
    productPaths(itemId)
  )
}

export async function deactivateItem(id: string): Promise<ActionResult> {
  return mutateApi(`/catalog/items/${id}`, "DELETE", undefined, CATALOG_PATHS)
}

// ---------------------------------------------------------------------------
// Variantes
// ---------------------------------------------------------------------------

export async function createVariant(
  itemId: string,
  formData: FormData
): Promise<ActionResult> {
  return mutateApi(
    `/catalog/items/${itemId}/variants`,
    "POST",
    {
      name: text(formData, "name"),
      priceAdjust: numeric(formData, "priceAdjust") ?? 0,
      recipeFactor: numeric(formData, "recipeFactor") ?? 1,
    },
    productPaths(itemId)
  )
}

export async function updateVariant(
  itemId: string,
  variantId: string,
  formData: FormData
): Promise<ActionResult> {
  return mutateApi(
    `/catalog/items/${itemId}/variants/${variantId}`,
    "PATCH",
    {
      name: text(formData, "name"),
      priceAdjust: numeric(formData, "priceAdjust"),
      recipeFactor: numeric(formData, "recipeFactor"),
      isActive: checkbox(formData, "isActive"),
    },
    productPaths(itemId)
  )
}

export async function deactivateVariant(
  itemId: string,
  variantId: string
): Promise<ActionResult> {
  return mutateApi(
    `/catalog/items/${itemId}/variants/${variantId}`,
    "DELETE",
    undefined,
    productPaths(itemId)
  )
}

// ---------------------------------------------------------------------------
// Extras
// ---------------------------------------------------------------------------

export async function createExtra(
  itemId: string,
  formData: FormData
): Promise<ActionResult> {
  const ingredientId = text(formData, "ingredientId")

  return mutateApi(
    `/catalog/items/${itemId}/extras`,
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
    productPaths(itemId)
  )
}

export async function deactivateExtra(
  itemId: string,
  extraId: string
): Promise<ActionResult> {
  return mutateApi(
    `/catalog/items/${itemId}/extras/${extraId}`,
    "DELETE",
    undefined,
    productPaths(itemId)
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
  categoryId?: string | null
  price: number
  /** Clave del objeto en R2; `null` quita la imagen. */
  imageKey?: string | null
  variants?: Array<{
    name: string
    priceAdjust?: number
    recipeFactor?: number
    sortOrder?: number
    isActive?: boolean
    isPrimary?: boolean
  }>
}

export interface PresignImageInput {
  contentType: string
  size: number
}

export interface PresignedImage {
  key: string
  url: string
  /** URL firmada a la que el navegador hace el PUT. */
  uploadUrl: string
  method: "PUT"
  /** Cabeceras firmadas: hay que enviarlas tal cual. */
  headers: Record<string, string>
  expiresIn: number
  maxBytes: number
}

/**
 * Firma una subida directa del navegador a R2.
 *
 * La imagen va a la carpeta del artículo (`{org}/catalog/{itemId}/`), así que
 * el artículo debe existir: el diálogo lo guarda primero y luego sube la
 * imagen. No hay área temporal ni objetos huérfanos.
 */
export async function presignItemImage(
  itemId: string,
  input: PresignImageInput
): Promise<ActionResult<PresignedImage>> {
  return mutateApi<PresignedImage>(
    `/uploads/catalog/items/${itemId}`,
    "POST",
    input
  )
}

export async function createArticle(
  input: ArticleInput
): Promise<ActionResult<{ id: string }>> {
  return mutateApi<{ id: string }>("/catalog/items", "POST", input, [
    "/catalog",
  ])
}

export async function updateArticle(
  articleId: string,
  input: ArticleInput
): Promise<ActionResult> {
  return mutateApi(`/catalog/items/${articleId}`, "PATCH", input, [
    "/catalog",
  ])
}

/**
 * Guarda o quita la imagen de un artículo ya creado.
 *
 * La API valida que la clave esté en la carpeta del artículo, comprueba el
 * tamaño real y borra la imagen anterior del bucket.
 */
export async function updateArticleImage(
  articleId: string,
  imageKey: string | null
): Promise<ActionResult> {
  return mutateApi(`/catalog/items/${articleId}`, "PATCH", { imageKey }, [
    "/catalog",
  ])
}

// ---------------------------------------------------------------------------
// Exclusiones y combos
// ---------------------------------------------------------------------------

export async function replaceExclusions(
  itemId: string,
  ingredientIds: string[]
): Promise<ActionResult> {
  return mutateApi(
    `/catalog/items/${itemId}/exclusions`,
    "PUT",
    { exclusions: ingredientIds.map((ingredientId) => ({ ingredientId })) },
    productPaths(itemId)
  )
}

export interface ComboComponentInput {
  itemId: string
  variantId?: string
  quantity: number
}

export async function replaceComboComponents(
  itemId: string,
  components: ComboComponentInput[]
): Promise<ActionResult> {
  return mutateApi(
    `/catalog/items/${itemId}/combo-components`,
    "PUT",
    { components },
    productPaths(itemId)
  )
}

// ---------------------------------------------------------------------------
// Importación CSV
// ---------------------------------------------------------------------------

export async function importItems(
  csv: string,
  dryRun: boolean
): Promise<ActionResult<ImportResult>> {
  return mutateApi<ImportResult>(
    "/catalog/items/import",
    "POST",
    { csv, dryRun },
    dryRun ? [] : CATALOG_PATHS
  )
}

