"use server"

import { mutateApi, type ActionResult } from "@/lib/server-api"
import type {
  ConsumptionWarning,
  Order,
  OrderRound,
  RoundStatus,
} from "@/lib/orders"

const ORDER_PATHS = ["/pos", "/kitchen"]

export interface RoundItemInput {
  itemId: string
  variantId?: string
  quantity: number
  notes?: string
  extras?: { extraId: string }[]
  excludedIngredientIds?: string[]
}

export interface SendRoundInput {
  items: RoundItemInput[]
  idempotencyKey?: string
}

export interface CreateOrderInput {
  tableNumber?: string
  isTakeaway?: boolean
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
