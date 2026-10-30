"use client"

import * as React from "react"

import {
  findShortcutForEvent,
  hasNonShiftModifier,
  type ShortcutId,
} from "@/lib/keyboard/shortcuts"

type ShortcutHandler = (event: KeyboardEvent) => void
type RegisterShortcut = (
  id: ShortcutId,
  handler: ShortcutHandler
) => () => void

const ShortcutRegistryContext = React.createContext<RegisterShortcut | null>(
  null
)

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true

  const tag = target.tagName

  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT"
}

/**
 * Instala un único listener global de teclado y reparte los eventos entre los
 * componentes suscritos a `lib/keyboard/shortcuts.ts`.
 *
 * Un solo listener evita que cada atajo registre el suyo y garantiza el mismo
 * orden de prioridad y las mismas reglas (ignorar campos de texto, respetar
 * `defaultPrevented`, no repetir con la tecla sostenida).
 */
export function KeyboardShortcutsProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const handlers = React.useRef(new Map<ShortcutId, Set<ShortcutHandler>>())

  const register = React.useCallback<RegisterShortcut>((id, handler) => {
    const set = handlers.current.get(id) ?? new Set<ShortcutHandler>()
    set.add(handler)
    handlers.current.set(id, set)

    return () => {
      set.delete(handler)

      if (set.size === 0) {
        handlers.current.delete(id)
      }
    }
  }, [])

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      // Evento sintético sin `key` (extensiones o librerías que re-emiten
      // `keydown`): no es una pulsación real, así que no hay atajo que buscar.
      if (typeof event.key !== "string") return

      // Otro componente ya lo manejó, o es la repetición de una tecla sostenida.
      if (event.defaultPrevented || event.repeat) return

      // Mientras se escribe solo valen los atajos con Alt/Ctrl/⌘. Se resuelve
      // antes de buscar el atajo para no evaluar combinaciones en cada tecla.
      if (
        isTypingTarget(event.target) &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey
      ) {
        return
      }

      const shortcut = findShortcutForEvent(event)
      if (!shortcut) return

      // Por si el atajo llegara a declararse solo con Shift: nunca se roba una
      // tecla a un campo de texto.
      if (isTypingTarget(event.target) && !hasNonShiftModifier(shortcut)) {
        return
      }

      const set = handlers.current.get(shortcut.id)
      if (!set || set.size === 0) return

      event.preventDefault()

      for (const handler of set) {
        handler(event)
      }
    }

    window.addEventListener("keydown", onKeyDown)

    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  return (
    <ShortcutRegistryContext.Provider value={register}>
      {children}
    </ShortcutRegistryContext.Provider>
  )
}

/**
 * Suscribe `handler` al atajo `id` mientras el componente esté montado.
 * El atajo debe existir en `SHORTCUTS` (ver `lib/keyboard/shortcuts.ts`).
 */
export function useShortcut(
  id: ShortcutId,
  handler: ShortcutHandler,
  enabled = true
) {
  const register = React.useContext(ShortcutRegistryContext)
  const handlerRef = React.useRef(handler)

  if (!register) {
    throw new Error(
      "useShortcut debe usarse dentro de <KeyboardShortcutsProvider>"
    )
  }

  React.useEffect(() => {
    handlerRef.current = handler
  }, [handler])

  React.useEffect(() => {
    if (!enabled) return

    return register(id, (event) => handlerRef.current(event))
  }, [register, id, enabled])
}
