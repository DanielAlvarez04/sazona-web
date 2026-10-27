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

/** Paso 1: nombre del negocio y dominio de los usuarios del equipo. */
export async function updateOnboardingBusiness(
  formData: FormData
): Promise<ActionResult> {
  const name = text(formData, "name")
  const domain = text(formData, "domain")

  if (!name || name.length < 2) {
    return { ok: false, message: "Escribe el nombre de tu negocio." }
  }

  if (!domain) {
    return { ok: false, message: "Escribe el dominio de tu negocio." }
  }

  return mutateApi(
    "/organizations/current",
    "PATCH",
    { name, domain },
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

/** Paso 2: nombre visible y nombre de usuario del administrador. */
export async function updateOnboardingProfile(
  formData: FormData
): Promise<ActionResult> {
  const name = text(formData, "name")
  const username = text(formData, "username")

  if (!name) {
    return { ok: false, message: "Escribe tu nombre." }
  }

  if (!username) {
    return { ok: false, message: "Elige un nombre de usuario." }
  }

  return mutateApi(
    "/auth/me",
    "PATCH",
    { name, username },
    ["/onboarding"]
  )
}

/** Paso 3: marca el onboarding como completado. */
export async function finishOnboarding(): Promise<ActionResult> {
  return mutateApi("/auth/onboarding/complete", "POST", undefined, [
    "/onboarding",
    "/dashboard",
  ])
}
