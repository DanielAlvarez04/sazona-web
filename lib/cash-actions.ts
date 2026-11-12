"use server"

import { mutateApi, type ActionResult } from "@/lib/server-api"
import type {
  CashMovement,
  CashMovementType,
  CashSessionPayload,
} from "@/lib/cash"

const CASH_PATHS = ["/pos", "/reports", "/dashboard"]

export async function openCashSession(
  openingFloat: number
): Promise<ActionResult<CashSessionPayload>> {
  return mutateApi<CashSessionPayload>(
    "/cash/sessions",
    "POST",
    { openingFloat },
    CASH_PATHS
  )
}

export async function closeCashSession(
  sessionId: string,
  input: { countedCash: number; notes?: string }
): Promise<ActionResult<CashSessionPayload>> {
  return mutateApi<CashSessionPayload>(
    `/cash/sessions/${sessionId}/close`,
    "POST",
    input,
    CASH_PATHS
  )
}

export async function addCashMovement(
  sessionId: string,
  input: { type: CashMovementType; amount: number; reason: string }
): Promise<ActionResult<CashMovement>> {
  return mutateApi<CashMovement>(
    `/cash/sessions/${sessionId}/movements`,
    "POST",
    input,
    CASH_PATHS
  )
}
