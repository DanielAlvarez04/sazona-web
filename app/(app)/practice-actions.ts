"use server"

import { mutateApi, type ActionResult } from "@/lib/server-api"

/**
 * Cierra el modo práctica de la organización.
 *
 * Lo puede invocar cualquier miembro autenticado: solo apaga la medición de
 * operación, no toca ventas, pagos ni inventario.
 */
export async function endPracticeMode(): Promise<ActionResult> {
  return mutateApi("/organizations/current/practice/end", "POST", undefined, [
    "/settings",
    "/dashboard",
  ])
}
