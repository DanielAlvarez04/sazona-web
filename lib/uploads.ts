"use client"

import {
  presignItemImage,
  presignRecipeImage,
  presignVariantImage,
} from "@/app/(app)/catalog/actions"

/** Límite por archivo: 5 MB (la API y el bucket lo repiten). */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024

/** `accept` del input de archivos. */
export const IMAGE_ACCEPT = "image/png,image/jpeg,image/webp"

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])

/** Devuelve el motivo del rechazo o `null` si la imagen es válida. */
export function validateImageFile(file: File): string | null {
  if (!ALLOWED_TYPES.has(file.type)) {
    return "Formato no admitido. Usa JPG, PNG o WebP."
  }

  if (file.size === 0) {
    return "El archivo está vacío."
  }

  if (file.size > MAX_IMAGE_BYTES) {
    return "La imagen supera el máximo de 5 MB."
  }

  return null
}

/** Respuesta de la API al firmar una subida. */
interface PresignResult {
  ok: boolean
  message?: string
  data?: {
    key: string
    url: string
    uploadUrl: string
    method: "PUT"
    headers: Record<string, string>
  }
}

type Presign = (input: {
  contentType: string
  size: number
}) => Promise<PresignResult>

/**
 * Sube una imagen directo a R2: pide la URL firmada a la API y hace el PUT.
 *
 * El archivo nunca pasa por la API. Al guardar la clave, la API valida el
 * objeto y borra la imagen anterior para que solo quede una por entidad.
 */
async function uploadImage(
  file: File,
  presign: Presign
): Promise<{ ok: boolean; message?: string; key?: string; url?: string }> {
  const problem = validateImageFile(file)

  if (problem) {
    return { ok: false, message: problem }
  }

  const presigned = await presign({
    contentType: file.type,
    size: file.size,
  })

  if (!presigned.ok || !presigned.data) {
    return {
      ok: false,
      message: presigned.message ?? "No se pudo preparar la subida.",
    }
  }

  const { key, url, uploadUrl, method, headers } = presigned.data

  try {
    const response = await fetch(uploadUrl, { method, headers, body: file })

    if (!response.ok) {
      return {
        ok: false,
        message: "No se pudo subir la imagen. Inténtalo de nuevo.",
      }
    }
  } catch {
    return {
      ok: false,
      message: "No se pudo subir la imagen. Revisa tu conexión.",
    }
  }

  return { ok: true, key, url }
}

/** Sube la imagen de un artículo ya guardado. */
export function uploadItemImage(itemId: string, file: File) {
  return uploadImage(file, (input) => presignItemImage(itemId, input))
}

/** Sube la imagen propia de una presentación ya guardada. */
export function uploadVariantImage(
  itemId: string,
  variantId: string,
  file: File
) {
  return uploadImage(file, (input) =>
    presignVariantImage(itemId, variantId, input)
  )
}

/** Sube la imagen propia de una receta ya guardada. */
export function uploadRecipeImage(recipeId: string, file: File) {
  return uploadImage(file, (input) => presignRecipeImage(recipeId, input))
}
