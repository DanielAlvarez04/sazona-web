export const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrador",
  WAITER: "Mesero",
  KITCHEN: "Cocina",
  CASHIER: "Cajero",
  INVENTORY_MANAGER: "Inventario",
}

export function roleLabel(role: string | undefined): string | undefined {
  if (!role) return undefined
  return ROLE_LABELS[role] ?? role
}
