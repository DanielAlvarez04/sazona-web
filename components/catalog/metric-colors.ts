const GREEN = "text-emerald-600 dark:text-emerald-400"
const AMBER = "text-amber-600 dark:text-amber-400"
const RED = "text-destructive"
const CURRENT = "text-muted-foreground"

/** Color del Costo % según su participación en el precio. */
export function costPercentClass(share: number | null): string {
  if (share === null || !Number.isFinite(share)) return CURRENT
  if (share <= 0.2) return GREEN
  if (share <= 0.35) return CURRENT
  if (share <= 0.5) return AMBER
  return RED
}

/** Color del Margen % según el margen bruto. */
export function marginPercentClass(share: number | null): string {
  if (share === null || !Number.isFinite(share)) return CURRENT
  if (share >= 0.8) return GREEN
  if (share >= 0.65) return CURRENT
  if (share >= 0.5) return AMBER
  return RED
}
