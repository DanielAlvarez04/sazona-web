/**
 * Registro único de atajos de teclado de la aplicación.
 *
 * Cada atajo se declara aquí (combinación, etiqueta, descripción y grupo) y los
 * componentes se suscriben por `id` con `useShortcut`. La idea es que ninguna
 * combinación quede escrita a mano dentro de un componente: así se pueden
 * listar en un futuro panel de comandos o en la ayuda de atajos, y cambiarlas
 * es editar una sola línea.
 *
 * Para agregar un atajo:
 * 1. Añade el `id` a `ShortcutId`.
 * 2. Añade su definición a `SHORTCUTS`.
 * 3. En el componente: `useShortcut("<id>", handler)`.
 */

export type ShortcutId = "theme.toggle"

/** Grupos usados para ordenar la futura ayuda/panel de comandos. */
export type ShortcutGroup = "Apariencia" | "Navegación" | "Operación" | "Edición"

export interface ShortcutCombo {
  /** Tecla en minúsculas: `l`, `enter`, `escape`, `arrowdown`... */
  key: string
  /** ⌘ en macOS, Ctrl en el resto de plataformas. */
  mod?: boolean
  /** Ctrl explícito (en macOS se muestra como ⌃). */
  ctrl?: boolean
  /** Tecla Windows / ⌘ explícita. */
  meta?: boolean
  alt?: boolean
  shift?: boolean
}

export interface ShortcutDefinition {
  id: ShortcutId
  /** Nombre corto del comando, para menús y ayuda. */
  label: string
  /** Qué hace el comando. */
  description: string
  group: ShortcutGroup
  /** Combinaciones válidas. La primera es la principal. */
  combos: ShortcutCombo[]
}

export const SHORTCUTS: readonly ShortcutDefinition[] = [
  {
    id: "theme.toggle",
    label: "Cambiar tema",
    description: "Alterna entre modo claro y oscuro.",
    group: "Apariencia",
    // `Fn` no llega al navegador: los teclados lo resuelven en firmware y no
    // emiten un `keydown` propio. La combinación capturable más cercana es
    // Shift + L (⇧ + L en macOS).
    combos: [{ key: "l", shift: true }],
  },
]

export function getShortcut(id: ShortcutId): ShortcutDefinition {
  const shortcut = SHORTCUTS.find((candidate) => candidate.id === id)

  if (!shortcut) {
    throw new Error(`Atajo desconocido: ${id}`)
  }

  return shortcut
}

/** `true` en macOS/iOS, donde los modificadores se muestran con símbolos. */
export function isApplePlatform(): boolean {
  if (typeof navigator === "undefined") return false

  return /mac|iphone|ipad|ipod/i.test(navigator.userAgent)
}

const KEY_LABELS: Record<string, string> = {
  " ": "Espacio",
  arrowup: "↑",
  arrowdown: "↓",
  arrowleft: "←",
  arrowright: "→",
  backspace: "⌫",
  delete: "Supr",
  enter: "Enter",
  escape: "Esc",
  tab: "Tab",
}

/**
 * Compara la tecla física además de `event.key`: en macOS `⌥ L` produce el
 * carácter `¬`, así que `event.key` no sirve para atajos con Alt.
 *
 * Algunos eventos sintéticos (extensiones del navegador, librerías que
 * re-emiten `keydown`) llegan sin `key`, así que nunca se asume que exista.
 */
function matchesKey(event: KeyboardEvent, key: string): boolean {
  const pressed = typeof event.key === "string" ? event.key.toLowerCase() : ""

  if (pressed === key) return true

  if (key.length === 1 && /[a-z0-9]/.test(key)) {
    const code = typeof event.code === "string" ? event.code : ""

    return (
      code === `Key${key.toUpperCase()}` ||
      code === `Digit${key}` ||
      code === `Numpad${key}`
    )
  }

  return false
}

/** Compara modificadores de forma exacta: `Alt+L` no dispara con `Ctrl+Alt+L`. */
export function matchesCombo(event: KeyboardEvent, combo: ShortcutCombo): boolean {
  if (!matchesKey(event, combo.key)) return false

  const apple = isApplePlatform()
  const wantsMeta = combo.meta ?? (combo.mod ? apple : false)
  const wantsCtrl = combo.ctrl ?? (combo.mod ? !apple : false)

  return (
    event.altKey === Boolean(combo.alt) &&
    event.ctrlKey === Boolean(wantsCtrl) &&
    event.metaKey === Boolean(wantsMeta) &&
    event.shiftKey === Boolean(combo.shift)
  )
}

/** Atajo que corresponde al evento, o `null` si ninguno. */
export function findShortcutForEvent(
  event: KeyboardEvent
): ShortcutDefinition | null {
  for (const shortcut of SHORTCUTS) {
    if (shortcut.combos.some((combo) => matchesCombo(event, combo))) {
      return shortcut
    }
  }

  return null
}

/**
 * Si el atajo lleva Alt/Ctrl/⌘ puede dispararse mientras se escribe; una tecla
 * suelta (o con Shift) no, para no robar caracteres a los formularios.
 */
export function hasNonShiftModifier(shortcut: ShortcutDefinition): boolean {
  return shortcut.combos.some(
    (combo) => combo.alt || combo.ctrl || combo.meta || combo.mod
  )
}

/** Partes legibles de una combinación: `["Alt", "L"]`. */
export function formatCombo(combo: ShortcutCombo, apple = false): string[] {
  const parts: string[] = []

  if (combo.mod) parts.push(apple ? "⌘" : "Ctrl")
  if (combo.ctrl) parts.push(apple ? "⌃" : "Ctrl")
  if (combo.meta) parts.push(apple ? "⌘" : "Win")
  if (combo.alt) parts.push(apple ? "⌥" : "Alt")
  if (combo.shift) parts.push(apple ? "⇧" : "Mayús")

  parts.push(KEY_LABELS[combo.key] ?? combo.key.toUpperCase())

  return parts
}

/** Combinación principal lista para mostrar: `Alt + L`. */
export function formatShortcut(
  shortcut: ShortcutDefinition,
  apple = false
): string {
  return formatCombo(shortcut.combos[0], apple).join(" + ")
}
