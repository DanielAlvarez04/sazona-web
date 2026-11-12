"use client"

import * as React from "react"

/**
 * Duración del shake. Debe coincidir con `np-menu-card-shake` de globals.css.
 * Con el timestamp de selección se calcula un `animation-delay` negativo para
 * que todas las cards queden sincronizadas al mismo reloj.
 */
export const SHAKE_DURATION_MS = 180

/** Sincroniza la animación de shake de una card con el reloj global. */
export function useShake(
  nodeRef: { current: HTMLElement | null },
  active: boolean
) {
  React.useLayoutEffect(() => {
    const node = nodeRef.current
    if (!node) return

    if (!active) {
      node.style.animationDelay = ""
      return
    }

    const timeline =
      typeof document !== "undefined"
        ? Number(document.timeline?.currentTime ?? performance.now())
        : 0

    node.style.animationDelay = `-${timeline % SHAKE_DURATION_MS}ms`
  }, [nodeRef, active])
}
