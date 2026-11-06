"use client"

import * as React from "react"
import {
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  InfinityIcon,
  NotebookTextIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  formatMenuTimeRange,
  isMenuAvailableNow,
  isMenuScheduled,
  MENU_DAY_LABELS,
  MENU_WEEK_DAYS,
  menuIsWithinDates,
  menuMatchesDay,
  menuStatusKind,
  type Menu,
} from "@/lib/menus"
import { cn } from "@/lib/utils"

export function MenuScheduleBoard({
  menus,
  now,
  canManage,
  onEdit,
}: {
  menus: Menu[]
  now: Date | null
  canManage: boolean
  onEdit: (menu: Menu) => void
}) {
  const [weekOffset, setWeekOffset] = React.useState(0)
  const weekStart = now ? startOfWeek(addDays(startOfDay(now), weekOffset * 7)) : null

  const scheduled = menus.filter(isMenuScheduled)
  const always = menus.filter((menu) => !isMenuScheduled(menu))
  const visible = weekStart
    ? scheduled.filter((menu) => menuIsWithinWeek(menu, weekStart))
    : scheduled

  const availableNow = menus.filter(
    (menu) =>
      menu.isActive &&
      (now ? isMenuAvailableNow(menu, now) : menu.isAvailableNow)
  ).length

  const weekLabel = weekStart
    ? `${formatShortDate(weekStart)} – ${formatShortDate(addDays(weekStart, 6))}`
    : "Semana actual"

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <CalendarDaysIcon className="size-4" />
            Programación semanal
          </h3>
          <p className="text-sm text-muted-foreground">
            {weekLabel} · {availableNow} menú
            {availableNow === 1 ? "" : "s"} disponible
            {availableNow === 1 ? "" : "s"} ahora.
          </p>
        </div>

        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setWeekOffset(0)}
            disabled={weekOffset === 0}
          >
            Hoy
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Semana anterior"
            onClick={() => setWeekOffset((current) => current - 1)}
          >
            <ChevronLeftIcon />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Semana siguiente"
            onClick={() => setWeekOffset((current) => current + 1)}
          >
            <ChevronRightIcon />
          </Button>
        </div>
      </div>

      {always.length > 0 ? (
        <Card size="sm">
          <CardContent className="flex flex-wrap items-center gap-2 py-1">
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <InfinityIcon className="size-3.5" />
              Siempre disponibles
            </span>
            <div className="flex flex-wrap gap-1.5">
              {always.map((menu) => (
                <button
                  key={menu.id}
                  type="button"
                  title={menu.description ?? menu.name}
                  onClick={() => canManage && onEdit(menu)}
                  className={cn(
                    "rounded-md border bg-card px-2 py-1 text-left text-xs transition-colors",
                    canManage && "hover:bg-muted/60",
                    !menu.isActive && "opacity-55"
                  )}
                >
                  <span className="block max-w-44 truncate font-medium">
                    {menu.name}
                  </span>
                  <span className="block text-[11px] text-muted-foreground">
                    Todo el día
                  </span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {menus.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
            <NotebookTextIcon className="size-8" />
            <p className="font-medium text-foreground">
              Todavía no hay menús para programar
            </p>
            <p className="text-sm">
              Crea un menú y asígnale días u horas para verlo en esta
              programación.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto pb-1">
          <div className="grid min-w-[64rem] grid-cols-7 gap-2">
            {MENU_WEEK_DAYS.map((day, index) => {
              const date = weekStart ? addDays(weekStart, index) : null
              const isToday = Boolean(now && now.getDay() === day)
              const dayMenus = visible
                .filter(
                  (menu) =>
                    menuMatchesDay(menu, day) &&
                    (!date || menuIsWithinDates(menu, date))
                )
                .sort((left, right) =>
                  (left.startTime ?? "00:00").localeCompare(
                    right.startTime ?? "00:00"
                  ) || left.name.localeCompare(right.name, "es")
                )

              return (
                <div
                  key={day}
                  className={cn(
                    "flex min-h-44 flex-col gap-2 rounded-lg border bg-muted/15 p-2",
                    isToday && "border-chart-4/60 bg-chart-4/5"
                  )}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-medium">
                      {MENU_DAY_LABELS[day]}
                    </span>
                    {isToday ? (
                      <Badge variant="outline" className="px-1.5">
                        Hoy
                      </Badge>
                    ) : (
                      <span className="text-[11px] text-muted-foreground tabular-nums">
                        {date ? formatShortDate(date) : ""}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col gap-1.5">
                    {dayMenus.length === 0 ? (
                      <span className="rounded-md border border-dashed px-2 py-4 text-center text-[11px] text-muted-foreground">
                        Sin menús
                      </span>
                    ) : (
                      dayMenus.map((menu) => (
                        <ScheduleChip
                          key={menu.id}
                          menu={menu}
                          now={now}
                          isToday={isToday}
                          canManage={canManage}
                          onEdit={onEdit}
                        />
                      ))
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {scheduled.length > 0 && visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Ningún menú programado está vigente en esta semana.
        </p>
      ) : null}
    </div>
  )
}

function ScheduleChip({
  menu,
  now,
  isToday,
  canManage,
  onEdit,
}: {
  menu: Menu
  now: Date | null
  isToday: boolean
  canManage: boolean
  onEdit: (menu: Menu) => void
}) {
  const kind = menuStatusKind(menu, now)
  const available = kind === "available" || kind === "always"

  return (
    <button
      type="button"
      title={menu.description ?? menu.name}
      onClick={() => canManage && onEdit(menu)}
      className={cn(
        "rounded-md border bg-card px-2 py-1.5 text-left transition-colors",
        canManage && "hover:bg-muted/60",
        !menu.isActive && "opacity-55",
        available && isToday && "border-chart-4/60 bg-chart-4/10",
        kind === "outside" && "bg-background"
      )}
    >
      <span className="block truncate text-xs font-medium">{menu.name}</span>
      <span className="mt-0.5 flex items-center justify-between gap-1 text-[11px] text-muted-foreground tabular-nums">
        <span>{formatMenuTimeRange(menu)}</span>
        {menu.startTime && menu.endTime && menu.endTime < menu.startTime ? (
          <span title="Cruza la medianoche">+1</span>
        ) : null}
      </span>
    </button>
  )
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

/** Lunes como inicio de semana. */
function startOfWeek(date: Date): Date {
  const next = startOfDay(date)
  const offset = (next.getDay() + 6) % 7
  next.setDate(next.getDate() - offset)
  return next
}

function formatShortDate(date: Date): string {
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
  }).format(date)
}

function menuIsWithinWeek(menu: Menu, weekStart: Date): boolean {
  const weekEnd = addDays(weekStart, 7)

  if (menu.startsAt && new Date(menu.startsAt) >= weekEnd) return false
  if (menu.endsAt && new Date(menu.endsAt) < weekStart) return false

  return true
}
