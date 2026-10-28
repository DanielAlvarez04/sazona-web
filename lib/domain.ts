/** Dominio del negocio: `naranjapimienta.com`. */
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

/** Convierte un texto libre en la parte editable de un dominio (sin TLD). */
export function domainBase(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    // Si pegan `negocio.com` o `negocio.cualquier-tld`, conservamos solo la
    // primera etiqueta: el TLD siempre es `.com`.
    .split(".")[0]
    .replace(/[^a-z0-9-]+/g, "")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
}

/** Dominio propuesto a partir del nombre del negocio: «Naranja Pimienta» → `naranjapimienta.com`. */
export function domainFromName(name: string): string {
  const slug = domainBase(name)

  return slug ? `${slug}.com` : ""
}