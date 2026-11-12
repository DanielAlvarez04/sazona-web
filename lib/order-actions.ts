"use server"

import { mutateApi, type ActionResult } from "@/lib/server-api"
import type {
  ConsumptionWarning,
  GuestTitle,
  Order,
  OrderChannel,
  OrderGuest,
  OrderRound,
  RoundStatus,
} from "@/lib/orders"

const ORDER_PATHS = ["/pos", "/kitchen"]

export interface RoundItemInput {
  itemId: string
  variantId?: string
  quantity: number
  notes?: string
  guestId?: string
  extras?: { extraId: string }[]
  options?: { itemOptionValueId: string }[]
  excludedIngredientIds?: string[]
}

export interface SendRoundInput {
  items: RoundItemInput[]
  idempotencyKey?: string
}

export interface CreateOrderGuestInput {
  name?: string
  title?: GuestTitle | null
}

export interface CreateOrderInput {
  tableNumber?: string
  partySize?: number
  isTakeaway?: boolean
  channel?: OrderChannel
  customerName?: string
  customerPhone?: string
  deliveryAddress?: string
  deliveryFee?: number
  scheduledAt?: string
  /** Personas de la cuenta. */
  guests?: CreateOrderGuestInput[]
  idempotencyKey?: string
}

export async function createOrder(
  input: CreateOrderInput
): Promise<ActionResult<Order>> {
  return mutateApi<Order>("/orders", "POST", input, ORDER_PATHS)
}

export async function sendRound(
  orderId: string,
  input: SendRoundInput
): Promise<ActionResult<OrderRound & { warnings?: ConsumptionWarning[] }>> {
  return mutateApi<OrderRound & { warnings?: ConsumptionWarning[] }>(
    `/orders/${orderId}/rounds`,
    "POST",
    input,
    ORDER_PATHS
  )
}

export async function transitionRound(
  orderId: string,
  roundId: string,
  status: RoundStatus,
  reason?: string
): Promise<ActionResult<OrderRound & { warnings?: ConsumptionWarning[] }>> {
  return mutateApi<OrderRound & { warnings?: ConsumptionWarning[] }>(
    `/orders/${orderId}/rounds/${roundId}/status`,
    "PATCH",
    { status, reason },
    ORDER_PATHS
  )
}

export async function cancelOrder(
  orderId: string,
  reason?: string
): Promise<ActionResult<Order>> {
  return mutateApi<Order>(
    `/orders/${orderId}/cancel`,
    "PATCH",
    { reason },
    ORDER_PATHS
  )
}

/** Añade una persona (comensal) a la cuenta. */
export async function addOrderGuest(
  orderId: string,
  input: CreateOrderGuestInput
): Promise<ActionResult<OrderGuest>> {
  return mutateApi<OrderGuest>(
    `/orders/${orderId}/guests`,
    "POST",
    input,
    ORDER_PATHS
  )
}

/** Edita el nombre y/o tratamiento de una persona de la cuenta. */
export async function updateOrderGuest(
  orderId: string,
  guestId: string,
  input: CreateOrderGuestInput
): Promise<ActionResult<OrderGuest>> {
  return mutateApi<OrderGuest>(
    `/orders/${orderId}/guests/${guestId}`,
    "PATCH",
    input,
    ORDER_PATHS
  )
}

/** Quita una persona de la cuenta (sus líneas conservan el nombre). */
export async function removeOrderGuest(
  orderId: string,
  guestId: string
): Promise<ActionResult> {
  return mutateApi(
    `/orders/${orderId}/guests/${guestId}`,
    "DELETE",
    undefined,
    ORDER_PATHS
  )
}
