/** Tipos de la caja vinculada por QR y del desbloqueo con PIN. */

export interface PosPairedDevice {
  id: string
  name: string
  branchId: string | null
  branch?: { name: string } | null
  lastSeenAt: string | null
  createdAt: string
  pairedBy?: { name: string | null; username: string | null } | null
}

export interface PosPairingCode {
  code: string
  url: string
  expiresAt: string
}

export interface PosDeviceMember {
  id: string
  name: string | null
  username: string | null
  roles: string[]
  hasPin: boolean
}

export interface PosDeviceSession {
  organizationName: string
  branchId: string | null
  branchName: string | null
  deviceName: string
  members: PosDeviceMember[]
}
