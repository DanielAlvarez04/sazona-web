"use client"

import * as React from "react"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { formatMoney } from "@/lib/catalog"
import { elapsedMinutes, orderLabel, type Order } from "@/lib/orders"
import { cn } from "@/lib/utils"

/** Minutos que debe arrastrarse para cambiar de comanda. */
const SWIPE_THRESHOLD_PX = 64
/** Distancia mínima para considerar que el gesto es horizontal. */
const SWIPE_START_PX = 8

/** Tarjetas que se ven detrás de la activa (máximo 3 en total). */
const BACK_CARDS = 2

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

/** Resumen compacto de una tarjeta que asoma detrás de la activa. */
function peekSummary(order: Order): string {
  const lines = order.rounds.reduce(
    (sum, round) =>
      sum + ("_count" in round ? round._count.items : round.items.length),
    0
  )
  const minutes = elapsedMinutes(order.createdAt)

  return [
    lines > 0
      ? `${lines} línea${lines === 1 ? "" : "s"}`
      : "sin artículos",
    order.partySize > 1 ? `${order.partySize} comensales` : null,
    minutes > 0 ? `${minutes} min` : null,
  ]
    .filter(Boolean)
    .join(" · ")
}

/**
 * Pila de comandas activas.
 *
 * La tarjeta frontal es la comanda editable; detrás asoman hasta dos cuentas
 * más con su mesa, total y antigüedad. Se cambia tocando una tarjeta, con las
 * flechas del encabezado o deslizando la tarjeta frontal.
 *
 * El gesto usa Pointer Events, así que funciona con dedo, mouse y lápiz. Se
 * ignora si empieza en un control (botón, campo, selector) y convive con el
 * scroll vertical de la página.
 */
export function OrderDeck({
  orders,
  activeId,
  onSelect,
  children,
  branch,
}: {
  /** Cuentas abiertas ordenadas de la más antigua a la más reciente. */
  orders: Order[]
  /** `""` = comanda nueva. */
  activeId: string
  onSelect: (id: string) => void
  /** Comanda editable (la tarjeta frontal). */
  children: React.ReactNode
  /** `true` en la vista consolidada: muestra la sucursal en las tarjetas. */
  branch?: boolean
}) {
  const index = orders.findIndex((order) => order.id === activeId)
  const nextId = adjacentOrderId(orders, activeId, 1)
  const previousId = adjacentOrderId(orders, activeId, -1)
  const backOrders =
    index === -1
      ? orders.slice(0, BACK_CARDS)
      : orders.slice(index + 1, index + 1 + BACK_CARDS)

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

  const counter =
    index === -1
      ? `Nueva comanda · ${orders.length} abierta${orders.length === 1 ? "" : "s"}`
      : `Comanda ${index + 1} de ${orders.length}`

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
          transition:
            "transform 160ms ease, opacity 160ms ease",
          touchAction: "pan-y",
        }
      : { touchAction: "pan-y" }

  return (
    <div className="relative">
      <div className="mb-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="tabular-nums" aria-live="polite">
          {counter}
        </span>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Comanda anterior"
            disabled={previousId === null}
            onClick={() => go(previousId, -1)}
          >
            <ChevronLeftIcon />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Comanda siguiente"
            disabled={nextId === null}
            onClick={() => go(nextId, 1)}
          >
            <ChevronRightIcon />
          </Button>
        </div>
      </div>

      <div
        ref={surfaceRef}
        role="group"
        aria-roledescription="pila de comandas"
        aria-label={counter}
        style={style}
        className={cn(
          "relative z-20 rounded-xl",
          dragging && "cursor-grabbing select-none"
        )}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        {children}
      </div>

      {backOrders.map((order, position) => (
        <button
          key={order.id}
          type="button"
          aria-label={`Abrir ${orderLabel(order)}, ${formatMoney(order.total)}`}
          onClick={() => onSelect(order.id)}
          className={cn(
            "relative flex w-full items-center gap-2 border border-t-0 bg-card px-4 text-left text-xs text-muted-foreground shadow-sm transition-colors hover:bg-muted/60 hover:text-foreground",
            position === 0
              ? "z-10 mx-1 -mt-2 rounded-b-xl pt-3 pb-2"
              : "z-0 mx-2 -mt-2 rounded-b-xl pt-2.5 pb-2"
          )}
        >
          <span className="min-w-0 flex-1 truncate">
            <span className="font-medium text-foreground">
              {orderLabel(order)}
            </span>
            {branch && order.branch ? ` · ${order.branch.name}` : ""}
            <span className="ml-1.5">{peekSummary(order)}</span>
          </span>
          <span className="shrink-0 font-medium tabular-nums text-foreground">
            {formatMoney(order.total)}
          </span>
        </button>
      ))}
    </div>
  )
}
