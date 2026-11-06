export interface MenuItemEntry {
  id: string
  itemId: string
  sortOrder: number
  /** Sección del menú; `null` = «Sin grupo». */
  group: string | null
  item: {
    id: string
    name: string
    price: string
    isActive: boolean
    isCombo: boolean
    category: { id: string; name: string } | null
  }
}

/** Menú = colección curada de artículos; no es un producto vendible. */
export interface Menu {
  id: string
  name: string
  description: string | null
  isActive: boolean
  sortOrder: number
  daysOfWeek: number[]
  startTime: string | null
  endTime: string | null
  startsAt: string | null
  endsAt: string | null
  /** Calculado por la API con la hora del servidor. */
  isAvailableNow: boolean
  /** Secciones del menú, en el orden en que se muestran. */
  groups: string[]
  items: MenuItemEntry[]
}

export const MENU_DAY_LABELS = [
  "Dom",
  "Lun",
  "Mar",
  "Mié",
  "Jue",
  "Vie",
  "Sáb",
]

/** Orden de lunes a domingo para el tablero semanal. */
export const MENU_WEEK_DAYS = [1, 2, 3, 4, 5, 6, 0] as const

export type MenuStatusKind =
  | "inactive"
  | "always"
  | "available"
  | "outside"

type MenuSchedule = {
  isActive: boolean
  isAvailableNow: boolean
  daysOfWeek: number[]
  startTime: string | null
  endTime: string | null
  startsAt: string | null
  endsAt: string | null
}

/** Un menú sin días, horas ni fechas está disponible siempre que esté activo. */
export function isMenuScheduled(
  menu: Pick<
    MenuSchedule,
    "daysOfWeek" | "startTime" | "endTime" | "startsAt" | "endsAt"
  >
): boolean {
  return (
    menu.daysOfWeek.length > 0 ||
    Boolean(menu.startTime) ||
    Boolean(menu.endTime) ||
    Boolean(menu.startsAt) ||
    Boolean(menu.endsAt)
  )
}

/** Estado visual del menú, recalculable en cliente cuando cambia la hora. */
export function menuStatusKind(
  menu: MenuSchedule,
  now: Date | null = null
): MenuStatusKind {
  if (!menu.isActive) return "inactive"
  if (!isMenuScheduled(menu)) return "always"

  const available = now ? isMenuAvailableNow(menu, now) : menu.isAvailableNow

  return available ? "available" : "outside"
}

export function menuStatusLabel(kind: MenuStatusKind): string {
  switch (kind) {
    case "inactive":
      return "Inactivo"
    case "always":
      return "Siempre disponible"
    case "available":
      return "En horario"
    default:
      return "Fuera de horario"
  }
}

/** Etiqueta corta para el pie de la tarjeta. */
export function formatMenuAvailabilityHint(
  menu: MenuSchedule,
  now: Date | null
): string {
  if (!menu.isActive) return "Inactivo"
  if (!isMenuScheduled(menu)) return "Siempre disponible"

  if (!now) {
    return menu.isAvailableNow ? "Disponible ahora" : "Fuera de horario"
  }

  if (isMenuAvailableNow(menu, now)) {
    return menu.endTime ? `Cierra a las ${menu.endTime}` : "Disponible ahora"
  }

  const next = nextOpening(menu, now)
  if (!next) return "Fuera de vigencia"

  const suffix = menu.startTime ? ` a las ${menu.startTime}` : ""
  const diff = (next.getDay() - now.getDay() + 7) % 7

  if (diff === 0) return `Abre hoy${suffix}`
  if (diff === 1) return `Abre mañana${suffix}`

  return `Abre el ${MENU_DAY_LABELS[next.getDay()]}${suffix}`
}

/** Siguiente apertura del menú (o `null` si sus fechas ya no aplican). */
function nextOpening(menu: MenuSchedule, now: Date): Date | null {
  const today = startOfDay(now)

  for (let offset = 0; offset <= 7; offset += 1) {
    const day = addDays(today, offset)
    const dayEnd = addDays(day, 1)

    if (
      menu.daysOfWeek.length > 0 &&
      !menu.daysOfWeek.includes(day.getDay())
    ) {
      continue
    }

    if (menu.startsAt && new Date(menu.startsAt) >= dayEnd) continue
    if (menu.endsAt && new Date(menu.endsAt) < day) continue

    const startsAt = menu.startsAt ? new Date(menu.startsAt) : null
    const windowStart = menu.startTime
      ? new Date(
          day.getFullYear(),
          day.getMonth(),
          day.getDate(),
          Number(menu.startTime.slice(0, 2)),
          Number(menu.startTime.slice(3, 5))
        )
      : day
    const candidate =
      startsAt && startsAt > windowStart ? startsAt : windowStart

    if (candidate > now) return candidate
  }

  return null
}

function startOfDay(date: Date): Date {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

/** Rango horario legible; sin horas se considera todo el día. */
export function formatMenuTimeRange(
  menu: Pick<MenuSchedule, "startTime" | "endTime">
): string {
  return menu.startTime && menu.endTime
    ? `${menu.startTime}–${menu.endTime}`
    : "Todo el día"
}

/** Un menú aplica a un día si no restringe días o si incluye ese día. */
export function menuMatchesDay(
  menu: Pick<MenuSchedule, "daysOfWeek">,
  day: number
): boolean {
  return menu.daysOfWeek.length === 0 || menu.daysOfWeek.includes(day)
}

/** Comprueba si el menú está vigente en la fecha indicada (solo fechas). */
export function menuIsWithinDates(
  menu: Pick<MenuSchedule, "startsAt" | "endsAt">,
  date: Date
): boolean {
  const dayStart = startOfDay(date)
  const dayEnd = addDays(dayStart, 1)

  if (menu.startsAt && new Date(menu.startsAt) >= dayEnd) return false
  if (menu.endsAt && new Date(menu.endsAt) < dayStart) return false

  return true
}

export function formatMenuDayCount(menu: Pick<MenuSchedule, "daysOfWeek">) {
  if (menu.daysOfWeek.length === 0 || menu.daysOfWeek.length === 7) {
    return "Todos los días"
  }

  const days = [...menu.daysOfWeek].sort((left, right) => left - right)
  return days.map((day) => MENU_DAY_LABELS[day]).join(", ")
}

/** "Siempre disponible", "Lun–Vie · 18:00–23:00", etc. */
export function formatMenuSchedule(menu: {
  daysOfWeek: number[]
  startTime: string | null
  endTime: string | null
  startsAt: string | null
  endsAt: string | null
}): string {
  const parts: string[] = []

  if (menu.daysOfWeek.length === 0 || menu.daysOfWeek.length === 7) {
    parts.push("Todos los días")
  } else {
    const days = [...menu.daysOfWeek].sort((left, right) => left - right)
    const isWorkweek =
      days.length === 5 && days.every((day, index) => day === index + 1)

    parts.push(
      isWorkweek
        ? "Lun–Vie"
        : days.map((day) => MENU_DAY_LABELS[day]).join(", ")
    )
  }

  if (menu.startTime && menu.endTime) {
    parts.push(`${menu.startTime}–${menu.endTime}`)
  }

  if (menu.startsAt || menu.endsAt) {
    const formatter = new Intl.DateTimeFormat("es-MX", {
      day: "numeric",
      month: "short",
    })
    const from = menu.startsAt
      ? formatter.format(new Date(menu.startsAt))
      : "inicio"
    const to = menu.endsAt ? formatter.format(new Date(menu.endsAt)) : "sin fin"
    parts.push(`Del ${from} al ${to}`)
  }

  return parts.join(" · ")
}

/** Misma regla que la API, para previsualizar sin esperar al servidor. */
export function isMenuAvailableNow(
  menu: {
    isActive: boolean
    daysOfWeek: number[]
    startTime: string | null
    endTime: string | null
    startsAt: string | null
    endsAt: string | null
  },
  now: Date = new Date()
): boolean {
  if (!menu.isActive) return false

  if (menu.startsAt && now < new Date(menu.startsAt)) return false
  if (menu.endsAt && now > new Date(menu.endsAt)) return false

  if (
    menu.daysOfWeek.length > 0 &&
    !menu.daysOfWeek.includes(now.getDay())
  ) {
    return false
  }

  if (menu.startTime && menu.endTime) {
    const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(
      now.getMinutes()
    ).padStart(2, "0")}`
    const inWindow =
      menu.startTime <= menu.endTime
        ? hhmm >= menu.startTime && hhmm <= menu.endTime
        : hhmm >= menu.startTime || hhmm <= menu.endTime

    if (!inWindow) return false
  }

  return true
}
