/** Respuesta de `GET /kitchen/settings`. */
export interface KitchenSettings {
  /** Tiempo manual configurado por el negocio. */
  prepMinutes: number
  source: "MANUAL" | "HISTORICAL"
  /** Ordenar la cola por urgencia en lugar de llegada. */
  suggestOrder: boolean
  historical: KitchenHistoricalStats
  /** Tiempo base realmente en uso ahora mismo. */
  effectiveMinutes: number
  usingHistorical: boolean
}

export interface KitchenHistoricalStats {
  averageMinutes: number | null
  samples: number
  days: number
  minRounds: number
  minDays: number
  windowDays: number
  available: boolean
}

export const PREP_SOURCE_LABELS: Record<KitchenSettings["source"], string> = {
  MANUAL: "Tiempo manual",
  HISTORICAL: "Promedio histórico",
}
