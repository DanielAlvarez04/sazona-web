"use server"

import { cookies } from "next/headers"

import { BRANCH_COOKIE } from "@/lib/api"
import { mutateApi, type ActionResult } from "@/lib/server-api"

function text(formData: FormData, key: string): string | undefined {
  const value = formData.get(key)
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed === "" ? undefined : trimmed
}

export async function renameOrganization(
  formData: FormData
): Promise<ActionResult> {
  const nameValue = formData.get("name")
  const domainValue = formData.get("domain")

  const name = typeof nameValue === "string" ? nameValue.trim() : ""
  const domain =
    typeof domainValue === "string" && domainValue.trim().length > 0
      ? domainValue.trim()
      : undefined

  if (name.length < 2) {
    return { ok: false, message: "Escribe un nombre de al menos 2 caracteres." }
  }

  return mutateApi(
    "/organizations/current",
    "PATCH",
    { name, domain },
    ["/settings", "/dashboard"]
  )
}

/**
 * Cambia el IVA del negocio.
 *
 * El formulario trabaja en porcentaje (16) y la API guarda la fracción (0.16).
 */
export async function updateOrganizationTaxRate(
  formData: FormData
): Promise<ActionResult> {
  const raw = formData.get("taxRate")
  const percent =
    typeof raw === "string" ? Number(raw.replace(",", ".")) : Number.NaN

  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    return { ok: false, message: "Escribe un IVA entre 0 y 100." }
  }

  return mutateApi(
    "/organizations/current",
    "PATCH",
    { taxRate: percent / 100 },
    ["/settings", "/catalog", "/dashboard"]
  )
}

const BRANCH_PATHS = ["/settings", "/users"]

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

/** Actualiza nombre, dirección o teléfono de una sucursal. */
export async function updateBranch(
  formData: FormData
): Promise<ActionResult> {
  const id = text(formData, "id")
  const name = text(formData, "name")

  if (!id) {
    return { ok: false, message: "Sucursal no encontrada." }
  }

  if (!name || name.length < 2) {
    return { ok: false, message: "Escribe el nombre de la sucursal." }
  }

  return mutateApi(
    `/branches/${id}`,
    "PATCH",
    {
      name,
      address: text(formData, "address") ?? "",
      phone: text(formData, "phone") ?? "",
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
