"use server"

import { apiFetch } from "@/lib/api"
import { apiErrorMessage } from "@/lib/http-error"
import { requireUser } from "@/lib/session"
import type { RoleCode } from "@/lib/users"
import { normalizeUsername, type UsernameAvailability, type UsernameSuggestion } from "@/lib/username"
import { mutateApi, type ActionResult } from "@/lib/server-api"

const USER_PATHS = ["/users", "/settings"]

/**
 * Consulta si un nombre de usuario está libre.
 *
 * La usa el formulario de cuentas internas mientras se escribe el nombre. Se
 * normaliza antes de enviarlo para que " Ana.Perez " y "ana.perez" consulten lo
 * mismo que se guardará al crear la cuenta.
 */
export async function checkUsernameAvailability(
  username: string
): Promise<UsernameAvailability> {
  await requireUser()

  const value = normalizeUsername(username)

  const response = await apiFetch(
    `/users/username-available?username=${encodeURIComponent(value)}`
  )

  if (!response.ok) {
    throw new Error(
      apiErrorMessage(
        await response.json().catch(() => null),
        "No pudimos verificar el nombre de usuario"
      )
    )
  }

  return (await response.json()) as UsernameAvailability
}

/**
 * Busca un usuario por correo para precargar nombre y apellido.
 *
 * Devuelve `{ found: true, name }` cuando el correo ya existe (registro con
 * correo o Google), o `{ found: false }` cuando no.
 */
export async function findUserByEmail(
  email: string
): Promise<{ found: boolean; name?: string | null; email?: string | null; username?: string | null }> {
  await requireUser()

  const response = await apiFetch(
    `/users/by-email?email=${encodeURIComponent(email.trim())}`
  )

  if (!response.ok) {
    throw new Error(
      apiErrorMessage(
        await response.json().catch(() => null),
        "No pudimos buscar el usuario por correo"
      )
    )
  }

  return (await response.json()) as {
    found: boolean
    name?: string | null
    email?: string | null
    username?: string | null
  }
}

/**
 * Pide a la API el usuario propuesto para un nombre.
 *
 * Tiene en cuenta el dominio del negocio y los usuarios ya ocupados:
 * `ana@naranjapimienta.cafe` → `a.perez@naranjapimienta.cafe`.
 */
export async function suggestUsername(name: string): Promise<UsernameSuggestion> {
  await requireUser()

  const response = await apiFetch(
    `/users/username-suggestion?name=${encodeURIComponent(name)}`
  )

  if (!response.ok) {
    throw new Error(
      apiErrorMessage(
        await response.json().catch(() => null),
        "No pudimos proponer un nombre de usuario"
      )
    )
  }

  return (await response.json()) as UsernameSuggestion
}

function text(formData: FormData, key: string): string | undefined {
  const value = formData.get(key)
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed === "" ? undefined : trimmed
}

function roles(formData: FormData): RoleCode[] {
  return formData.getAll("roles").filter((value): value is RoleCode => {
    return typeof value === "string" && value.length > 0
  }) as RoleCode[]
}

export async function createInternalUser(
  formData: FormData
): Promise<ActionResult> {
  return mutateApi(
    "/users",
    "POST",
    {
      username: text(formData, "username"),
      email: text(formData, "email"),
      name: text(formData, "name"),
      surname: text(formData, "surname"),
      password: text(formData, "password"),
      roles: roles(formData),
      branchId: text(formData, "branchId"),
    },
    USER_PATHS
  )
}

export async function updateInternalUser(
  userId: string,
  formData: FormData
): Promise<ActionResult> {
  const payload: Record<string, unknown> = {
    roles: roles(formData),
  }

  const name = text(formData, "name")
  if (name !== undefined) payload.name = name

  const surname = text(formData, "surname")
  if (surname !== undefined) payload.surname = surname

  const password = text(formData, "password")
  if (password !== undefined) payload.password = password

  // Cadena vacía = acceso a todas las sucursales. Solo se envía si el
  // formulario tiene el selector (organizaciones con sucursales activas).
  if (formData.has("branchId")) {
    payload.branchId = text(formData, "branchId") ?? ""
  }

  // El estado de la cuenta no se edita desde el diálogo: se activa o desactiva
  // desde las acciones de la fila. Solo se envía si el formulario lo incluye.
  if (formData.has("isActive")) {
    payload.isActive = formData.get("isActive") === "on"
  }

  return mutateApi(`/users/${userId}`, "PATCH", payload, USER_PATHS)
}

export async function setInternalUserActive(
  userId: string,
  isActive: boolean
): Promise<ActionResult> {
  return mutateApi(`/users/${userId}`, "PATCH", { isActive }, USER_PATHS)
}

export async function activateInternalUser(
  userId: string
): Promise<ActionResult> {
  return setInternalUserActive(userId, true)
}

export async function deactivateInternalUser(
  userId: string
): Promise<ActionResult> {
  return mutateApi(`/users/${userId}`, "DELETE", undefined, USER_PATHS)
}

/**
 * Elimina un usuario de la organización (hard delete).
 *
 * Borra la cuenta completa (o solo la membresía si pertenece a otra
 * organización). Los pedidos, pagos, movimientos y demás registros que haya
 * creado se conservan.
 */
export async function deleteUserFromOrg(
  userId: string
): Promise<ActionResult> {
  return mutateApi(`/users/${userId}/membership`, "DELETE", undefined, USER_PATHS)
}

/**
 * Elimina varios usuarios de la organización en una sola llamada (hard delete).
 */
export async function deleteUsersFromOrg(
  userIds: string[]
): Promise<ActionResult<{ deletedCount: number }>> {
  if (userIds.length === 0) {
    return { ok: true, data: { deletedCount: 0 } }
  }

  return mutateApi<{ deletedCount: number }>(
    "/users/memberships",
    "DELETE",
    { userIds },
    USER_PATHS
  )
}

/**
 * Elimina definitivamente las cuentas desactivadas de la organización
 * (hard delete masivo / purge).
 */
export async function purgeDeletedUsers(): Promise<
  ActionResult<{ deletedCount: number }>
> {
  return mutateApi<{ deletedCount: number }>(
    "/users/purge-deleted",
    "DELETE",
    undefined,
    USER_PATHS
  )
}
