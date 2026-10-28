/**
 * Tipos y límites de sucursales.
 *
 * Este módulo lo importan también componentes de cliente, así que no debe
 * depender de `next/headers` ni de `lib/api`. Los helpers de servidor viven en
 * `lib/branch-server.ts`.
 */

/**
 * Límites de uso justo para sucursales (espejo de
 * `api/src/branches/branch-limits.ts`).
 */
export const MAX_ACTIVE_BRANCHES = 5
export const RECOMMENDED_USERS_PER_BRANCH = 15

export interface Branch {
  id: string
  name: string
  address: string | null
  phone: string | null
  isActive: boolean
  userCount?: number
  createdAt?: string
}
