"use client"

import { createPortal } from "react-dom"
import { XIcon } from "lucide-react"

import { cn } from "cn"

export interface MenuWheelChip {
  group: string | null
  label: string
}

/** Chip ya posicionado en coordenadas de viewport. */
export interface MenuWheelChipPlacement extends MenuWheelChip {
  x: number
  y: number
}

export interface MenuWheelLayout {
  /**
   * Foco de la parábola: aquí se dibuja el botón circular de cancelar y a
   * donde vuelven las cards cuando no hay destino.
   */
  center: { x: number; y: number }
  chips: MenuWheelChipPlacement[]
  /** Distancia del foco al chip más lejano (borde de la última parábola). */
  radius: number
  /** Distancia del foco al chip más cercano («radio menor»). */
  shortRadius: number
  /** `1` = las parábolas abren a la derecha del foco, `-1` a la izquierda. */
  direction: 1 | -1
}

/** Debajo de esta distancia al foco no se elige ningún grupo. */
export const MENU_WHEEL_DEAD_ZONE = 26

/** Chips como máximo en cada parábola; si hay más se abre otra capa. */
const MAX_CHIPS_PER_PARABOLA = 10
/** Ancho máximo de un chip, usado para reservar espacio en los bordes. */
const CHIP_WIDTH = 128
/** Alto máximo del conjunto: 4/5 del viewport. */
const MAX_HEIGHT_RATIO = 0.8
/** Espaciado fijo entre chips, medido sobre el arco de la parábola. */
const CHIP_SPACING = 46
/** Relación foco → vértice de las parábolas: `p = FOCAL_RATIO · alto`. */
const FOCAL_RATIO = 1.5
/** Separación horizontal entre una parábola y la siguiente. */
const LAYER_GAP = 150
/**
 * Fracción del radio menor que hay que recorrer desde el foco antes de que un
 * chip pueda quedar seleccionado. Antes de eso sigue activo «cancelar».
 */
const SNAP_DISTANCE_RATIO = 0.6
/**
 * Margen de cancelación por distancia: se suma este tanto del radio menor al
 * borde de la última parábola.
 */
const CANCEL_MARGIN_RATIO = 0.4
/** Muestras para repartir los chips por longitud de arco. */
const SAMPLES = 240

function wheelChips(groups: string[]): MenuWheelChip[] {
  return [
    { group: null, label: "Sin grupo" },
    ...groups.map((group) => ({ group, label: group })),
  ]
}

/**
 * Parábolas abiertas hacia la derecha cuya primera curva tiene su **foco** en
 * el botón de cancelar.
 *
 * Con el foco en `(0, 0)` la curva es `x = p − y² / 4p`; el vértice queda a
 * `p` del foco y los brazos se acercan a él. Así los chips están siempre a la
 * derecha del puntero, la distancia crece hacia los extremos y el cancelar
 * queda dentro de la curva. El foco se mantiene siempre en el centro vertical
 * del viewport.
 *
 * Hasta 10 chips por parábola. Con más se reparten en capas equilibradas que
 * conservan la misma forma y se trasladan `LAYER_GAP` a la derecha. El alto de
 * cada capa sale de su contenido: `arco = (chips − 1) · CHIP_SPACING`, así que
 * el hueco entre chips es constante en todas las capas. Los chips se ordenan
 * desde el centro vertical de la curva hacia arriba/abajo.
 */
function buildParabolas(
  origin: { x: number; y: number },
  chips: MenuWheelChip[]
): MenuWheelLayout {
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const count = chips.length

  const layers = Math.max(1, Math.ceil(count / MAX_CHIPS_PER_PARABOLA))
  const perLayer = Math.ceil(count / layers)

  // Curva unitaria (H = 1). Su largo de arco permite convertir el número de
  // chips de una capa en su alto exacto para el gap fijo.
  const vertexDrop = 1 / (4 * FOCAL_RATIO)
  const points: Array<{ x: number; y: number }> = []
  const lengths: number[] = []
  let total = 0
  let previous: { x: number; y: number } | null = null

  for (let index = 0; index <= SAMPLES; index += 1) {
    const t = -1 + (2 * index) / SAMPLES
    const point = {
      x: FOCAL_RATIO - vertexDrop * t * t,
      y: t,
    }

    if (previous) {
      total += Math.hypot(point.x - previous.x, point.y - previous.y)
    }

    points.push(point)
    lengths.push(total)
    previous = point
  }

  /**
   * Alto de una capa a partir de su contenido: el gap es fijo y el alto sale
   * de cuántos chips lleva. Un chip suelto usa tres pasos para no tocar el
   * botón de cancelar.
   */
  function halfHeightFor(chipCount: number) {
    const steps = chipCount > 1 ? chipCount - 1 : 3

    return (steps * CHIP_SPACING) / total
  }

  const maxHalfHeight = halfHeightFor(perLayer)
  // Solo se escala si la capa más alta no cabe en los 4/5 del viewport.
  const fit = Math.min(
    1,
    (MAX_HEIGHT_RATIO * viewportHeight) / 2 / maxHalfHeight
  )

  // El foco es el botón de cancelar y vive siempre en el centro vertical.
  const center = { x: origin.x, y: viewportHeight / 2 }

  const outermost =
    FOCAL_RATIO * maxHalfHeight * fit + (layers - 1) * LAYER_GAP

  // Abre a la derecha, salvo que no quepa y haya más espacio a la izquierda.
  const rightSpace = viewportWidth - center.x - CHIP_WIDTH / 2 - 24
  const leftSpace = center.x - CHIP_WIDTH / 2 - 24
  const direction: 1 | -1 =
    outermost > rightSpace && leftSpace > rightSpace ? -1 : 1

  const placements: MenuWheelChipPlacement[] = []

  for (let layer = 0; layer < layers; layer += 1) {
    const start = layer * perLayer
    const layerChips = chips.slice(start, start + perLayer)
    if (layerChips.length === 0) continue

    const offset = layer * LAYER_GAP
    const halfHeight = halfHeightFor(layerChips.length) * fit

    if (layerChips.length === 1) {
      placements.push({
        ...layerChips[0],
        x: center.x + direction * (FOCAL_RATIO * halfHeight + offset),
        y: center.y,
      })
      continue
    }

    // Posiciones equiespaciadas por longitud de arco (gap constante).
    const slots: Array<{ x: number; y: number }> = []
    let cursor = 0

    for (let index = 0; index < layerChips.length; index += 1) {
      const target = (total * index) / (layerChips.length - 1)

      while (cursor < lengths.length - 2 && lengths[cursor + 1] < target) {
        cursor += 1
      }

      const from = points[cursor]
      const to = points[Math.min(cursor + 1, points.length - 1)]
      const span = lengths[cursor + 1] - lengths[cursor]
      const ratio = span > 0 ? (target - lengths[cursor]) / span : 0

      slots.push({
        x: from.x + (to.x - from.x) * ratio,
        y: from.y + (to.y - from.y) * ratio,
      })
    }

    // Los chips se ordenan desde el centro vertical hacia arriba/abajo.
    const middle = (layerChips.length - 1) / 2
    const order = slots
      .map((_, index) => index)
      .sort((left, right) => {
        const byDistance =
          Math.abs(left - middle) - Math.abs(right - middle)

        return byDistance !== 0 ? byDistance : left - right
      })

    layerChips.forEach((chip, index) => {
      const slot = slots[order[index]]

      placements.push({
        ...chip,
        x: center.x + direction * (slot.x * halfHeight + offset),
        y: center.y + slot.y * halfHeight,
      })
    })
  }

  const radius = placements.reduce(
    (max, chip) =>
      Math.max(max, Math.hypot(chip.x - center.x, chip.y - center.y)),
    0
  )
  const shortRadius = placements.reduce(
    (min, chip) =>
      Math.min(min, Math.hypot(chip.x - center.x, chip.y - center.y)),
    Number.POSITIVE_INFINITY
  )

  return {
    center,
    chips: placements,
    radius,
    shortRadius: Number.isFinite(shortRadius) ? shortRadius : 0,
    direction,
  }
}

/**
 * Posición de los chips de la guía que aparece al arrastrar desde el catálogo.
 */
export function buildMenuWheelLayout(
  origin: { x: number; y: number },
  groups: string[]
): MenuWheelLayout | null {
  if (typeof window === "undefined") return null

  return buildParabolas(origin, wheelChips(groups))
}

/**
 * Grupo que corresponde a la posición del puntero.
 *
 * `undefined` = sin destino (zona muerta, antes de 3/5 del radio menor,
 * detrás del foco o más allá del límite de la última parábola), `null` =
 * «Sin grupo».
 */
export function menuWheelTargetAt(
  layout: MenuWheelLayout,
  point: { x: number; y: number }
): string | null | undefined {
  const dx = point.x - layout.center.x
  const dy = point.y - layout.center.y
  const distance = Math.hypot(dx, dy)

  if (distance < MENU_WHEEL_DEAD_ZONE) return undefined

  // El snap se activa a 3/5 del radio menor; antes de eso sigue «cancelar».
  if (distance < layout.shortRadius * SNAP_DISTANCE_RATIO) return undefined

  // Límite: borde de la última parábola + 2/5 del radio menor.
  if (distance > layout.radius + layout.shortRadius * CANCEL_MARGIN_RATIO) {
    return undefined
  }

  // Detrás del foco no hay chips: también se cancela.
  if (dx * layout.direction <= 0) return undefined

  let best: MenuWheelChipPlacement | null = null
  let bestDistance = Number.POSITIVE_INFINITY

  for (const chip of layout.chips) {
    const chipDistance = Math.hypot(point.x - chip.x, point.y - chip.y)

    if (chipDistance < bestDistance) {
      best = chip
      bestDistance = chipDistance
    }
  }

  return best ? best.group : undefined
}

/**
 * Centro (en coordenadas de viewport) del chip seleccionado o del botón de
 * cancelar. Se usa para hacer que las cards hagan snap al objetivo.
 */
export function menuWheelTargetCenter(
  layout: MenuWheelLayout,
  target: string | null | undefined
): { x: number; y: number } {
  if (target === undefined) return layout.center

  const chip = layout.chips.find((entry) => entry.group === target)

  return chip ? { x: chip.x, y: chip.y } : layout.center
}

/**
 * Guía visual de grupos que aparece al arrastrar cards del catálogo.
 *
 * No es un droppable de dnd-kit: el destino se calcula por geometría
 * (`menuWheelTargetAt`) y este componente solo pinta los chips y resalta el
 * que corresponde al puntero.
 */
export function MenuWheelGroups({
  origin,
  groups,
  target,
}: {
  origin: { x: number; y: number }
  groups: string[]
  target: string | null | undefined
}) {
  if (typeof document === "undefined") return null

  const layout = buildMenuWheelLayout(origin, groups)
  if (!layout) return null

  const { center, chips } = layout

  return (
    <>
      {/* Blur de 8 px con un tinte muy leve de --background. */}
      {createPortal(
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-[105] animate-in bg-background/10 backdrop-blur-[8px] fade-in-0 duration-150"
        />,
        document.body
      )}

      {/* Guía por encima de todo, incluidas las cards del stack. */}
      {createPortal(
        <div className="pointer-events-none fixed inset-0 z-[110] animate-in fade-in-0 duration-150">
          {chips.map((chip) => (
            <div
              key={chip.group ?? "__none__"}
              title={chip.label}
              className={cn(
                "absolute max-w-32 -translate-x-1/2 -translate-y-1/2 truncate rounded-xl border px-3 py-1.5 text-xs font-medium backdrop-blur",
                chip.group === target
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-muted text-foreground"
              )}
              style={{ left: chip.x, top: chip.y }}
            >
              {chip.label}
            </div>
          ))}

          {/* Foco de la parábola = cancelar: rojo sólido cuando está activo. */}
          <div
            aria-hidden
            className={cn(
              "absolute flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 bg-transparent shadow-lg transition-colors",
              target === undefined
                ? "border-red-600 bg-red-600 text-white"
                : "border-border bg-transparent text-muted-foreground"
            )}
            style={{ left: center.x, top: center.y }}
          >
            <XIcon className="size-5" />
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
