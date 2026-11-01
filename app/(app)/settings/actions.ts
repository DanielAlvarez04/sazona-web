"use server"

import { cookies } from "next/headers"

import { BRANCH_COOKIE } from "@/lib/api"
import type { UnitCode } from "@/lib/catalog"
import { CORE_PRODUCT_GROUPS } from "@/lib/core-products"
import { mutateApi, type ActionResult } from "@/lib/server-api"

function text(formData: FormData, key: string): string | undefined {
  const value = formData.get(key)
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed === "" ? undefined : trimmed
}

/** Activa/desactiva todas las categorías core de inventario. */
export async function setCoreIngredientCategoriesActive(
  isActive: boolean
): Promise<ActionResult> {
  return mutateApi(
    "/inventory/ingredient-categories/bulk/core-status",
    "PATCH",
    { isActive },
    ["/settings", "/inventory"]
  )
}

/** Activa/desactiva la sección de insumos core sugeridos. */
export async function setUseCoreSuggestions(
  enabled: boolean
): Promise<ActionResult> {
  return mutateApi(
    "/organizations/current",
    "PATCH",
    { useCoreSuggestions: enabled },
    ["/settings", "/inventory"]
  )
}

/** Activa/desactiva todas las categorías core de un tipo. */
export async function setCoreCategoryGroupActive(
  kind: "ARTICLE" | "RECIPE",
  isActive: boolean
): Promise<ActionResult> {
  return mutateApi(
    "/catalog/categories/bulk/core-status",
    "PATCH",
    { kind, isActive },
    ["/settings", "/catalog"]
  )
}

export interface OrganizationNameInput {
  name?: string
  domain?: string
}

export async function renameOrganization(
  input: OrganizationNameInput
): Promise<ActionResult> {
  const name = input.name?.trim()
  const domain = input.domain?.trim()

  if (name !== undefined && name.length < 2) {
    return { ok: false, message: "Escribe un nombre de al menos 2 caracteres." }
  }

  return mutateApi(
    "/organizations/current",
    "PATCH",
    {
      ...(name !== undefined ? { name } : {}),
      ...(domain !== undefined ? { domain } : {}),
    },
    ["/settings", "/dashboard"]
  )
}

/**
 * Cambia el IVA del negocio.
 *
 * Recibe la fracción (`0.16`), no el porcentaje: la conversión se hace en el
 * formulario para poder comparar contra el valor actual.
 */
export async function updateOrganizationTaxRate(
  taxRate: number
): Promise<ActionResult> {
  if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 1) {
    return { ok: false, message: "Escribe un IVA entre 0 y 100." }
  }

  return mutateApi(
    "/organizations/current",
    "PATCH",
    { taxRate },
    ["/settings", "/catalog", "/dashboard"]
  )
}

const BRANCH_PATHS = ["/settings", "/users"]

export interface CoreInventorySyncResult {
  created: string[]
  removed: string[]
  skipped: Array<{ name: string; reason: string }>
}

/**
 * Guarda en el inventario los insumos core seleccionados.
 *
 * El catálogo vive en el web; aquí se envía a la API qué insumos deben
 * existir y qué nombres del catálogo quedaron desmarcados. La API crea los
 * que faltan y desactiva los desmarcados solo si no tienen cambios.
 */
export async function saveCoreInventory(
  selectedNames: string[],
  createMissing = true
): Promise<ActionResult<CoreInventorySyncResult>> {
  const selected = new Set(selectedNames)
  const catalog = new Map<
    string,
    { name: string; displayUnit: UnitCode; category: string; location: string }
  >()

  // Un mismo nombre puede aparecer en dos categorías del catálogo; se manda
  // una sola vez para respetar la unicidad del insumo.
  for (const group of CORE_PRODUCT_GROUPS) {
    for (const product of group.products) {
      if (catalog.has(product.name)) continue

      catalog.set(product.name, {
        name: product.name,
        displayUnit: product.unit,
        category: group.category,
        location: product.location,
      })
    }
  }

  const products = createMissing
    ? [...selected]
        .filter((name) => catalog.has(name))
        .map((name) => catalog.get(name)!)
    : []

  const removeProducts = [...catalog.values()].filter(
    (product) => !selected.has(product.name)
  )

  return mutateApi<CoreInventorySyncResult>(
    "/inventory/ingredients/sync-core",
    "POST",
    { products, removeNames: [], removeProducts },
    ["/settings", "/inventory"]
  )
}

/** Crea una sucursal. El límite de uso justo se valida también en la API. */
export async function createBranch(
  formData: FormData
): Promise<ActionResult> {
  const name = text(formData, "name")

  if (!name || name.length < 2) {
    return { ok: false, message: "Escribe el nombre de la sucursal." }
  }

  return mutateApi(
    "/branches",
    "POST",
    {
      name,
      address: text(formData, "address") ?? "",
      phone: text(formData, "phone") ?? "",
    },
    BRANCH_PATHS
  )
}

/** Actualiza solo los campos enviados de una sucursal. */
export interface BranchUpdateInput {
  name?: string
  address?: string
  phone?: string
  isActive?: boolean
}

export async function updateBranch(
  id: string,
  input: Partial<BranchUpdateInput>
): Promise<ActionResult> {
  if (!id) {
    return { ok: false, message: "Sucursal no encontrada." }
  }

  const name = input.name?.trim()

  if (name !== undefined && name.length < 2) {
    return { ok: false, message: "Escribe el nombre de la sucursal." }
  }

  return mutateApi(
    `/branches/${id}`,
    "PATCH",
    {
      ...input,
      ...(name !== undefined ? { name } : {}),
    },
    BRANCH_PATHS
  )
}

/** Activa o desactiva una sucursal (no se borra para conservar historial). */
export async function setBranchActive(
  formData: FormData
): Promise<ActionResult> {
  const id = text(formData, "id")
  const isActive = formData.get("isActive") === "true"

  if (!id) {
    return { ok: false, message: "Sucursal no encontrada." }
  }

  const result = await mutateApi(
    `/branches/${id}`,
    "PATCH",
    { isActive },
    BRANCH_PATHS
  )

  // Si se desactiva la sucursal en la que estaba trabajando la sesión, se
  // vuelve a la vista consolidada para no dejar la cookie apuntando a un local
  // inactivo (la API rechazaría todas las peticiones de negocio).
  if (result.ok && !isActive) {
    const store = await cookies()

    if (store.get(BRANCH_COOKIE)?.value === id) {
      store.delete(BRANCH_COOKIE)
    }
  }

  return result
}
