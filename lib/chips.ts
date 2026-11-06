import { cn } from "cn"

/**
 * «Chips jalapeño» (también llamados «chips verdes» en el equipo).
 *
 * Es el chip de selección múltiple que usa Catálogo para elegir si el producto
 * es Artículo, Receta, Insumo o Combo: píldora pequeña con acento `chart-2`
 * cuando está activa. Se reutiliza en cualquier selector de tipo/etiqueta.
 */
export function jalapenoChipClass(active: boolean): string {
  return cn(
    "h-7 gap-1.5 rounded-full px-2.5 text-xs shadow-none",
    active
      ? "border-chart-2/60 bg-chart-2/10 text-chart-2 hover:bg-chart-2/20 hover:text-chart-2 dark:border-chart-2/50 dark:bg-chart-2/15 dark:hover:bg-chart-2/25"
      : "border-muted-foreground/30 text-muted-foreground hover:bg-muted hover:text-foreground"
  )
}
