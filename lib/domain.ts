/** Dominio del negocio: `naranjapimienta.cafe`. */
export const DOMAIN_PATTERN =
  /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/

export function normalizeDomain(value: string): string {
  return value.trim().toLowerCase()
}

export function isValidDomain(value: string): boolean {
  return value.length >= 3 && value.length <= 80 && DOMAIN_PATTERN.test(value)
}

export interface DomainAvailability {
  domain: string
  available: boolean
  reason?: "taken" | "invalid"
}

/** Dominio propuesto a partir del nombre del negocio: «Naranja Pimienta» → `naranjapimienta.cafe`. */
export function domainFromName(name: string): string {
  const slug = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 60)

  return slug ? `${slug}.cafe` : ""
}
