"use server"

import { mutateApi, type ActionResult } from "@/lib/server-api"

export interface ClientAnalyticsEventInput {
  name: string
  itemId?: string
  menuId?: string
  orderId?: string
  subjectId?: string
  subjectName?: string
  quantity?: number
  amount?: number
  metadata?: Record<string, unknown>
}

/**
 * Envía un lote de eventos del POS a la API.
 *
 * La API ignora eventos desconocidos o con ids de otra organización; este
 * helper no revalida rutas para no refrescar pantallas por analítica.
 */
export async function trackClientEvents(
  events: ClientAnalyticsEventInput[]
): Promise<ActionResult> {
  if (events.length === 0) {
    return { ok: true }
  }

  return mutateApi("/analytics/events", "POST", { events })
}
