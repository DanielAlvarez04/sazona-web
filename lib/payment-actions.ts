"use server"

import { mutateApi, type ActionResult } from "@/lib/server-api"
import type { Order, Payment, PaymentMethod } from "@/lib/orders"

const PAYMENT_PATHS = ["/pos", "/dashboard", "/reports"]

export interface RegisterPaymentInput {
  method: PaymentMethod
  amount: number
  idempotencyKey?: string
}

/** Registra un pago pendiente sobre una cuenta abierta. */
export async function registerPayment(
  orderId: string,
  input: RegisterPaymentInput
): Promise<ActionResult<Payment>> {
  return mutateApi<Payment>(
    `/orders/${orderId}/payments`,
    "POST",
    input,
    PAYMENT_PATHS
  )
}

/** Confirma un pago pendiente (acción explícita y autorizada). */
export async function confirmPayment(
  paymentId: string
): Promise<ActionResult<Payment>> {
  return mutateApi<Payment>(
    `/payments/${paymentId}/confirm`,
    "POST",
    undefined,
    PAYMENT_PATHS
  )
}

/** Anula un pago pendiente o reembolsa uno confirmado (solo ADMIN). */
export async function voidPayment(
  paymentId: string,
  reason?: string
): Promise<ActionResult<Payment>> {
  return mutateApi<Payment>(
    `/payments/${paymentId}/void`,
    "POST",
    { reason },
    PAYMENT_PATHS
  )
}

/** Cierra una cuenta cuyo total ya está cubierto por pagos confirmados. */
export async function closeOrder(
  orderId: string
): Promise<ActionResult<Order>> {
  return mutateApi<Order>(
    `/orders/${orderId}/close`,
    "POST",
    undefined,
    PAYMENT_PATHS
  )
}
