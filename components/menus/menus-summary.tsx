"use client"

import {
  ClockIcon,
  NotebookTextIcon,
  SoupIcon,
  UnlinkIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { ArticleListItem } from "@/lib/catalog"
import {
  isMenuAvailableNow,
  isMenuScheduled,
  type Menu,
} from "@/lib/menus"

export function MenusSummary({
  menus,
  items,
  now,
  onOpenUnassigned,
}: {
  menus: Menu[]
  items: ArticleListItem[]
  now: Date | null
  onOpenUnassigned: () => void
}) {
  const active = menus.filter((menu) => menu.isActive)
  const inactive = menus.length - active.length
  const unscheduled = active.filter((menu) => !isMenuScheduled(menu)).length
  const availableNow = active.filter((menu) =>
    now ? isMenuAvailableNow(menu, now) : menu.isAvailableNow
  )

  const assignedIds = new Set(
    active.flatMap((menu) => menu.items.map((entry) => entry.itemId))
  )
  const sellable = items.filter((item) => item.isActive && !item.isArchived)
  const assigned = sellable.filter((item) => assignedIds.has(item.id))
  const unassigned = sellable.filter((item) => !assignedIds.has(item.id))
  const coverage =
    sellable.length > 0 ? (assigned.length / sellable.length) * 100 : 0

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Card size="sm">
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center gap-1.5">
            <NotebookTextIcon className="size-4" />
            Menús
          </CardDescription>
          <CardTitle className="text-2xl tabular-nums">
            {active.length} activo{active.length === 1 ? "" : "s"}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-row flex-wrap gap-1.5">
          <Badge variant="secondary">{menus.length} en total</Badge>
          <Badge variant="outline">
            {inactive} inactivo{inactive === 1 ? "" : "s"}
          </Badge>
          <Badge variant="outline">
            {unscheduled} sin programar
          </Badge>
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center gap-1.5">
            <ClockIcon className="size-4" />
            En horario ahora
          </CardDescription>
          <CardTitle className="text-2xl tabular-nums">
            {availableNow.length}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 text-xs">
          {availableNow.length === 0 ? (
            <span className="text-muted-foreground">
              Ninguno disponible en este momento.
            </span>
          ) : (
            <>
              {availableNow.slice(0, 2).map((menu) => (
                <span key={menu.id} className="truncate">
                  {menu.name}
                </span>
              ))}
              {availableNow.length > 2 ? (
                <span className="text-muted-foreground">
                  +{availableNow.length - 2} más
                </span>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center gap-1.5">
            <SoupIcon className="size-4" />
            Artículos asignados
          </CardDescription>
          <CardTitle className="text-2xl tabular-nums">
            {assigned.length}
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              de {sellable.length} vendibles
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1.5">
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-chart-4 transition-[width]"
              style={{ width: `${Math.min(100, Math.max(0, coverage))}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground tabular-nums">
            {Math.round(coverage)} % de cobertura
          </span>
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center gap-1.5">
            <UnlinkIcon className="size-4" />
            Sin menú
          </CardDescription>
          <CardTitle className="text-2xl tabular-nums">
            {unassigned.length}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 text-xs">
          {unassigned.length === 0 ? (
            <span className="text-muted-foreground">
              Todos los artículos están en algún menú activo.
            </span>
          ) : (
            <>
              {unassigned.slice(0, 3).map((item) => (
                <span key={item.id} className="truncate">
                  {item.name}
                </span>
              ))}
              {unassigned.length > 3 ? (
                <span className="text-muted-foreground">
                  +{unassigned.length - 3} más
                </span>
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-1 w-max"
                onClick={onOpenUnassigned}
              >
                Revisar
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
