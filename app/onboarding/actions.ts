"use server"

import { apiFetch } from "@/lib/api"
import type { DomainAvailability } from "@/lib/domain"
import { apiErrorMessage } from "@/lib/http-error"
import { requireUser } from "@/lib/session"
import { mutateApi, type ActionResult } from "@/lib/server-api"

function text(formData: FormData, key: string): string | undefined {
  const value = formData.get(key)
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed === "" ? undefined : trimmed
}

function textArray(formData: FormData, key: string): string[] {
  const value = formData.get(key)
  if (typeof value !== "string") return []
  return value.split(",").map((v) => v.trim()).filter(Boolean)
}

/** Paso 1: giro principal del negocio. */
export async function updateOnboardingBusinessType(
  formData: FormData
): Promise<ActionResult> {
  const businessType = text(formData, "businessType")

  if (!businessType) {
    return { ok: false, message: "Selecciona el giro principal de tu negocio." }
  }

  return mutateApi(
    "/organizations/current",
    "PATCH",
    { businessType },
    ["/onboarding", "/dashboard", "/settings"]
  )
}

/** Paso 2: datos del negocio (nombre, dominio, sucursales). */
export async function updateOnboardingBusiness(
  formData: FormData
): Promise<ActionResult> {
  const name = text(formData, "name")
  const domain = text(formData, "domain")
  const hasBranches = formData.get("hasBranches") === "true"

  if (!name || name.length < 2) {
    return { ok: false, message: "Escribe el nombre de tu negocio." }
  }

  if (!domain) {
    return { ok: false, message: "Escribe el dominio de tu negocio." }
  }

  return mutateApi(
    "/organizations/current",
    "PATCH",
    { name, domain, hasBranches },
    ["/onboarding", "/dashboard", "/settings"]
  )
}

/** Comprueba si el dominio está libre entre las organizaciones. */
export async function checkDomainAvailability(
  domain: string
): Promise<DomainAvailability> {
  await requireUser()

  const response = await apiFetch(
    `/organizations/domain-available?domain=${encodeURIComponent(domain)}`
  )

  if (!response.ok) {
    throw new Error(
      apiErrorMessage(
        await response.json().catch(() => null),
        "No pudimos verificar el dominio"
      )
    )
  }

  return (await response.json()) as DomainAvailability
}

/** Paso 3: datos del usuario (nombre, apellido, usuario). */
export async function updateOnboardingProfile(
  formData: FormData
): Promise<ActionResult> {
  const firstName = text(formData, "firstName")
  const lastName = text(formData, "lastName")
  const username = text(formData, "username")

  if (!firstName) {
    return { ok: false, message: "Escribe tu nombre." }
  }

  if (!lastName) {
    return { ok: false, message: "Escribe tu apellido." }
  }

  if (!username) {
    return { ok: false, message: "Elige un nombre de usuario." }
  }

  const fullName = `${firstName} ${lastName}`.trim()

  return mutateApi(
    "/auth/me",
    "PATCH",
    { name: fullName, username },
    ["/onboarding"]
  )
}

/** Paso 4: tipo de servicio (skippable, multiple). */
export async function updateOnboardingServiceTypes(
  formData: FormData
): Promise<ActionResult> {
  const serviceTypes = textArray(formData, "serviceTypes")

  return mutateApi(
    "/organizations/current",
    "PATCH",
    { serviceTypes },
    ["/onboarding", "/dashboard", "/settings"]
  )
}

/** Paso 5: objetivos del negocio (skippable, multiple). */
export async function updateOnboardingGoals(
  formData: FormData
): Promise<ActionResult> {
  const goals = textArray(formData, "goals")

  return mutateApi(
    "/organizations/current",
    "PATCH",
    { goals },
    ["/onboarding", "/dashboard", "/settings"]
  )
}

/** Paso final: marca el onboarding como completado. */
export async function finishOnboarding(): Promise<ActionResult> {
  return mutateApi("/auth/onboarding/complete", "POST", undefined, [
    "/onboarding",
    "/dashboard",
  ])
}