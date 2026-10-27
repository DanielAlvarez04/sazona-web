"use server"

import { mutateApi, type ActionResult } from "@/lib/server-api"

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
