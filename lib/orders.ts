export type OrderStatus = "OPEN" | "CLOSED" | "CANCELLED"

export type PaymentMethod = "CASH" | "CARD" | "TRANSFER"

export type PaymentStatus = "PENDING" | "CONFIRMED" | "CANCELLED" | "REFUNDED"

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Efectivo",
  CARD: "Tarjeta",
  TRANSFER: "Transferencia",
}

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: "Pendiente",
  CONFIRMED: "Confirmado",
  CANCELLED: "Anulado",
  REFUNDED: "Reembolsado",
}

export interface Payment {
  id: string
  method: PaymentMethod
  amount: string
  status: PaymentStatus
  paidAt: string | null
  confirmedAt: string | null
  createdAt: string
  user: { id: string; name: string | null; username: string | null } | null
  confirmedBy: { id: string; name: string | null; username: string | null } | null
}


export type RoundStatus =
  | "PENDING"
  | "PREPARING"
  | "READY"
  | "DELIVERED"
  | "CANCELLED"

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  OPEN: "Abierta",
  CLOSED: "Cerrada",
  CANCELLED: "Cancelada",
}

export const ROUND_STATUS_LABELS: Record<RoundStatus, string> = {
  PENDING: "Pendiente",
  PREPARING: "En preparación",
  READY: "Lista",
  DELIVERED: "Entregada",
  CANCELLED: "Cancelada",
}

export interface RoundAction {
  status: RoundStatus
  label: string
  variant: "default" | "outline" | "destructive"
}

/** Transiciones que la API permite desde cada estado (plan.md §6.6). */
export const ROUND_ACTIONS: Record<RoundStatus, RoundAction[]> = {
  PENDING: [
    { status: "PREPARING", label: "Empezar", variant: "default" },
    { status: "CANCELLED", label: "Cancelar", variant: "destructive" },
  ],
  PREPARING: [
    { status: "READY", label: "Marcar lista", variant: "default" },
    { status: "CANCELLED", label: "Cancelar", variant: "destructive" },
  ],
  READY: [
    { status: "DELIVERED", label: "Entregar", variant: "outline" },
    { status: "CANCELLED", label: "Cancelar", variant: "destructive" },
  ],
  DELIVERED: [],
  CANCELLED: [],
}

export interface OrderItemExtra {
  id: string
  productExtraId: string | null
  extraName: string
  extraPrice: string
}

export interface OrderItemExclusion {
  id: string
  ingredientId: string
  ingredient: { id: string; name: string; baseUnit: string }
}

export interface OrderItem {
  id: string
  productId: string
  productVariantId: string | null
  productName: string
  variantName: string | null
  productPrice: string
  taxRate: string | null
  taxAmount: string
  quantity: number
  notes: string | null
  subtotal: string
  extras: OrderItemExtra[]
  exclusions: OrderItemExclusion[]
}

export interface StatusHistoryEntry {
  id: string
  previousStatus: string | null
  newStatus: string
  changedAt: string
  reason: string | null
  changedBy: { id: string; name: string | null; username: string | null } | null
}

export interface OrderRound {
  id: string
  orderId?: string
  status: RoundStatus
  sentAt: string | null
  startedAt: string | null
  readyAt: string | null
  deliveredAt: string | null
  cancelledAt: string | null
  createdAt: string
  items: OrderItem[]
  statusHistory?: StatusHistoryEntry[]
}

export interface OrderSummaryRound {
  id: string
  status: RoundStatus
  sentAt: string | null
  createdAt: string
  _count: { items: number }
}

export interface Order {
  id: string
  tableNumber: string | null
  isTakeaway: boolean
  status: OrderStatus
  subtotal: string
  taxTotal: string
  total: string
  createdAt: string
  user: { id: string; name: string | null; username: string | null } | null
  rounds: (OrderRound | OrderSummaryRound)[]
  payments?: Payment[]
  paidTotal?: string
  balance?: string
}

export interface KitchenRound extends OrderRound {
  order: {
    id: string
    tableNumber: string | null
    isTakeaway: boolean
    status: OrderStatus
    total: string
    createdAt: string
  }
}

export interface ConsumptionWarning {
  ingredientId: string
  name: string
  stockAfter: string
}

export function canDraftOrders(roles: string[]): boolean {
  return roles.some((role) =>
    ["ADMIN", "WAITER", "CASHIER"].includes(role)
  )
}

export function canSendOrders(roles: string[]): boolean {
  return roles.some((role) => ["ADMIN", "WAITER"].includes(role))
}

export function canWorkKitchen(roles: string[]): boolean {
  return roles.some((role) => ["ADMIN", "KITCHEN"].includes(role))
}

/** Registrar pagos: ADMIN, CASHIER y WAITER (plan.md §5). */
export function canRegisterPayments(roles: string[]): boolean {
  return roles.some((role) =>
    ["ADMIN", "CASHIER", "WAITER"].includes(role)
  )
}

/** Confirmar pagos y cerrar cuentas: ADMIN y CASHIER. */
export function canConfirmPayments(roles: string[]): boolean {
  return roles.some((role) => ["ADMIN", "CASHIER"].includes(role))
}

/** Reembolsar un pago ya confirmado: solo ADMIN. */
export function canRefundPayments(roles: string[]): boolean {
  return roles.includes("ADMIN")
}

/** Ver importes y reportes de ventas: ADMIN y CASHIER. */
export function canReadMoney(roles: string[]): boolean {
  return roles.some((role) => ["ADMIN", "CASHIER"].includes(role))
}

/** "Mesa 4" o "Para llevar". */
export function orderLabel(order: {
  tableNumber: string | null
  isTakeaway: boolean
}): string {
  if (order.tableNumber) return `Mesa ${order.tableNumber}`
  return order.isTakeaway ? "Para llevar" : "Sin mesa"
}

/** Minutos transcurridos desde una fecha ISO. */
export function elapsedMinutes(value: string | null): number {
  if (!value) return 0
  return Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000))
}

/** Minutos entre dos fechas ISO, o `null` si falta alguna. */
export function minutesBetween(
  from: string | null,
  to: string | null
): number | null {
  if (!from || !to) return null
  const diff = new Date(to).getTime() - new Date(from).getTime()
  return Math.max(0, Math.round(diff / 60000))
}

export interface RoundTimings {
  /** Enviada → empezada (espera en cola). */
  waitMinutes: number | null
  /** Empezada → lista (preparación). */
  prepMinutes: number | null
  /** Lista → entregada (traslado a la mesa). */
  deliveryMinutes: number | null
  /** Enviada → entregada (ciclo completo). */
  totalMinutes: number | null
  /** Etapa actual y minutos que lleva en ella. */
  stage: { status: RoundStatus; since: string | null; minutes: number } | null
}

/**
 * Duraciones entre las etapas de una comanda.
 *
 * Las etapas sin marca de tiempo quedan en `null` para no inventar tiempos; la
 * etapa en curso se mide hasta ahora.
 */
export function roundTimings(round: {
  status: RoundStatus
  sentAt: string | null
  startedAt: string | null
  readyAt: string | null
  deliveredAt: string | null
  createdAt: string
}): RoundTimings {
  const sent = round.sentAt ?? round.createdAt
  const stageSince =
    round.status === "PENDING"
      ? sent
      : round.status === "PREPARING"
        ? round.startedAt
        : round.status === "READY"
          ? round.readyAt
          : round.status === "DELIVERED"
            ? round.deliveredAt
            : null

  return {
    waitMinutes: minutesBetween(sent, round.startedAt),
    prepMinutes: minutesBetween(round.startedAt, round.readyAt),
    deliveryMinutes: minutesBetween(round.readyAt, round.deliveredAt),
    totalMinutes: minutesBetween(sent, round.deliveredAt),
    stage:
      stageSince && ["PENDING", "PREPARING", "READY"].includes(round.status)
        ? {
            status: round.status,
            since: stageSince,
            minutes: elapsedMinutes(stageSince),
          }
        : null,
  }
}

/** "8 min", "1 h 12 min" o "menos de 1 min". */
export function formatDuration(minutes: number | null): string {
  if (minutes === null) return "—"
  if (minutes < 1) return "menos de 1 min"
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`
}
