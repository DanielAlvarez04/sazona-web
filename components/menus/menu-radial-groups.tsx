"use client"

import { createPortal } from "react-dom"
import { XIcon } from "lucide-react"

import { cn } from "cn"

export interface MenuWheelChip {
  group: string | null
  label: string
}

export interface MenuWheelRing {
  radius: number
  chips: MenuWheelChip[]
}

export interface MenuWheelLayout {
  center: { x: number; y: number }
  rings: MenuWheelRing[]
}

/** Debajo de esta distancia al centro no se elige ningún grupo. */
export const MENU_WHEEL_DEAD_ZONE = 26
/** Chips que caben en un anillo con el radio máximo. */
const CHIPS_PER_RING = 12
/** A partir de este número de chips se usan dos anillos. */
const TWO_RING_THRESHOLD = CHIPS_PER_RING

/** Ancho máximo de un chip; se usa para calcular la separación mínima. */
const CHIP_WIDTH = 128
const CHIP_GAP = 8
const MIN_RADIUS = 96
/** Separación mínima entre el anillo interior y el exterior. */
const RING_GAP = 64
/**
 * Radios máximos: el mayor de cada anillo se calcula para que quepan
 * `CHIPS_PER_RING` chips sin encimarse.
 */
const MAX_INNER_RADIUS = neededRadius(CHIPS_PER_RING)
const MAX_SINGLE_RADIUS = MAX_INNER_RADIUS
const MAX_OUTER_RADIUS = MAX_INNER_RADIUS + RING_GAP

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

/** Radio mínimo para que `count` chips no se encimen (cuerda entre centros). */
function neededRadius(count: number) {
  if (count <= 1) return MIN_RADIUS

  return (CHIP_WIDTH + CHIP_GAP) / (2 * Math.sin(Math.PI / count))
}

function clampAxis(value: number, size: number, margin: number) {
  // En pantallas muy angostas no hay forma de dejar el margen: se centra.
  if (size <= margin * 2) return size / 2
  return Math.min(Math.max(value, margin), size - margin)
}

/**
 * Posición y radios de la rueda radial.
 *
 * La rueda se ancla al punto donde empezó el arrastre (no persigue al cursor)
 * y se recorta para que quepa en la ventana. Si hay más de 12 chips se
 * reparten en dos anillos concéntricos, con capacidad para 12 en cada uno.
 */
export function buildMenuWheelLayout(
  origin: { x: number; y: number },
  groups: string[]
): MenuWheelLayout | null {
  if (typeof window === "undefined") return null

  const chips: MenuWheelChip[] = [
    { group: null, label: "Sin grupo" },
    ...groups.map((group) => ({ group, label: group })),
  ]

  let baseRings: MenuWheelRing[]

  if (chips.length > TWO_RING_THRESHOLD) {
    const middle = Math.ceil(chips.length / 2)
    const innerChips = chips.slice(0, middle)
    const outerChips = chips.slice(middle)
    const innerRadius = clamp(
      neededRadius(innerChips.length),
      MIN_RADIUS,
      MAX_INNER_RADIUS
    )
    const outerRadius = clamp(
      Math.max(neededRadius(outerChips.length), innerRadius + RING_GAP),
      innerRadius + RING_GAP,
      MAX_OUTER_RADIUS
    )

    baseRings = [
      { radius: innerRadius, chips: innerChips },
      { radius: outerRadius, chips: outerChips },
    ]
  } else {
    baseRings = [
      {
        radius: clamp(
          neededRadius(chips.length),
          MIN_RADIUS,
          MAX_SINGLE_RADIUS
        ),
        chips,
      },
    ]
  }

  const maxRadius = Math.max(...baseRings.map((ring) => ring.radius))
  const available = Math.max(
    120,
    Math.min(window.innerWidth, window.innerHeight) / 2 - 72
  )
  const scale = Math.min(1, available / maxRadius)
  const rings = baseRings.map((ring) => ({
    ...ring,
    radius: Math.max(72, ring.radius * scale),
  }))
  const margin = Math.max(...rings.map((ring) => ring.radius)) + 72

  return {
    center: {
      x: clampAxis(origin.x, window.innerWidth, margin),
      y: clampAxis(origin.y, window.innerHeight, margin),
    },
    rings,
  }
}

/**
 * Grupo que corresponde a la dirección del puntero.
 *
 * `undefined` = sin destino (zona muerta), `null` = «Sin grupo».
 */
export function menuWheelTargetAt(
  layout: MenuWheelLayout,
  point: { x: number; y: number }
): string | null | undefined {
  const dx = point.x - layout.center.x
  const dy = point.y - layout.center.y
  const distance = Math.hypot(dx, dy)

  if (distance < MENU_WHEEL_DEAD_ZONE) return undefined

  const outerRadius = Math.max(...layout.rings.map((ring) => ring.radius))
  // El margen para cancelar fuera del radio mide lo mismo que el radio.
  if (distance > outerRadius * 2) return undefined

  const angle = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360
  const ring =
    layout.rings.length > 1 &&
    distance > (layout.rings[0].radius + layout.rings[1].radius) / 2
      ? layout.rings[1]
      : layout.rings[0]

  // El grupo se selecciona a 1/4 del trayecto entre el borde del círculo de
  // cancelar y el centro del chip; antes de eso sigue activo «cancelar».
  const snapThreshold =
    MENU_WHEEL_DEAD_ZONE +
    (ring.radius - MENU_WHEEL_DEAD_ZONE) / 4
  if (distance < snapThreshold) return undefined

  let best: MenuWheelChip | null = null
  let bestDiff = 360

  ring.chips.forEach((chip, index) => {
    const chipAngle = (-90 + (360 / ring.chips.length) * index + 360) % 360
    const diff = Math.abs(((angle - chipAngle + 540) % 360) - 180)

    if (diff < bestDiff) {
      best = chip
      bestDiff = diff
    }
  })

  return best ? (best as MenuWheelChip).group : undefined
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

  for (const ring of layout.rings) {
    const index = ring.chips.findIndex((chip) => chip.group === target)

    if (index < 0) continue

    const angle =
      ((-90 + (360 / ring.chips.length) * index) * Math.PI) / 180

    return {
      x: layout.center.x + ring.radius * Math.cos(angle),
      y: layout.center.y + ring.radius * Math.sin(angle),
    }
  }

  return layout.center
}

/**
 * Rueda visual de grupos que aparece al arrastrar cards del catálogo.
 *
 * No es un droppable de dnd-kit: el destino se calcula por geometría
 * (`menuWheelTargetAt`) y este componente solo pinta los chips y resalta el
 * que corresponde a la dirección del puntero.
 */
export function MenuRadialGroups({
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

  const { center, rings } = layout

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

      {/* Rueda por encima de todo, incluidas las cards del stack. */}
      {createPortal(
        <div className="pointer-events-none fixed inset-0 z-[110] animate-in fade-in-0 duration-150">
          {rings.map((ring) => (
            <div
              key={ring.radius}
              className="absolute rounded-full border border-dashed border-border/50"
              style={{
                left: center.x - ring.radius,
                top: center.y - ring.radius,
                width: ring.radius * 2,
                height: ring.radius * 2,
              }}
            />
          ))}

          {rings.flatMap((ring) =>
            ring.chips.map((chip, index) => {
              const angle =
                ((-90 + (360 / ring.chips.length) * index) * Math.PI) / 180
              const x = center.x + ring.radius * Math.cos(angle)
              const y = center.y + ring.radius * Math.sin(angle)
              const active = chip.group === target

              return (
                <div
                  key={`${ring.radius}-${chip.group ?? "__none__"}`}
                  title={chip.label}
                  className={cn(
                    "absolute max-w-32 -translate-x-1/2 -translate-y-1/2 truncate rounded-xl border px-3 py-1.5 text-xs font-medium backdrop-blur shadow-[0_1px_2px_rgba(0,0,0,0.25),0_14px_30px_-8px_rgba(0,0,0,0.55)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.45),0_16px_34px_-8px_rgba(0,0,0,0.75)]",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-foreground bg-foreground text-background"
                  )}
                  style={{ left: x, top: y }}
                >
                  {chip.label}
                </div>
              )
            })
          )}

          {/* Centro = cancelar: outline inactivo, rojo sólido cuando está activo. */}
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
