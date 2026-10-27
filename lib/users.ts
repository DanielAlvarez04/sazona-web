export const ROLE_CODES = [
  "ADMIN",
  "WAITER",
  "KITCHEN",
  "CASHIER",
  "INVENTORY_MANAGER",
] as const

export type RoleCode = (typeof ROLE_CODES)[number]

export interface InternalUser {
  id: string
  email: string | null
  username: string | null
  name: string | null
  isActive: boolean
  emailVerified: boolean
  twoFactorEnabled: boolean
  googleLinked: boolean
  roles: RoleCode[]
  createdAt: string
}

/** Etiqueta visible de cada rol, con su alcance resumido. */
export const ROLE_OPTIONS: Array<{
  value: RoleCode
  label: string
  description: string
}> = [
  {
    value: "ADMIN",
    label: "Administrador",
    description: "Gestiona el negocio, el equipo y la configuración.",
  },
  {
    value: "WAITER",
    label: "Mesero",
    description: "Toma pedidos y registra pagos desde el punto de venta.",
  },
  {
    value: "KITCHEN",
    label: "Cocina",
    description: "Avanza los pedidos en la pantalla de cocina.",
  },
  {
    value: "CASHIER",
    label: "Cajero",
    description: "Confirma pagos y consulta reportes de ventas.",
  },
  {
    value: "INVENTORY_MANAGER",
    label: "Inventario",
    description: "Administra catálogo, recetas e inventario.",
  },
]
