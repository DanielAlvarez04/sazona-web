export { cn } from "cn"

/**
 * Contorno de un filtro con valor activo. Usa el color principal de la app como
 * indicador visual; se concatena después de las clases base del control para
 * que el borde principal gane sobre `border-input`.
 */
export const ACTIVE_FILTER_OUTLINE =
  "border-primary bg-primary/5 text-foreground hover:bg-primary/10 aria-expanded:bg-primary/10 dark:border-primary/70 dark:bg-primary/10 dark:hover:bg-primary/15"
