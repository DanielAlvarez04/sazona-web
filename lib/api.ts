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
 * Rechaza cualquier intento de cachear una respuesta autenticada.
 *
 * La clave de caché de Next incluye la URL y las cabeceras, así que hoy no
 * habría cruce de datos; el problema es que la caché tampoco serviría de nada
 * (cada sesión es una clave) y que `unstable_cache` sí usa una clave elegida a
 * mano. Mejor que el intento falle aquí que descubrirlo en producción.
 */
function assertNoSharedCache(path: string, init: RequestInit) {
  const next = init.next as
    | { revalidate?: unknown; tags?: unknown }
    | undefined

  const forbidden =
    init.cache === "force-cache" ||
    next?.revalidate !== undefined ||
    (Array.isArray(next?.tags) && next.tags.length > 0)

  if (!forbidden) return

  throw new Error(
    `apiFetch("${path}") intentó usar la caché compartida de Next. ` +
      "Las respuestas de la API dependen de la sesión (organización y " +
      "sucursal): quita `cache`, `next.revalidate` y `next.tags`. Si " +
      "necesitas caché, usa `unstable_cache` con organizationId y branchId " +
      "en la clave."
  )
}

/**
 * `fetch` hacia la API reenviando las cookies de la sesión.
 *
 * Sólo puede usarse en el servidor (Server Components, Server Actions o Route
 * Handlers), porque necesita leer las cookies de la petición entrante.
 *
 * **La respuesta depende del usuario**: la API resuelve la organización a
 * partir de la sesión, no de la URL. Por eso este `fetch` no puede usar la
 * caché compartida de Next (`force-cache`, `next.revalidate`, `next.tags`): un
 * único error ahí serviría el catálogo o los pedidos de un negocio a otro.
 * `assertNoSharedCache` convierte ese descuido en un fallo visible.
 *
 * Si algún día hace falta caché de verdad, el patrón seguro es
 * `unstable_cache` con `organizationId` y `branchId` en la clave, nunca una
 * caché indexada sólo por URL.
 */
export async function apiFetch(path: string, init: RequestInit = {}) {
  assertNoSharedCache(path, init)

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

  return fetch(`${SERVER_API_URL}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  })
}
