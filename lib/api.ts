import { cookies } from "next/headers"

import { API_BASE_URL } from "./api-base"

/** En el servidor se puede usar una URL interna distinta de la pública. */
const SERVER_API_URL = process.env.API_URL ?? API_BASE_URL

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

  return fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  })
}
