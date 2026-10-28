"use server"

import { apiFetch } from "@/lib/api"
import type { Equivalence, UnitCode } from "@/lib/catalog"
import { apiErrorMessage } from "@/lib/http-error"
import { mutateApi, type ActionResult } from "@/lib/server-api"
import { requireUser } from "@/lib/session"

const INVENTORY_PATHS = ["/inventory"]

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

export async function createIngredient(
  formData: FormData
): Promise<ActionResult> {
  return mutateApi(
    "/inventory/ingredients",
    "POST",
    {
      name: text(formData, "name"),
      baseUnit: text(formData, "baseUnit") as UnitCode,
      categoryId: text(formData, "categoryId"),
      locationId: text(formData, "locationId"),
      unitCost: numeric(formData, "unitCost"),
      maxStock: numeric(formData, "maxStock"),
      currentStock: numeric(formData, "currentStock") ?? 0,
      minStock: numeric(formData, "minStock") ?? 0,
    },
    INVENTORY_PATHS
  )
}

export interface BulkIngredientInput {
  name: string
  baseUnit: UnitCode
  /** Obligatoria: define el prefijo del SKU generado. */
  categoryId: string
  locationId?: string
  unitCost?: number
  maxStock?: number
  currentStock: number
  minStock: number
}

/** Alta masiva de ingredientes (una sola llamada, validada en la API). */
export async function createIngredientsBulk(
  ingredients: BulkIngredientInput[]
): Promise<ActionResult> {
  return mutateApi(
    "/inventory/ingredients/bulk",
    "POST",
    { ingredients },
    INVENTORY_PATHS
  )
}

export async function updateIngredient(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  return mutateApi(
    `/inventory/ingredients/${id}`,
    "PATCH",
    {
      name: text(formData, "name"),
      baseUnit: text(formData, "baseUnit") as UnitCode,
      categoryId: text(formData, "categoryId"),
      locationId: text(formData, "locationId"),
      unitCost: numeric(formData, "unitCost"),
      maxStock: numeric(formData, "maxStock"),
      minStock: numeric(formData, "minStock"),
      isActive: formData.get("isActive") === "on",
    },
    INVENTORY_PATHS
  )
}

export async function deactivateIngredient(id: string): Promise<ActionResult> {
  return mutateApi(
    `/inventory/ingredients/${id}`,
    "DELETE",
    undefined,
    INVENTORY_PATHS
  )
}

/**
 * Reactiva un insumo desactivado.
 *
 * El PATCH del API pone `locationId` a `null` cuando no se envía, así que hay
 * que reenviar la ubicación actual para no perderla.
 */
export async function activateIngredient(
  id: string,
  locationId?: string | null
): Promise<ActionResult> {
  return mutateApi(
    `/inventory/ingredients/${id}`,
    "PATCH",
    { isActive: true, locationId: locationId ?? "" },
    INVENTORY_PATHS
  )
}

export interface AdjustmentInput {
  ingredientId: string
  /** Cantidad con signo; negativa para salidas. */
  quantity: string
  unit?: UnitCode
  reason: string
  dedupeKey?: string
}

export async function adjustStock(
  input: AdjustmentInput
): Promise<ActionResult> {
  return mutateApi(
    "/inventory/movements",
    "POST",
    {
      ingredientId: input.ingredientId,
      quantity: input.quantity,
      unit: input.unit,
      reason: input.reason,
      ...(input.dedupeKey ? { dedupeKey: input.dedupeKey } : {}),
    },
    INVENTORY_PATHS
  )
}

export interface EquivalenceInput {
  fromUnit: UnitCode
  toUnit: UnitCode
  factor: number
  note?: string
}

export async function createEquivalence(
  ingredientId: string,
  input: EquivalenceInput
): Promise<ActionResult> {
  return mutateApi(
    `/inventory/ingredients/${ingredientId}/equivalences`,
    "POST",
    input,
    INVENTORY_PATHS
  )
}

/**
 * Lectura bajo demanda para el diálogo de equivalencias (no se puede llamar a
 * la API desde el navegador porque la sesión vive en cookies httpOnly).
 */
export async function getEquivalences(
  ingredientId: string
): Promise<ActionResult<Equivalence[]>> {
  await requireUser()

  try {
    const response = await apiFetch(
      `/inventory/ingredients/${ingredientId}/equivalences`
    )
    const text = await response.text()
    let payload: unknown = null

    try {
      payload = text ? JSON.parse(text) : null
    } catch {
      payload = null
    }

    if (!response.ok) {
      return {
        ok: false,
        message: apiErrorMessage(
          payload,
          "No se pudieron cargar las equivalencias"
        ),
      }
    }

    return { ok: true, data: payload as Equivalence[] }
  } catch {
    return {
      ok: false,
      message: "No se pudo contactar con la API. Inténtalo de nuevo.",
    }
  }
}

export async function deleteEquivalence(
  ingredientId: string,
  equivalenceId: string
): Promise<ActionResult> {
  return mutateApi(
    `/inventory/ingredients/${ingredientId}/equivalences/${equivalenceId}`,
    "DELETE",
    undefined,
    INVENTORY_PATHS
  )
}

/** Importa ingredientes desde CSV. */
export async function importIngredientsFromCsv(
  csv: string
): Promise<ActionResult> {
  return mutateApi(
    "/inventory/ingredients/import-csv",
    "POST",
    { csv },
    INVENTORY_PATHS
  )
}

/** Lista categorías de ingredientes de la organización. */
export async function listIngredientCategories(): Promise<
  ActionResult<Array<{ id: string; name: string; description: string | null; isCore: boolean; isActive: boolean; sortOrder: number }>>
> {
  await requireUser()
  try {
    const response = await apiFetch("/inventory/ingredient-categories")
    const text = await response.text()
    let payload: unknown = null
    try {
      payload = text ? JSON.parse(text) : null
    } catch {
      payload = null
    }
    if (!response.ok) {
      return {
        ok: false,
        message: "No se pudieron cargar las categorías de ingredientes",
      }
    }
    return { ok: true, data: payload as Array<{ id: string; name: string; description: string | null; isCore: boolean; isActive: boolean; sortOrder: number }> }
  } catch {
    return { ok: false, message: "No se pudo contactar con la API" }
  }
}

/** Lista ubicaciones de ingredientes de la organización. */
export async function listIngredientLocations(): Promise<
  ActionResult<Array<{ id: string; name: string; description: string | null; isCore: boolean; isActive: boolean; sortOrder: number }>>
> {
  await requireUser()
  try {
    const response = await apiFetch("/inventory/ingredient-locations")
    const text = await response.text()
    let payload: unknown = null
    try {
      payload = text ? JSON.parse(text) : null
    } catch {
      payload = null
    }
    if (!response.ok) {
      return {
        ok: false,
        message: "No se pudieron cargar las ubicaciones de ingredientes",
      }
    }
    return { ok: true, data: payload as Array<{ id: string; name: string; description: string | null; isCore: boolean; isActive: boolean; sortOrder: number }> }
  } catch {
    return { ok: false, message: "No se pudo contactar con la API" }
  }
}
