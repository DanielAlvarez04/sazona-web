import { cookies } from "next/headers"

import { API_BASE_URL } from "./api-base"

/** En el servidor se puede usar una URL interna distinta de la pública. */
const SERVER_API_URL = process.env.API_URL ?? API_BASE_URL

/**
 * Cookie con la sucursal activa.
 *
 * Viaja a la API como cabecera `x-branch-id`; sin ella las peticiones se
 * resuelven contra toda la organización (vista consolidada).
 */
export const BRANCH_COOKIE = "np_branch"

/**
 * `fetch` hacia la API reenviando las cookies de la sesión.
 *
 * Sólo puede usarse en el servidor (Server Components, Server Actions o Route
 * Handlers), porque necesita leer las cookies de la petición entrante.
 */
export async function apiFetch(path: string, init: RequestInit = {}) {
  const cookieStore = await cookies()
  const cookieHeader = cookieStore
    .getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ")

  const headers = new Headers(init.headers)
  if (cookieHeader) {
    headers.set("cookie", cookieHeader)
  }

  // La sucursal activa sólo aplica a datos de negocio: `/auth/*` debe seguir
  // funcionando aunque la cookie apunte a una sucursal ya desactivada.
  const branchId = cookieStore.get(BRANCH_COOKIE)?.value
  if (branchId && !path.startsWith("/auth")) {
    headers.set("x-branch-id", branchId)
  }

  return fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  })
}
