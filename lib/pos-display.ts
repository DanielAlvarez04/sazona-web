/** Tipos de la pantalla de cliente. */

export interface PosDisplayInfo {
  id: string
  name: string
  branchId: string | null
  branch?: { name: string } | null
  lastSeenAt: string | null
  stateUpdatedAt: string | null
  createdAt: string
}

export interface PosDisplayCreated {
  id: string
  name: string
  token: string
  url: string
}

export interface PosDisplayState {
  sessionKey: string
  items: Array<{ name: string; quantity: number; price: number }>
  total: number
  customerName: string | null
  tipPercent: number | null
  confirmedAt: string | null
  updatedAt: string
}

export interface PosDisplayPublic {
  organizationName: string
  branchName: string | null
  displayName: string
  state: PosDisplayState | null
  menus: Array<{ id: string; name: string; description: string | null }>
}
