"use client"

import {
  finalizeItemImage,
  finalizeRecipeImage,
  finalizeVariantImage,
  getImageJobs,
  presignItemImage,
  presignRecipeImage,
  presignVariantImage,
  type ImageJobStarted,
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

/** Respuesta de la API al encolar la optimización. */
interface FinalizeResult {
  ok: boolean
  message?: string
  data?: ImageJobStarted
}

type Presign = (input: {
  contentType: string
  size: number
}) => Promise<PresignResult>

type Finalize = (key: string) => Promise<FinalizeResult>

export interface UploadImageResult {
  ok: boolean
  message?: string
  jobId?: string
}

/** Intervalo y límite del sondeo de optimización. */
const JOB_POLL_INTERVAL = 1000
const JOB_TIMEOUT = 120_000

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Espera a que terminen los trabajos de imagen.
 *
 * Se usa dentro de `toast.promise`; lanza un error con el mensaje del job
 * cuando alguna imagen falla.
 */
export async function waitForImageJobs(jobIds: string[]): Promise<void> {
  if (jobIds.length === 0) return

  const pending = new Set(jobIds)
  const deadline = Date.now() + JOB_TIMEOUT

  while (pending.size > 0) {
    const result = await getImageJobs([...pending])

    if (!result.ok || !result.data) {
      throw new Error(
        result.message ?? "No se pudo consultar el estado de la imagen."
      )
    }

    const found = new Set(result.data.map((job) => job.id))

    for (const id of pending) {
      if (!found.has(id)) {
        throw new Error("No se encontró el trabajo de la imagen.")
      }
    }

    for (const job of result.data) {
      if (job.status === "FAILED") {
        throw new Error(job.error || "No se pudo optimizar la imagen.")
      }

      if (job.status === "DONE") pending.delete(job.id)
    }

    if (pending.size === 0) return

    if (Date.now() > deadline) {
      throw new Error(
        "La optimización tardó demasiado. Inténtalo de nuevo."
      )
    }

    await sleep(JOB_POLL_INTERVAL)
  }
}

/**
 * Sube una imagen directo a R2 y encola su optimización.
 *
 * 1. La API firma una URL para subir el original a `{org}/tmp/`.
 * 2. El navegador hace el PUT (el archivo no pasa por nuestros servidores).
 * 3. `finalize` crea un job en segundo plano y responde con su id.
 *
 * La API aplica las variantes a la entidad cuando termina; el cliente solo
 * espera el `jobId` para mostrar el progreso con `toast.promise`.
 */
async function uploadImage(
  file: File,
  presign: Presign,
  finalize: Finalize
): Promise<UploadImageResult> {
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
        "No se pudo preparar la optimización de la imagen.",
    }
  }

  return { ok: true, jobId: finalized.data.jobId }
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
