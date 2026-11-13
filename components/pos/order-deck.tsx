"use client"

import * as React from "react"

import type { Order } from "@/lib/orders"
import { cn } from "@/lib/utils"

/** Minutos que debe arrastrarse para cambiar de comanda. */
const SWIPE_THRESHOLD_PX = 64
/** Distancia mínima para considerar que el gesto es horizontal. */
const SWIPE_START_PX = 8
/** Solo debajo de este ancho (el mismo corte que usa la rejilla del POS). */
const MOBILE_QUERY = "(max-width: 1023px)"

/**
 * Devuelve el id de la comanda vecina o `null` si no hay movimiento.
 *
 * `""` representa la comanda nueva (borrador). El orden recibido es del más
 * antiguo al más reciente: avanzar (1) va hacia cuentas más nuevas.
 */
export function adjacentOrderId(
  orders: Order[],
  activeId: string,
  direction: -1 | 1
): string | null {
  const index = orders.findIndex((order) => order.id === activeId)

  if (direction === 1) {
    if (index === -1) return orders[0]?.id ?? null

    return orders[index + 1]?.id ?? null
  }

  if (index === -1) return null
  if (index === 0) return ""

  return orders[index - 1].id
}

/** `true` si el viewport usa la disposición móvil del POS. */
function useMobileSwipe(): boolean {
  const [mobile, setMobile] = React.useState(false)

  React.useEffect(() => {
    const query = window.matchMedia(MOBILE_QUERY)
    const update = () => setMobile(query.matches)

    update()
    query.addEventListener("change", update)

    return () => query.removeEventListener("change", update)
  }, [])

  return mobile
}

/**
 * Deslizamiento horizontal entre comandas activas.
 *
 * La pila ya no se dibuja: en escritorio se cambia de cuenta con el selector
 * del encabezado y los atajos. En móvil se conserva el gesto de tarjeta para
 * pasar a la comanda anterior o siguiente.
 *
 * Usa Pointer Events (dedo, mouse o lápiz), ignora los gestos que empiezan en
 * un control y convive con el scroll vertical de la página.
 */
export function OrderDeck({
  orders,
  activeId,
  onSelect,
  children,
}: {
  /** Cuentas abiertas ordenadas de la más antigua a la más reciente. */
  orders: Order[]
  /** `""` = comanda nueva. */
  activeId: string
  onSelect: (id: string) => void
  /** Comanda editable. */
  children: React.ReactNode
}) {
  const mobile = useMobileSwipe()
  const nextId = adjacentOrderId(orders, activeId, 1)
  const previousId = adjacentOrderId(orders, activeId, -1)

  const surfaceRef = React.useRef<HTMLDivElement | null>(null)
  const startRef = React.useRef<{
    x: number
    y: number
    pointerId: number
  } | null>(null)
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const [offset, setOffset] = React.useState(0)
  const [dragging, setDragging] = React.useState(false)
  const [leaving, setLeaving] = React.useState<-1 | 1 | null>(null)

  React.useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const reducedMotion = React.useCallback(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    []
  )

  const go = React.useCallback(
    (target: string | null, direction: -1 | 1) => {
      if (target === null) return

      if (reducedMotion()) {
        onSelect(target)
        return
      }

      setLeaving(direction)

      if (timerRef.current) clearTimeout(timerRef.current)

      timerRef.current = setTimeout(() => {
        onSelect(target)
        setLeaving(null)
        setOffset(0)
      }, 160)
    },
    [onSelect, reducedMotion]
  )

  /** ¿El gesto nació en un control que debe conservar su comportamiento? */
  function isInteractive(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) return false

    return Boolean(
      target.closest(
        "button, a, input, textarea, select, [role='combobox'], [role='slider'], [contenteditable='true'], [data-no-swipe]"
      )
    )
  }

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!mobile) return
    if (event.pointerType === "mouse" && event.button !== 0) return
    if (isInteractive(event.target)) return
    if (leaving) return

    startRef.current = {
      x: event.clientX,
      y: event.clientY,
      pointerId: event.pointerId,
    }
  }

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = startRef.current

    if (!start) return

    const dx = event.clientX - start.x
    const dy = event.clientY - start.y

    if (!dragging) {
      if (Math.abs(dx) < SWIPE_START_PX) return

      // El gesto es vertical: se suelta para no competir con el scroll.
      if (Math.abs(dy) > Math.abs(dx)) {
        startRef.current = null
        return
      }

      surfaceRef.current?.setPointerCapture(event.pointerId)
      setDragging(true)
    }

    const limit =
      (dx < 0 ? nextId !== null : previousId !== null) ? 240 : 84

    setOffset(Math.max(-limit, Math.min(limit, dx)))
  }

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = startRef.current
    startRef.current = null

    if (!start) return
    if (surfaceRef.current?.hasPointerCapture(event.pointerId)) {
      surfaceRef.current.releasePointerCapture(event.pointerId)
    }

    if (!dragging) return

    const dx = event.clientX - start.x

    setDragging(false)
    setOffset(0)

    if (dx <= -SWIPE_THRESHOLD_PX) {
      go(nextId, 1)
      return
    }

    if (dx >= SWIPE_THRESHOLD_PX) {
      go(previousId, -1)
    }
  }

  const onPointerCancel = () => {
    startRef.current = null
    setDragging(false)
    setOffset(0)
  }

  const style: React.CSSProperties = dragging
    ? {
        transform: `translateX(${offset}px) rotate(${offset / 80}deg)`,
        transition: "none",
        touchAction: "pan-y",
      }
    : leaving !== null
      ? {
          transform: `translateX(${leaving * 60}%) rotate(${leaving * 8}deg)`,
          opacity: 0,
          transition: "transform 160ms ease, opacity 160ms ease",
          touchAction: "pan-y",
        }
      : { touchAction: "pan-y" }

  return (
    <div
      ref={surfaceRef}
      style={style}
      className={cn("rounded-xl", dragging && "cursor-grabbing select-none")}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      {children}
    </div>
  )
}
