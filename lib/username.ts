/** Igual que en la API: se comparan y guardan siempre en minúsculas. */
export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase()
}

export interface UsernameAvailability {
  username: string
  available: boolean
  reason?: "taken" | "invalid"
}

export interface UsernameSuggestion {
  username: string
  domain: string | null
}

const USERNAME_LOCAL_PATTERN = /^[a-z0-9._-]+$/
const DOMAIN_PATTERN =
  /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/

/**
 * Acepta `ana` (cuentas antiguas) o `ana@naranjapimienta.cafe`.
 *
 * Debe coincidir con `isValidUsername` de la API.
 */
export function isValidUsername(value: string): boolean {
  if (value.length < 3 || value.length > 120) return false

  const parts = value.split("@")

  if (parts.length > 2) return false
  if (!USERNAME_LOCAL_PATTERN.test(parts[0])) return false
  if (parts.length === 1) return true

  return parts[1].length >= 3 && parts[1].length <= 80 && DOMAIN_PATTERN.test(parts[1])
}
