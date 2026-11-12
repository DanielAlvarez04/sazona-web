"use client"

import {
  CalendarClockIcon,
  GroupIcon,
  LayersIcon,
  PencilIcon,
  SoupIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  formatMenuSchedule,
  formatMenuTimeRange,
  menuStatusKind,
  type Menu,
} from "@/lib/menus"

import { MenuActionsMenu, type MenuRowActions } from "./menus-columns"
import { MenuCover, MenuStatusBadge, type MenuImageMap } from "./menu-visuals"

export function MenuCard({
  menu,
  imageById,
  actions,
  now,
}: {
  menu: Menu
  imageById: MenuImageMap
  actions: MenuRowActions
  now: Date | null
}) {
  const kind = menuStatusKind(menu, now)
  const combos = menu.items.filter((entry) => entry.item.isCombo).length
  const articles = menu.items.length - combos

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
            <MenuStatusBadge kind={kind} className="shadow-sm" />
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

        <div className="mt-auto flex flex-wrap items-center gap-1">
          {menu.isGlobal ? (
            <Badge
              variant="outline"
              className="h-5 border-primary/90 bg-primary/5 px-2 py-0.5 text-primary/90 dark:border-chart-1/90 dark:bg-primary/10 dark:text-chart-1"
            >
              Todos los artículos y combos
            </Badge>
          ) : (
            <>
              {combos > 0 ? (
                <Badge
                  variant="outline"
                  className="border-sky-700 bg-sky-500/10 text-sky-700 dark:border-sky-400 dark:bg-sky-400/10 dark:text-sky-400"
                  title={`${combos} ${combos === 1 ? "combo" : "combos"}`}
                  aria-label={`${combos} ${combos === 1 ? "combo" : "combos"}`}
                >
                  <GroupIcon data-icon="inline-start" />
                  {combos}
                </Badge>
              ) : null}

              {articles > 0 ? (
                <Badge
                  variant="outline"
                  className="h-5 border-primary/90 bg-primary/5 px-2 py-0.5 text-primary/90 dark:border-chart-1/90 dark:bg-primary/10 dark:text-chart-1"
                  title={`${articles} ${articles === 1 ? "artículo" : "artículos"}`}
                  aria-label={`${articles} ${articles === 1 ? "artículo" : "artículos"}`}
                >
                  <SoupIcon data-icon="inline-start" />
                  {articles}
                </Badge>
              ) : null}

              {menu.groups.length > 0 ? (
                <Badge
                  variant="outline"
                  className="border-fuchsia-700 bg-fuchsia-500/10 text-fuchsia-700 dark:border-fuchsia-400 dark:bg-fuchsia-400/10 dark:text-fuchsia-400"
                  title={`${menu.groups.length} ${menu.groups.length === 1 ? "grupo" : "grupos"}`}
                  aria-label={`${menu.groups.length} ${menu.groups.length === 1 ? "grupo" : "grupos"}`}
                >
                  <LayersIcon data-icon="inline-start" />
                  {menu.groups.length}
                </Badge>
              ) : null}
            </>
          )}
        </div>
      </CardContent>

      <div
        role="group"
        aria-label={`Acciones de ${menu.name}`}
        className="flex min-h-11 items-center justify-end gap-1 border-t bg-muted px-2 py-2"
      >
        {actions.canManage ? (
          <Button
            size="sm"
            className="w-max shadow-sm"
            onClick={() => actions.onEdit(menu)}
          >
            <PencilIcon className="size-4" />
            Editar
          </Button>
        ) : null}
      </div>
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
  imageById: MenuImageMap
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
