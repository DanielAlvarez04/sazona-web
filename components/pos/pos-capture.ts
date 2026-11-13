"use client"

import { trackEvent } from "@/lib/analytics"

/**
 * Medición implícita de la captura de un pedido en el POS.
 *
 * No hay botones de «iniciar» ni «terminar»: la sesión empieza con la primera
 * interacción real sobre el catálogo (buscar, filtrar o abrir una card) y
 * termina cuando la ronda se envía a cocina, se cambia de cuenta o se descarta.
 *
 * Se guarda en `sessionStorage` para sobrevivir a una recarga de la pestaña.
 * El tiempo activo descarta pausas mayores a `IDLE_CAP_MS`, porque el POS puede
 * quedar abierto mientras el mesero atiende otra mesa.
 */

const STORAGE_KEY = "pos-capture-session-v1"
const IDLE_CAP_MS = 90_000
const MAX_SESSION_MS = 8 * 60 * 60 * 1000

type CaptureOutcome = "sent" | "abandoned" | "switched"

interface CaptureState {
  startedAt: number
  lastTouchAt: number
  activeMs: number
  interactions: number
  firstItemAt: number | null
  items: number
  lines: number
  guests: number
  searches: number
  emptySearches: number
  filters: number
  itemDialogs: number
  validationErrors: number
  searchActive: boolean
}

let state: CaptureState | null = null
let loaded = false
const seenEmptySearches = new Set<string>()

function now(): number {
  return Date.now()
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

function readStorage(): CaptureState | null {
  if (typeof window === "undefined") return null

  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)

    if (!raw) return null

    const parsed = JSON.parse(raw) as Partial<CaptureState>

    if (
      !parsed ||
      typeof parsed.startedAt !== "number" ||
      typeof parsed.lastTouchAt !== "number"
    ) {
      return null
    }

    if (now() - parsed.startedAt > MAX_SESSION_MS) return null

    return {
      startedAt: parsed.startedAt,
      lastTouchAt: Math.min(parsed.lastTouchAt, now()),
      activeMs: numberOr(parsed.activeMs, 0),
      interactions: numberOr(parsed.interactions, 0),
      firstItemAt:
        typeof parsed.firstItemAt === "number" ? parsed.firstItemAt : null,
      items: numberOr(parsed.items, 0),
      lines: numberOr(parsed.lines, 0),
      guests: numberOr(parsed.guests, 0),
      searches: numberOr(parsed.searches, 0),
      emptySearches: numberOr(parsed.emptySearches, 0),
      filters: numberOr(parsed.filters, 0),
      itemDialogs: numberOr(parsed.itemDialogs, 0),
      validationErrors: numberOr(parsed.validationErrors, 0),
      // Tras una recarga no se arrastra una búsqueda a medias.
      searchActive: false,
    }
  } catch {
    return null
  }
}

function ensureLoaded(): void {
  if (loaded) return

  loaded = true
  state = readStorage()
}

function persist(): void {
  if (typeof window === "undefined" || !state) return

  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Sin almacenamiento disponible: el seguimiento dura lo que la pestaña.
  }
}

function clear(): void {
  state = null
  seenEmptySearches.clear()

  if (typeof window === "undefined") return

  try {
    window.sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // Sin almacenamiento disponible: no hay nada que limpiar.
  }
}

function ensureStarted(): CaptureState {
  ensureLoaded()

  if (!state) {
    const stamp = now()

    state = {
      startedAt: stamp,
      lastTouchAt: stamp,
      activeMs: 0,
      interactions: 0,
      firstItemAt: null,
      items: 0,
      lines: 0,
      guests: 0,
      searches: 0,
      emptySearches: 0,
      filters: 0,
      itemDialogs: 0,
      validationErrors: 0,
      searchActive: false,
    }
    persist()
  }

  return state
}

function touch(): CaptureState {
  const current = ensureStarted()
  const stamp = now()
  const gap = stamp - current.lastTouchAt

  if (gap > 0) current.activeMs += Math.min(gap, IDLE_CAP_MS)

  current.lastTouchAt = stamp
  current.interactions += 1
  persist()

  return current
}

/**
 * Actualiza el tiempo activo sin contar una interacción nueva. Se usa al
 * teclear en el buscador para no inflar el conteo con cada letra.
 */
function bump(): void {
  const current = ensureStarted()
  const stamp = now()
  const gap = stamp - current.lastTouchAt

  if (gap > 0) current.activeMs += Math.min(gap, IDLE_CAP_MS)

  current.lastTouchAt = stamp
  persist()
}

/** Primera tecla de una búsqueda: cuenta una búsqueda por sesión. */
export function noteSearch(query: string): void {
  const current = ensureStarted()

  if (!current.searchActive && query.trim()) {
    current.searches += 1
    current.searchActive = true
    touch()
    return
  }

  bump()
}

/** El buscador quedó vacío: la próxima escritura cuenta como nueva búsqueda. */
export function endSearch(): void {
  ensureLoaded()

  if (!state) return

  state.searchActive = false
  persist()
}

/** Búsqueda sin resultados; se deduplica por sesión para no inflar el conteo. */
export function noteEmptySearch(query: string): void {
  const clean = query.trim()

  if (!clean) return

  const key = clean.toLowerCase()

  if (seenEmptySearches.has(key)) return

  seenEmptySearches.add(key)

  const current = ensureStarted()
  current.emptySearches += 1
  touch()

  trackEvent({
    name: "pos.search_no_results",
    subjectName: clean.slice(0, 120),
    metadata: { length: clean.length },
  })
}

/** Cambio de menú, categoría o cualquier filtro del popover. */
export function noteFilter(): void {
  const current = ensureStarted()
  current.filters += 1
  touch()
}

/** Se abrió el diálogo de configuración de un platillo. */
export function noteItemOpened(itemId: string): void {
  const current = ensureStarted()
  current.itemDialogs += 1
  touch()

  trackEvent({
    name: "pos.item_opened",
    itemId,
  })
}

/** Validación fallida dentro del diálogo (opción obligatoria, sin cantidad…). */
export function noteValidationError(reason: string, group?: string): void {
  const current = ensureStarted()
  current.validationErrors += 1
  touch()

  trackEvent({
    name: "pos.validation_error",
    subjectName: reason,
    metadata: group ? { group } : undefined,
  })
}

/** El diálogo se cerró sin guardar. */
export function noteDialogCancelled(
  itemId: string,
  durationMs: number | null
): void {
  touch()

  trackEvent({
    name: "pos.item_dialog_cancelled",
    itemId,
    metadata: durationMs === null ? undefined : { durationMs },
  })
}

/** Actualiza el estado de la comanda (artículos, líneas y clientes). */
export function noteCart(items: number, lines: number, guests: number): void {
  ensureLoaded()

  if (!state && items <= 0) return

  const current = ensureStarted()

  if (current.firstItemAt === null && items > 0) current.firstItemAt = now()

  current.items = Math.max(0, items)
  current.lines = Math.max(0, lines)
  current.guests = Math.max(0, guests)
  touch()
}

/** Descarta una sesión sin emitir evento (p. ej. solo se navegó el catálogo). */
export function discard(): void {
  ensureLoaded()
  clear()
}

/** Cierra la sesión y envía el evento resumen de la ronda. */
export function finish(
  outcome: CaptureOutcome,
  extras: {
    orderId?: string | null
    items: number
    lines: number
    guests: number
    amount?: number
    offline?: boolean
    channel?: string
  }
): void {
  ensureLoaded()

  if (!state) return

  const stamp = now()
  const gap = stamp - state.lastTouchAt
  const wallMs = Math.max(0, stamp - state.startedAt)
  const activeMs = Math.max(
    0,
    Math.min(state.activeMs + Math.max(0, Math.min(gap, IDLE_CAP_MS)), wallMs)
  )
  const idleMs = Math.max(0, wallMs - activeMs)
  const firstItemAt = state.firstItemAt
  const browseMs =
    firstItemAt === null ? null : Math.max(0, firstItemAt - state.startedAt)
  const assemblyMs =
    firstItemAt === null ? null : Math.max(0, stamp - firstItemAt)

  trackEvent({
    name: "pos.order_capture_finished",
    orderId: extras.orderId ?? undefined,
    quantity: extras.items,
    amount: extras.amount,
    metadata: {
      outcome,
      wallMs,
      activeMs,
      idleMs,
      browseMs,
      assemblyMs,
      interactions: state.interactions,
      items: extras.items,
      lines: extras.lines,
      guests: extras.guests,
      searches: state.searches,
      emptySearches: state.emptySearches,
      filters: state.filters,
      itemDialogs: state.itemDialogs,
      validationErrors: state.validationErrors,
      offline: Boolean(extras.offline),
      channel: extras.channel ?? null,
    },
  })

  clear()
}
