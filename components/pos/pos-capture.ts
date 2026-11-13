"use client"

import { trackEvent } from "@/lib/analytics"

/**
 * Medición implícita de la captura de un pedido en el POS.
 *
 * La medición **no** arranca con cualquier interacción. Primero hay una fase
 * de navegación (buscar, filtrar, abrir cards) que solo se usa como ventana
 * candidata. La captura arranca cuando el usuario:
 *
 * - agrega el primer artículo a la comanda, o
 * - empieza a configurar la comanda: elige canal/mesa, ajusta comensales,
 *   agrega o selecciona clientes, les cambia el nombre o el rango de edad.
 *
 * La navegación previa solo se reporta si fue continua (sin pausas mayores a
 * 90 segundos y dentro de una ventana de 5 minutos). Así las pruebas y la
 * exploración no se mezclan con pedidos reales.
 *
 * La sesión se guarda en `sessionStorage` y se descarta después de 2 horas.
 */

const STORAGE_KEY = "pos-capture-session-v2"
const IDLE_CAP_MS = 90_000
const BROWSE_MAX_MS = 5 * 60_000
const PRODUCT_WINDOW_MS = 5 * 60_000
const MAX_CAPTURE_MS = 2 * 60 * 60_000

type CaptureOutcome = "sent" | "abandoned" | "switched"
type CaptureStartReason = "item" | "comanda"

interface CaptureState {
  captureStartedAt: number | null
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
  startReason: CaptureStartReason | null
  browseStartedAt: number | null
  lastBrowseAt: number | null
  browseActiveMs: number
  itemOpenedAt: number | null
  browseMs: number | null
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

function freshState(): CaptureState {
  return {
    captureStartedAt: null,
    lastTouchAt: now(),
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
    startReason: null,
    browseStartedAt: null,
    lastBrowseAt: null,
    browseActiveMs: 0,
    itemOpenedAt: null,
    browseMs: null,
  }
}

function readStorage(): CaptureState | null {
  if (typeof window === "undefined") return null

  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)

    if (!raw) return null

    const parsed = JSON.parse(raw) as Partial<CaptureState>

    if (!parsed || typeof parsed !== "object") return null

    const stamp = now()
    const captureStartedAt =
      typeof parsed.captureStartedAt === "number"
        ? parsed.captureStartedAt
        : null
    const browseStartedAt =
      typeof parsed.browseStartedAt === "number" ? parsed.browseStartedAt : null

    if (
      !parsed ||
      (captureStartedAt === null && browseStartedAt === null)
    ) {
      return null
    }

    if (
      captureStartedAt !== null &&
      stamp - captureStartedAt > MAX_CAPTURE_MS
    ) {
      return null
    }

    if (
      captureStartedAt === null &&
      browseStartedAt !== null &&
      stamp - browseStartedAt > BROWSE_MAX_MS
    ) {
      return null
    }

    return {
      captureStartedAt,
      lastTouchAt: Math.min(
        numberOr(parsed.lastTouchAt, stamp),
        stamp
      ),
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
      searchActive: false,
      startReason:
        parsed.startReason === "item" || parsed.startReason === "comanda"
          ? parsed.startReason
          : null,
      browseStartedAt,
      lastBrowseAt:
        typeof parsed.lastBrowseAt === "number"
          ? Math.min(parsed.lastBrowseAt, stamp)
          : null,
      browseActiveMs: numberOr(parsed.browseActiveMs, 0),
      itemOpenedAt:
        typeof parsed.itemOpenedAt === "number" ? parsed.itemOpenedAt : null,
      browseMs:
        typeof parsed.browseMs === "number" ? parsed.browseMs : null,
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

function ensureState(): CaptureState {
  ensureLoaded()

  if (!state) {
    state = freshState()
    persist()
  }

  return state
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

function touch(): CaptureState {
  const current = ensureState()
  const stamp = now()
  const gap = stamp - current.lastTouchAt

  if (gap > 0) current.activeMs += Math.min(gap, IDLE_CAP_MS)

  current.lastTouchAt = stamp
  current.interactions += 1
  persist()

  return current
}

/** Extiende el tiempo activo sin contar una interacción nueva. */
function bump(): void {
  const current = ensureState()
  const stamp = now()
  const gap = stamp - current.lastTouchAt

  if (gap > 0) current.activeMs += Math.min(gap, IDLE_CAP_MS)

  current.lastTouchAt = stamp
  persist()
}

/** Actualiza la ventana candidata de navegación (sin iniciar la captura). */
function noteBrowsing(): void {
  const current = ensureState()

  if (current.captureStartedAt !== null) return

  const stamp = now()
  const last = current.lastBrowseAt

  if (
    current.browseStartedAt === null ||
    last === null ||
    stamp - last > BROWSE_MAX_MS
  ) {
    current.browseStartedAt = stamp
    current.browseActiveMs = 0
  } else {
    current.browseActiveMs = Math.min(
      BROWSE_MAX_MS,
      current.browseActiveMs + Math.min(stamp - last, IDLE_CAP_MS)
    )
  }

  current.lastBrowseAt = stamp
  persist()
}

/** Primera tecla de una búsqueda: cuenta una búsqueda por sesión. */
export function noteSearch(query: string): void {
  const current = ensureState()

  if (!current.searchActive && query.trim()) {
    current.searches += 1
    current.searchActive = true
    noteBrowsing()
    return
  }

  if (current.captureStartedAt === null) noteBrowsing()
  else bump()
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

  const current = ensureState()
  current.emptySearches += 1

  if (current.captureStartedAt === null) noteBrowsing()
  else touch()

  trackEvent({
    name: "pos.search_no_results",
    subjectName: clean.slice(0, 120),
    metadata: { length: clean.length },
  })
}

/** Cambio de menú, categoría o cualquier filtro del popover. */
export function noteFilter(): void {
  const current = ensureState()
  current.filters += 1

  if (current.captureStartedAt === null) noteBrowsing()
  else touch()
}

/**
 * Se abrió una card para configurar el artículo. No inicia la captura: el
 * tiempo del diálogo se suma a la ventana de navegación y solo se reporta si
 * luego se agrega el artículo.
 */
export function noteItemOpened(itemId: string): void {
  const current = ensureState()
  current.itemDialogs += 1
  current.itemOpenedAt = now()

  if (current.captureStartedAt === null) noteBrowsing()
  else bump()

  trackEvent({
    name: "pos.item_opened",
    itemId,
  })
}

/** Validación fallida dentro del diálogo (opción obligatoria, sin cantidad…). */
export function noteValidationError(reason: string, group?: string): void {
  const current = ensureState()
  current.validationErrors += 1

  if (current.captureStartedAt === null) noteBrowsing()
  else touch()

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
  const current = ensureState()

  if (current.captureStartedAt === null) noteBrowsing()
  else touch()

  trackEvent({
    name: "pos.item_dialog_cancelled",
    itemId,
    metadata: durationMs === null ? undefined : { durationMs },
  })
}

function commitCapture(reason: CaptureStartReason): boolean {
  const current = ensureState()

  if (current.captureStartedAt !== null) {
    touch()
    return false
  }

  const stamp = now()
  const lastBrowse = current.lastBrowseAt
  const continuousBrowse =
    lastBrowse !== null && stamp - lastBrowse <= IDLE_CAP_MS
  let browse: number | null = null

  if (
    reason === "item" &&
    current.itemOpenedAt !== null &&
    stamp - current.itemOpenedAt <= PRODUCT_WINDOW_MS
  ) {
    // Incluye el tiempo dentro del diálogo del platillo, que no genera
    // interacciones propias.
    browse =
      current.browseActiveMs + Math.max(0, stamp - current.itemOpenedAt)
  } else if (continuousBrowse) {
    browse =
      current.browseActiveMs +
      Math.max(0, stamp - (lastBrowse ?? stamp))
  }

  current.captureStartedAt = stamp
  current.startReason = reason
  current.lastTouchAt = stamp
  current.activeMs = 0
  current.browseMs =
    browse === null ? null : Math.min(BROWSE_MAX_MS, browse)
  current.browseStartedAt = null
  current.lastBrowseAt = null
  current.browseActiveMs = 0
  current.itemOpenedAt = null

  touch()

  return true
}

/**
 * Interacción explícita con la comanda: canal, mesa, comensales, alta/baja de
 * cliente, selección de cliente o rango de edad.
 */
export function noteComandaInteraction(): void {
  commitCapture("comanda")
}

/**
 * Actividad de texto en la comanda (nombre del cliente). Inicia la captura en
 * la primera tecla, pero no cuenta cada letra como interacción.
 */
export function noteComandaActivity(): void {
  const current = ensureState()

  if (current.captureStartedAt === null) commitCapture("comanda")
  else bump()
}

/** Actualiza el estado de la comanda (artículos, líneas y clientes). */
export function noteCart(items: number, lines: number, guests: number): void {
  const current = ensureState()

  const started =
    items > 0 && current.captureStartedAt === null
      ? commitCapture("item")
      : false

  const next = ensureState()

  if (next.captureStartedAt === null) return

  if (items > 0 && next.firstItemAt === null) next.firstItemAt = now()

  next.items = Math.max(0, items)
  next.lines = Math.max(0, lines)
  next.guests = Math.max(0, guests)

  if (!started) touch()
  else persist()
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

  if (!state) {
    clear()
    return
  }

  const current = state
  const captureStartedAt = current.captureStartedAt

  if (captureStartedAt === null) {
    clear()
    return
  }

  const stamp = now()
  const wallMs = Math.max(0, stamp - captureStartedAt)
  const gap = stamp - current.lastTouchAt
  const activeMs = Math.max(
    0,
    Math.min(
      current.activeMs + Math.max(0, Math.min(gap, IDLE_CAP_MS)),
      wallMs
    )
  )
  const idleMs = Math.max(0, wallMs - activeMs)
  const firstItemAt = current.firstItemAt
  const setupMs =
    firstItemAt === null
      ? null
      : Math.max(0, firstItemAt - captureStartedAt)
  const assemblyMs =
    firstItemAt === null ? null : Math.max(0, stamp - firstItemAt)
  const browseMs = current.browseMs
  const totalMs = browseMs === null ? null : browseMs + wallMs
  const finalOutcome = wallMs > MAX_CAPTURE_MS ? "stale" : outcome

  trackEvent({
    name: "pos.order_capture_finished",
    orderId: extras.orderId ?? undefined,
    quantity: extras.items,
    amount: extras.amount,
    metadata: {
      outcome: finalOutcome,
      startReason: current.startReason,
      wallMs,
      activeMs,
      idleMs,
      browseMs,
      setupMs,
      assemblyMs,
      totalMs,
      interactions: current.interactions,
      items: extras.items,
      lines: extras.lines,
      guests: extras.guests,
      searches: current.searches,
      emptySearches: current.emptySearches,
      filters: current.filters,
      itemDialogs: current.itemDialogs,
      validationErrors: current.validationErrors,
      offline: Boolean(extras.offline),
      channel: extras.channel ?? null,
    },
  })

  clear()
}
