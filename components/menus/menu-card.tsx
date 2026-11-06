"use client"

import {
  CalendarClockIcon,
  PencilIcon,
  UtensilsCrossedIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  formatMenuAvailabilityHint,
  formatMenuSchedule,
  formatMenuTimeRange,
  menuStatusKind,
  type Menu,
} from "@/lib/menus"
import { cn } from "@/lib/utils"

import { MenuActionsMenu, type MenuRowActions } from "./menus-columns"
import { MenuCover, MenuStatusBadge } from "./menu-visuals"

export function MenuCard({
  menu,
  imageById,
  actions,
  now,
}: {
  menu: Menu
  imageById: Map<string, string | null>
  actions: MenuRowActions
  now: Date | null
}) {
  const kind = menuStatusKind(menu, now)
  const combos = menu.items.filter((entry) => entry.item.isCombo).length
  const visibleItems = menu.items.slice(0, 3)
  const hiddenItems = Math.max(0, menu.items.length - visibleItems.length)

  return (
    <Card size="sm" className="gap-0 overflow-hidden p-0 py-0">
      <div className="relative aspect-[4/3] w-full">
        <MenuCover
          menu={menu}
          imageById={imageById}
          className="absolute inset-0"
        />
        <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/70 via-black/15 to-black/10" />

        <div className="relative flex size-full flex-col p-2.5 text-white">
          <div className="flex items-start justify-between gap-2">
            <MenuStatusBadge
              kind={kind}
              className="border-white/25 bg-black/40 text-white shadow-sm backdrop-blur-sm"
            />
            <MenuActionsMenu
              menu={menu}
              actions={actions}
              triggerSize="icon-sm"
              triggerClassName="text-white/90 hover:bg-white/15 hover:text-white aria-expanded:bg-white/15 [&_svg]:drop-shadow-[0_1px_2px_rgb(0_0_0/0.85)]"
            />
          </div>

          <div className="mt-auto flex min-w-0 flex-col gap-1">
            <p
              className="line-clamp-2 text-pretty text-base leading-snug font-semibold drop-shadow-sm"
              title={menu.name}
            >
              {menu.name}
            </p>
            <p className="truncate text-xs text-white/80">
              {formatMenuTimeRange(menu)}
            </p>
          </div>
        </div>
      </div>

      <CardContent className="flex flex-1 flex-col gap-2.5 p-3">
        <p className="line-clamp-2 min-h-8 text-xs text-muted-foreground">
          {menu.description ?? "Sin descripción"}
        </p>

        <p className="flex items-start gap-1.5 text-xs">
          <CalendarClockIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
          <span className="line-clamp-2">{formatMenuSchedule(menu)}</span>
        </p>

        <div className="flex flex-wrap gap-1">
          {visibleItems.map((row) => (
            <span
              key={row.id}
              className="max-w-full truncate rounded-md bg-muted px-1.5 py-0.5 text-xs"
              title={row.item.name}
            >
              {row.item.name}
            </span>
          ))}
          {hiddenItems > 0 ? (
            <span className="px-1 py-0.5 text-xs text-muted-foreground tabular-nums">
              +{hiddenItems}
            </span>
          ) : null}
        </div>

        <div className="mt-auto flex items-center justify-between gap-2 border-t pt-2.5">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <UtensilsCrossedIcon className="size-3.5 shrink-0" />
              {menu.items.length} artículo
              {menu.items.length === 1 ? "" : "s"}
              {menu.groups.length > 0
                ? ` · ${menu.groups.length} grupo${menu.groups.length === 1 ? "" : "s"}`
                : ""}
              {combos > 0 ? ` · ${combos} combo${combos === 1 ? "" : "s"}` : ""}
            </span>
            <span
              className={cn(
                "truncate text-xs",
                kind === "available" || kind === "always"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-muted-foreground"
              )}
            >
              {formatMenuAvailabilityHint(menu, now)}
            </span>
          </div>

          {actions.canManage ? (
            <Button
              size="sm"
              variant="outline"
              className="shrink-0"
              onClick={() => actions.onEdit(menu)}
            >
              <PencilIcon className="size-4" />
              Editar
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

export function MenuCards({
  menus,
  imageById,
  actions,
  now,
}: {
  menus: Menu[]
  imageById: Map<string, string | null>
  actions: MenuRowActions
  now: Date | null
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(var(--np-card-columns,3),minmax(0,1fr))]">
      {menus.map((menu) => (
        <MenuCard
          key={menu.id}
          menu={menu}
          imageById={imageById}
          actions={actions}
          now={now}
        />
      ))}
    </div>
  )
}
