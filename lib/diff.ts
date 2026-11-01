/**
 * Utilidades para no enviar campos que no cambiaron.
 *
 * Regla del proyecto: antes de llamar a una Server Action de edición se compara
 * el formulario con la entidad original. Si el resultado está vacío se muestra
 * "Sin cambios" y no se hace la petición; si tiene campos, solo viajan esos.
 */

/** Compara textos ignorando espacios al inicio/fin y tratando "" como null. */
export function sameText(
  current: string | null | undefined,
  next: string | null | undefined
): boolean {
  return normalizeText(current) === normalizeText(next)
}

function normalizeText(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

/** Compara números (acepta strings numéricos como los que devuelve la API). */
export function sameNumber(
  current: number | string | null | undefined,
  next: number | string | null | undefined
): boolean {
  if (
    current === null ||
    current === undefined ||
    next === null ||
    next === undefined
  ) {
    return (current ?? null) === (next ?? null)
  }

  const left = typeof current === "number" ? current : Number(current)
  const right = typeof next === "number" ? next : Number(next)

  if (!Number.isFinite(left) || !Number.isFinite(right)) return false

  // Los precios y cantidades se manejan con 2-4 decimales; el epsilon evita
  // falsos cambios por representación binaria (0.1 + 0.2).
  return Math.abs(left - right) < 1e-9
}

/** Compara listas de texto como conjuntos (el orden no importa). */
export function sameStringSet(
  current: readonly string[] | null | undefined,
  next: readonly string[] | null | undefined
): boolean {
  const left = [...(current ?? [])].sort()
  const right = [...(next ?? [])].sort()

  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  )
}

export type Patch = Record<string, unknown>

/** `true` cuando no hay ningún campo que enviar. */
export function isEmptyPatch(patch: object): boolean {
  return Object.keys(patch).length === 0
}

/**
 * Devuelve solo los campos de `next` que difieren de `current`.
 *
 * - Las claves con `undefined` en `next` se ignoran (no se enviarán).
 * - `equals` permite comparadores especiales por campo (texto, números, sets).
 */
export function diffFields<T extends Record<string, unknown>>(
  current: T,
  next: Partial<T>,
  equals: Partial<Record<keyof T, (left: unknown, right: unknown) => boolean>> = {}
): Partial<T> {
  const patch: Partial<T> = {}

  for (const key of Object.keys(next) as Array<keyof T>) {
    const value = next[key]

    if (value === undefined) continue

    const same = equals[key] ?? Object.is

    if (!same(current[key], value)) {
      patch[key] = value
    }
  }

  return patch
}
