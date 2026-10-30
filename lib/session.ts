import { cache } from "react"
import { redirect } from "next/navigation"

import { apiFetch } from "./api"

export interface SessionUser {
  id: string
  email: string | null
  username: string | null
  name: string | null
  emailVerified: boolean
  twoFactorEnabled: boolean
  onboarded: boolean
  googleLinked: boolean
  roles: string[]
  organizationId: string | null
  /** Sucursal fija del miembro; `null` = puede operar en toda la organización. */
  branchId: string | null
  organizationName: string | null
  organizationDomain: string | null
  /** IVA por defecto del negocio como fracción (`0.16` = 16 %). */
  organizationTaxRate: string
  /** La organización usa la sección de insumos core sugeridos. */
  organizationUseCoreSuggestions: boolean
}

interface MeResponse {
  id: string
  email: string | null
  username?: string | null
  name: string | null
  emailVerified: boolean
  twoFactorEnabled: boolean
  onboarded?: boolean
  googleLinked?: boolean
  roles: string[]
  organizationId?: string | null
  branchId?: string | null
  organization?: {
    id: string
    name: string
    domain?: string | null
    taxRate?: string | null
    useCoreSuggestions?: boolean | null
  } | null
}

/**
 * Usuario de la sesión actual, o `null` si no hay sesión válida.
 *
 * `cache` evita repetir la llamada a `/auth/me` dentro del mismo render
 * (layout + página).
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  try {
    const response = await apiFetch("/auth/me")

    if (!response.ok) {
      return null
    }

    const data = (await response.json()) as MeResponse

    return {
      id: data.id,
      email: data.email,
      username: data.username ?? null,
      name: data.name,
      emailVerified: data.emailVerified,
      twoFactorEnabled: data.twoFactorEnabled,
      onboarded: data.onboarded ?? false,
      googleLinked: data.googleLinked ?? false,
      roles: data.roles ?? [],
      organizationId: data.organizationId ?? data.organization?.id ?? null,
      branchId: data.branchId ?? null,
      organizationName: data.organization?.name ?? null,
      organizationDomain: data.organization?.domain ?? null,
      organizationTaxRate: data.organization?.taxRate ?? "0.16",
      organizationUseCoreSuggestions:
        data.organization?.useCoreSuggestions ?? true,
    }
  } catch {
    return null
  }
})

/** Igual que `getCurrentUser`, pero redirige al login si no hay sesión. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  return user
}

/** Nombre visible de una cuenta (interna o con correo). */
export function displayName(user: {
  name?: string | null
  username?: string | null
  email?: string | null
}): string {
  return user.name?.trim() || user.username || user.email || "Usuario"
}

export function isAdmin(user: { roles: string[] }): boolean {
  return user.roles.includes("ADMIN")
}
