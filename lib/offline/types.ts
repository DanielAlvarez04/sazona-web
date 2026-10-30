/**
 * Operaciones que la PWA puede guardar sin conexión (plan.md §7.1).
 *
 * Solo se encolan comandas: nunca cobros, pagos ni confirmaciones. Los
 * identificadores se generan en el dispositivo y la API los reconoce para no
 * duplicar el trabajo si se reintenta.
 */

export type QueuedRoundStatus = "queued" | "syncing" | "error"

export interface QueuedRoundItem {
  itemId: string
  variantId?: string
  quantity: number
  notes?: string
  extras?: { extraId: string }[]
  excludedIngredientIds?: string[]
}

export interface QueuedRound {
  id: string
  userId: string
  kind: "round"
  status: QueuedRoundStatus
  createdAt: number
  updatedAt: number
  attempts: number
  lastError?: string
  /** Texto corto para la interfaz ("Mesa 4 · 3 líneas"). */
  label: string
  /** Total estimado en el dispositivo; el servidor recalcula el definitivo. */
  total: number
  /** Cuenta ya abierta en el servidor, si la había al encolar. */
  orderId?: string
  order: {
    tableNumber?: string
    isTakeaway: boolean
    idempotencyKey: string
  }
  round: {
    items: QueuedRoundItem[]
    idempotencyKey: string
  }
}

export const QUEUED_STATUS_LABELS: Record<QueuedRoundStatus, string> = {
  queued: "Pendiente de sincronizar",
  syncing: "Sincronizando",
  error: "Error: requiere intervención",
}
