"use client"

import {
  finalizeItemImage,
  finalizeRecipeImage,
  finalizeVariantImage,
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
    uploadUrl: string
    method: "PUT"
    headers: Record<string, string>
  }
}

/** Respuesta de la API al optimizar el temporal. */
interface FinalizeResult {
  ok: boolean
  message?: string
  data?: {
    key: string
    url: string
  }
}

type Presign = (input: {
  contentType: string
  size: number
}) => Promise<PresignResult>

type Finalize = (key: string) => Promise<FinalizeResult>

/**
 * Sube una imagen directo a R2 y deja que la API la optimice.
 *
 * 1. La API firma una URL para subir el original a `{org}/tmp/`.
 * 2. El navegador hace el PUT (el archivo no pasa por nuestros servidores).
 * 3. `finalize` descarga el temporal, genera AVIF/JPEG, guarda las variantes y
 *    borra el original. La clave que se guarda en la base es la optimizada.
 */
async function uploadImage(
  file: File,
  presign: Presign,
  finalize: Finalize
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

  const { key, uploadUrl, method, headers } = presigned.data

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

  const finalized = await finalize(key)

  if (!finalized.ok || !finalized.data) {
    return {
      ok: false,
      message:
        finalized.message ??
        "No se pudo optimizar la imagen. Inténtalo de nuevo.",
    }
  }

  return { ok: true, key: finalized.data.key, url: finalized.data.url }
}

/** Sube la imagen de un artículo ya guardado. */
export function uploadItemImage(itemId: string, file: File) {
  return uploadImage(
    file,
    (input) => presignItemImage(itemId, input),
    (key) => finalizeItemImage(itemId, key)
  )
}

/** Sube la imagen propia de una presentación ya guardada. */
export function uploadVariantImage(
  itemId: string,
  variantId: string,
  file: File
) {
  return uploadImage(
    file,
    (input) => presignVariantImage(itemId, variantId, input),
    (key) => finalizeVariantImage(itemId, variantId, key)
  )
}

/** Sube la imagen propia de una receta ya guardada. */
export function uploadRecipeImage(recipeId: string, file: File) {
  return uploadImage(
    file,
    (input) => presignRecipeImage(recipeId, input),
    (key) => finalizeRecipeImage(recipeId, key)
  )
}
