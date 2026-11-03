export interface MenuItemEntry {
  id: string
  itemId: string
  sortOrder: number
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
