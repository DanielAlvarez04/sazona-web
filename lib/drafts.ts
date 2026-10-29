/**
 * Borradores de formularios en memoria.
 *
 * Sirven para que cerrar un diálogo por accidente (X, `Escape`, clic fuera o
 * Cancelar) no borre lo que el usuario estaba escribiendo: al volver a abrirlo
 * se recuperan los valores.
 *
 * El borrador se guarda al cerrar y se borra cuando el formulario se envía
 * correctamente. Vive en memoria a propósito: no queremos datos viejos
 * persiguiendo al usuario entre sesiones ni guardar contraseñas en el
 * almacenamiento del navegador. Al recargar la página se empieza limpio.
 */

const drafts = new Map<string, unknown>()

/** Devuelve el borrador guardado para `key`, o `null` si no hay ninguno. */
export function readDraft<T>(key: string): T | null {
  const draft = drafts.get(key)
  return draft === undefined ? null : (draft as T)
}

/** Guarda (o reemplaza) el borrador de `key`. */
export function writeDraft<T>(key: string, value: T): void {
  drafts.set(key, value)
}

/** Elimina el borrador de `key` (por ejemplo, tras guardar con éxito). */
export function clearDraft(key: string): void {
  drafts.delete(key)
}

/**
 * Convierte los campos de un `<form>` en un objeto plano `nombre → valor`.
 * Los valores no textuales (archivos) se descartan.
 */
export function formValues(form: HTMLFormElement): Record<string, string> {
  const values: Record<string, string> = {}

  for (const [name, value] of new FormData(form).entries()) {
    values[name] = typeof value === "string" ? value : ""
  }

  return values
}
