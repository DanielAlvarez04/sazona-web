"use server"

import { mutateApi, type ActionResult } from "@/lib/server-api"
import type { MercadoPagoTerminal } from "@/lib/mercadopago"

const SETTINGS_PATHS = ["/settings"]
const POINT_PATHS = ["/pos", "/dashboard", "/reports"]

export async function disconnectMercadoPago(): Promise<ActionResult> {
  return mutateApi("/mercadopago/connection", "DELETE", undefined, SETTINGS_PATHS)
}

export async function syncMercadoPagoTerminals(): Promise<
  ActionResult<MercadoPagoTerminal[]>
> {
  return mutateApi<MercadoPagoTerminal[]>(
    "/mercadopago/terminals/sync",
    "POST",
    undefined,
    SETTINGS_PATHS
  )
}

export interface TerminalUpdateInput {
  branchId?: string | null
  isDefault?: boolean
}

export async function updateMercadoPagoTerminal(
  id: string,
  input: TerminalUpdateInput
): Promise<ActionResult<MercadoPagoTerminal>> {
  if (!id) {
    return { ok: false, message: "Terminal no encontrada." }
  }

  return mutateApi<MercadoPagoTerminal>(
    `/mercadopago/terminals/${id}`,
    "PATCH",
    input,
    SETTINGS_PATHS
  )
}

export async function setMercadoPagoTerminalMode(
  id: string,
  operatingMode: "PDV" | "SELF_SERVICE"
): Promise<ActionResult<MercadoPagoTerminal>> {
  if (!id) {
    return { ok: false, message: "Terminal no encontrada." }
  }

  return mutateApi<MercadoPagoTerminal>(
    `/mercadopago/terminals/${id}/mode`,
    "PATCH",
    { operatingMode },
    SETTINGS_PATHS
  )
}

/** Pago local creado al enviar un cobro a la terminal. */
export interface PointPayment {
  id: string
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "REFUNDED"
  amount: string
  providerStatus?: string | null
  providerStatusDetail?: string | null
}

export interface PointChargeInput {
  amount: number
  terminalId?: string
  idempotencyKey: string
}

export async function chargeWithPoint(
  orderId: string,
  input: PointChargeInput
): Promise<ActionResult<PointPayment>> {
  if (!orderId) {
    return { ok: false, message: "Cuenta no encontrada." }
  }

  return mutateApi<PointPayment>(
    `/orders/${orderId}/payments/point`,
    "POST",
    input,
    POINT_PATHS
  )
}

export async function syncPointPayment(
  paymentId: string
): Promise<ActionResult<PointPayment>> {
  if (!paymentId) {
    return { ok: false, message: "Pago no encontrado." }
  }

  return mutateApi<PointPayment>(
    `/payments/${paymentId}/sync`,
    "POST",
    undefined,
    POINT_PATHS
  )
}

export async function cancelPointCharge(
  paymentId: string
): Promise<ActionResult<PointPayment>> {
  if (!paymentId) {
    return { ok: false, message: "Pago no encontrado." }
  }

  return mutateApi<PointPayment>(
    `/payments/${paymentId}/cancel-point`,
    "POST",
    undefined,
    POINT_PATHS
  )
}
