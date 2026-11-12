"use server"

import { mutateApi, type ActionResult } from "@/lib/server-api"
import type { PosPairingCode } from "@/lib/pos-device"

const POS_PATHS = ["/settings"]

/** Genera un código/QR de un solo uso para vincular una caja. */
export async function createPosPairing(
  branchId?: string
): Promise<ActionResult<PosPairingCode>> {
  return mutateApi<PosPairingCode>(
    "/pos/pairing",
    "POST",
    { branchId },
    POS_PATHS
  )
}

/** Revoca una caja vinculada (deja de aceptar PIN). */
export async function revokePosDevice(id: string): Promise<ActionResult> {
  return mutateApi(`/pos/devices/${id}`, "DELETE", undefined, POS_PATHS)
}

/** Define o cambia mi PIN de caja. */
export async function setMyPosPin(pin: string): Promise<ActionResult> {
  return mutateApi("/pos/pin", "PUT", { pin }, POS_PATHS)
}

/** ADMIN: define el PIN de otro miembro del negocio. */
export async function setUserPosPin(
  userId: string,
  pin: string
): Promise<ActionResult> {
  return mutateApi(`/pos/pin/${userId}`, "PUT", { pin }, POS_PATHS)
}
