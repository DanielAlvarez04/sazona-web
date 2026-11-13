"use client"

import { CircleDollarSignIcon } from "lucide-react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { formatMoney } from "@/lib/catalog"

/** Extremos del rango en pesos; `null` significa sin filtro. */
export type PriceRange = [number, number]

/**
 * Filtro de rango de precio visible en la barra de filtros (sin popover).
 *
 * El rango disponible se toma de los precios existentes, así que el control
 * nunca permite elegir límites sin artículos. Al volver al rango completo el
 * filtro se marca como inactivo (`null`) y deja de contar para «Limpiar».
 */
export function ArticlePriceFilter({
  min,
  max,
  value,
  onChange,
  bare = false,
}: {
  /** Precio más bajo disponible (incluido). */
  min: number
  /** Precio más alto disponible (incluido). */
  max: number
  value: PriceRange | null
  onChange: (value: PriceRange | null) => void
  /**
   * Modo básico para popovers: solo la etiqueta y el slider, sin borde, fondo,
   * icono ni botón de limpiar. `/catalog` mantiene el diseño completo.
   */
  bare?: boolean
}) {
  const range = value ?? [min, max]
  const active = value !== null

  function update(next: number | readonly number[]) {
    const values = Array.isArray(next) ? next : [next, next]
    const from = Math.max(min, Math.min(...values))
    const to = Math.min(max, Math.max(...values))

    onChange(from <= min && to >= max ? null : [from, to])
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-2",
        !bare &&
          "rounded-md border border-input px-2.5 py-2 shadow-xs dark:bg-input/30",
        !bare && active && "border-primary/70 dark:border-primary/70"
      )}
    >
      <div className="flex h-6 items-center justify-between gap-2">
        <span
          className={cn(
            "flex min-w-0 items-center gap-1.5",
            bare
              ? "text-xs font-medium text-muted-foreground"
              : "text-sm font-medium"
          )}
        >
          {bare ? null : (
            <CircleDollarSignIcon className="size-4 shrink-0 text-muted-foreground" />
          )}
          Precio
        </span>
        {bare ? null : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!active}
            aria-hidden={!active}
            tabIndex={active ? undefined : -1}
            className={cn(
              "h-6 px-1.5 text-xs text-muted-foreground",
              !active && "invisible"
            )}
            onClick={() => onChange(null)}
          >
            Limpiar
          </Button>
        )}
      </div>

      <Slider
        min={min}
        max={max}
        step={1}
        value={range}
        aria-label="Rango de precio"
        onValueChange={update}
      />

      <div className="flex items-center justify-between text-xs text-muted-foreground tabular-nums">
        <span className={cn(active && "text-foreground")}>
          {formatMoney(range[0])}
        </span>
        <span className={cn(active && "text-foreground")}>
          {formatMoney(range[1])}
        </span>
      </div>
    </div>
  )
}
