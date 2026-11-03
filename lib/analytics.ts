"use client"

import {
  trackClientEvents,
  type ClientAnalyticsEventInput,
} from "@/app/(app)/analytics-actions"

/**
 * Cola mínima de eventos del POS.
 *
 * Agrupa eventos para no hacer una petición por clic y nunca bloquea la
 * operación: si el envío falla, el lote se descarta. La analítica es
 * best-effort y no debe interrumpir una venta.
 */
const MAX_BATCH = 20
const FLUSH_MS = 4000

let queue: ClientAnalyticsEventInput[] = []
let timer: ReturnType<typeof setTimeout> | null = null

export function trackEvent(event: ClientAnalyticsEventInput): void {
  queue.push(event)

  if (queue.length >= MAX_BATCH) {
    void flush()
    return
  }

  if (timer) return

  timer = setTimeout(() => {
    void flush()
  }, FLUSH_MS)
}

async function flush(): Promise<void> {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }

  if (queue.length === 0) return

  const batch = queue
  queue = []

  try {
    await trackClientEvents(batch)
  } catch {
    // Sin conexión o sesión caducada: se descarta el lote.
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => {
    void flush()
  })
}
