/** Tipos de la integración con Mercado Pago Point (respuesta de la API). */

export interface MercadoPagoConnection {
  mpUserId: string
  status: string
  expiresAt: string
  connectedAt: string
  lastRefreshedAt: string | null
  needsReconnect: boolean
}

export interface MercadoPagoTerminal {
  id: string
  terminalId: string
  name: string | null
  branchId: string | null
  operatingMode: string | null
  isDefault: boolean
  isActive: boolean
  lastSyncedAt: string | null
}

export interface MercadoPagoStatus {
  configured: boolean
  connected: boolean
  connection: MercadoPagoConnection | null
  terminals: MercadoPagoTerminal[]
}

/** Configuración mínima que el POS necesita para cobrar en terminal. */
export interface MercadoPagoPointConfig {
  enabled: boolean
  terminals: Array<{
    id: string
    name: string | null
    branchId: string | null
    isDefault: boolean
  }>
}

export const MERCADO_PAGO_OPERATING_MODES: Record<string, string> = {
  PDV: "Punto de venta (PDV)",
  SELF_SERVICE: "Autoservicio",
  STANDALONE: "Independiente",
}
