/** Tipos de la caja (turnos, movimientos y reportes) de la API. */

import type { Payment, PaymentMethod, PaymentStatus } from "./orders"

export type CashSessionStatus = "OPEN" | "CLOSED"

export type CashMovementType =
  | "WITHDRAWAL"
  | "DEPOSIT"
  | "EXPENSE"
  | "ADJUSTMENT"

export const CASH_MOVEMENT_LABELS: Record<CashMovementType, string> = {
  WITHDRAWAL: "Retiro",
  DEPOSIT: "Ingreso",
  EXPENSE: "Gasto",
  ADJUSTMENT: "Ajuste",
}

export interface CashUserRef {
  id: string
  name: string | null
  username: string | null
}

export interface CashSession {
  id: string
  status: CashSessionStatus
  branchId: string | null
  branchName: string | null
  openedAt: string
  openedBy: CashUserRef | null
  closedAt: string | null
  closedBy: CashUserRef | null
  openingFloat: number
  countedCash: number | null
  expectedCash: number | null
  difference: number | null
  notes: string | null
}

export interface CashMethodRow {
  method: PaymentMethod
  status: PaymentStatus
  total: number
  tips: number
  count: number
}

export interface CashUserRow {
  userId: string | null
  name: string
  username: string | null
  total: number
  tips: number
  count: number
  refunds: number
}

export interface CashSummary {
  sales: number
  tips: number
  count: number
  expectedCash: number
  cash: {
    openingFloat: number
    sales: number
    withdrawals: number
    expenses: number
    deposits: number
    expected: number
    counted: number | null
    difference: number | null
  }
  byMethod: CashMethodRow[]
  byUser: CashUserRow[]
}

export interface CashMovement {
  id: string
  type: CashMovementType
  amount: number
  reason: string
  createdAt: string
  user: CashUserRef | null
}

export interface CashSessionPayload {
  session: CashSession | null
  summary: CashSummary | null
  movements?: CashMovement[]
  payments?: Payment[]
}

export interface CashSessionListItem extends CashSession {
  totals: {
    sales: number
    tips: number
    count: number
    refunded: number
  }
}

export interface CashSessionList {
  items: CashSessionListItem[]
  total: number
}

export interface ChargeReportUser {
  userId: string
  name: string
  username: string | null
  count: number
  total: number
  tips: number
  refundedCount: number
  refundedAmount: number
  cancelledCount: number
  cancelledOrders: number
  refundRate: number
  byMethod: Array<{
    method: PaymentMethod
    total: number
    tips: number
    count: number
  }>
}

export interface ChargesReport {
  from: string | null
  to: string | null
  users: ChargeReportUser[]
  totals: {
    count: number
    total: number
    tips: number
    refundedCount: number
    refundedAmount: number
    cancelledOrders: number
  } | null
}
