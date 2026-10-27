import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { apiFetch } from "./api"
import { apiErrorMessage } from "./http-error"
import { requireUser } from "./session"

/** Origen que la API exige en las peticiones mutantes autenticadas por cookie. */
const WEB_ORIGIN = process.env.WEB_ORIGIN ?? "http://localhost:3000"

export interface ActionResult<T = unknown> {
  ok: boolean
  message?: string
  data?: T
  /**
   * `true` cuando no se pudo contactar con la API (sin conexión, DNS, etc.).
   * La cola offline lo usa para reintentar en vez de marcar un error definitivo.
   */
  network?: boolean
}

function parseBody(text: string): unknown {
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

/**
 * Llama a la API desde una Server Action reenviando la sesión y el `Origin`.
 *
 * `paths` se revalidan cuando la mutación tiene éxito para que el árbol de
 * Server Components se vuelva a renderizar.
 */
export async function mutateApi<T = unknown>(
  path: string,
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  body?: unknown,
  paths: string[] = []
): Promise<ActionResult<T>> {
  await requireUser()

  try {
    const response = await apiFetch(path, {
      method,
      headers: {
        "content-type": "application/json",
        origin: WEB_ORIGIN,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })

    const payload = parseBody(await response.text())

    // La sesión caducó a mitad de la acción: se manda al login en lugar de
    // mostrar un error genérico ("no se pudo actualizar").
    if (response.status === 401) {
      redirect("/login")
    }

    if (!response.ok) {
      return {
        ok: false,
        message: apiErrorMessage(
          payload,
          `La operación falló (${response.status})`
        ),
      }
    }

    for (const revalidate of paths) {
      revalidatePath(revalidate)
    }

    return { ok: true, data: payload as T }
  } catch {
    return {
      ok: false,
      message: "No se pudo contactar con la API. Inténtalo de nuevo.",
      network: true,
    }
  }
}
