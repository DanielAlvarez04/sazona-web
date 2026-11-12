"use server"

import { mutateApi, type ActionResult } from "@/lib/server-api"
import type { PosDisplayCreated } from "@/lib/pos-display"

const DISPLAY_PATHS = ["/settings", "/pos"]

/** Crea una pantalla de cliente y devuelve la URL/token para abrirla. */
export async function createPosDisplay(input: {
  name?: string
  branchId?: string
}): Promise<ActionResult<PosDisplayCreated>> {
  return mutateApi<PosDisplayCreated>(
    "/pos/displays",
    "POST",
    input,
    DISPLAY_PATHS
  )
}

/** Revoca una pantalla de cliente. */
export async function revokePosDisplay(id: string): Promise<ActionResult> {
  return mutateApi(`/pos/displays/${id}`, "DELETE", undefined, DISPLAY_PATHS)
}
