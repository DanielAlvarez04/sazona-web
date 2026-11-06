"use client"

import type { ComponentProps } from "react"
import { createColumnHelper } from "@tanstack/react-table"
import {
  CalendarClockIcon,
  ChevronDownIcon,
  ChevronsUpDownIcon,
  ChevronUpIcon,
  CopyIcon,
  EllipsisVerticalIcon,
  PencilIcon,
  PowerIcon,
  Trash2Icon,
  UtensilsCrossedIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { DataTableFeatures } from "@/components/data-table/data-table-features"
import {
  formatMenuSchedule,
  formatMenuTimeRange,
  menuStatusKind,
  menuStatusLabel,
  type Menu,
  type MenuStatusKind,
} from "@/lib/menus"
import { cn } from "@/lib/utils"

import { MenuThumbnail } from "./menu-visuals"

const columnHelper = createColumnHelper<DataTableFeatures, Menu>()

interface SortableColumn {
  getCanSort: () => boolean
  getIsSorted: () => false | "asc" | "desc"
  getToggleSortingHandler: () => ((event: unknown) => void) | undefined
}

function MenuColumnHeader({
  title,
  column,
}: {
  title: string
  column: SortableColumn
}) {
  if (!column.getCanSort()) {
    return <span className="font-medium">{title}</span>
  }

  const sorted = column.getIsSorted()

  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-2 h-8 data-[sorted=true]:bg-accent"
      data-sorted={sorted !== false}
      onClick={column.getToggleSortingHandler()}
    >
      {title}
      {sorted === "asc" ? (
        <ChevronUpIcon data-icon="inline-end" />
      ) : sorted === "desc" ? (
        <ChevronDownIcon data-icon="inline-end" />
      ) : (
        <ChevronsUpDownIcon
          data-icon="inline-end"
          className="text-muted-foreground"
        />
      )}
    </Button>
  )
}

export interface MenuRowActions {
  onEdit: (menu: Menu) => void
  onDuplicate: (menu: Menu) => void
  onActivate: (menu: Menu) => void
  onDeactivate: (menu: Menu) => void
  onDelete: (menu: Menu) => void
  canManage: boolean
  isPending: (menu: Menu) => boolean
}

export function MenuActionsMenu({
  menu,
  actions,
  triggerSize = "icon-xs",
  triggerClassName,
}: {
  menu: Menu
  actions: MenuRowActions
  triggerSize?: ComponentProps<typeof Button>["size"]
  triggerClassName?: string
}) {
  if (!actions.canManage) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size={triggerSize}
            className={cn(
              "text-muted-foreground aria-expanded:bg-muted",
              triggerClassName
            )}
            disabled={actions.isPending(menu)}
            aria-label={`Acciones de ${menu.name}`}
          />
        }
      >
        <EllipsisVerticalIcon />
        <span className="sr-only">Acciones</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Acciones</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => actions.onEdit(menu)}>
            <PencilIcon />
            Editar
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => actions.onDuplicate(menu)}>
            <CopyIcon />
            Duplicar
          </DropdownMenuItem>
          {menu.isActive ? (
            <DropdownMenuItem
              className="text-amber-600 focus:bg-amber-500/10 focus:text-amber-600 dark:text-amber-400 dark:focus:text-amber-400"
              onClick={() => actions.onDeactivate(menu)}
            >
              <PowerIcon />
              Desactivar
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              className="text-emerald-600 focus:bg-emerald-500/10 focus:text-emerald-600 dark:text-emerald-400 dark:focus:text-emerald-400"
              onClick={() => actions.onActivate(menu)}
            >
              <PowerIcon />
              Activar
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            variant="destructive"
            onClick={() => actions.onDelete(menu)}
          >
            <Trash2Icon />
            Eliminar
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function statusVariant(kind: MenuStatusKind) {
  if (kind === "inactive") return "secondary" as const
  if (kind === "outside") return "outline" as const
  return "success" as const
}

export function createMenuColumns(
  actions: MenuRowActions,
  imageById: Map<string, string | null>
) {
  return columnHelper.columns([
    columnHelper.accessor("name", {
      id: "name",
      header: ({ column }) => (
        <MenuColumnHeader title="Menú" column={column} />
      ),
      cell: ({ row }) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <MenuThumbnail
            menu={row.original}
            imageById={imageById}
            className="size-9"
          />
          <div className="min-w-0">
            <p className="truncate font-medium">{row.original.name}</p>
            <p className="line-clamp-1 text-xs text-muted-foreground">
              {row.original.description ?? "Sin descripción"}
            </p>
          </div>
        </div>
      ),
      sortFn: (left, right) =>
        left.original.name.localeCompare(right.original.name, "es", {
          sensitivity: "base",
        }),
    }),

    columnHelper.accessor(
      (menu) => (!menu.isActive ? 0 : menu.isAvailableNow ? 2 : 1),
      {
        id: "status",
        header: ({ column }) => (
          <MenuColumnHeader title="Estado" column={column} />
        ),
        cell: ({ row }) => (
          <Badge variant={row.original.isActive ? "secondary" : "outline"}>
            {row.original.isActive ? "Activo" : "Inactivo"}
          </Badge>
        ),
      }
    ),

    columnHelper.accessor(
      (menu) => {
        const kind = menuStatusKind(menu)
        return kind === "available" || kind === "always"
          ? 1
          : kind === "outside"
            ? 0
            : -1
      },
      {
        id: "availability",
        header: ({ column }) => (
          <MenuColumnHeader title="Ahora" column={column} />
        ),
        cell: ({ row }) => {
          const kind = menuStatusKind(row.original)
          return (
            <Badge variant={statusVariant(kind)}>
              {menuStatusLabel(kind)}
            </Badge>
          )
        },
      }
    ),

    columnHelper.display({
      id: "schedule",
      header: () => <span className="font-medium">Horario</span>,
      cell: ({ row }) => (
        <div className="flex items-start gap-1.5 text-sm">
          <CalendarClockIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="truncate">{formatMenuSchedule(row.original)}</p>
            <p className="text-xs text-muted-foreground">
              {formatMenuTimeRange(row.original)}
            </p>
          </div>
        </div>
      ),
    }),

    columnHelper.accessor((menu) => menu.items.length, {
      id: "items",
      header: ({ column }) => (
        <MenuColumnHeader title="Artículos" column={column} />
      ),
      cell: ({ row }) => {
        const combos = row.original.items.filter(
          (entry) => entry.item.isCombo
        ).length

        return (
          <div className="flex items-center gap-1.5 text-sm tabular-nums">
            <UtensilsCrossedIcon className="size-3.5 text-muted-foreground" />
            <span>
              {row.original.items.length} artículo
              {row.original.items.length === 1 ? "" : "s"}
            </span>
            {row.original.groups.length > 0 ? (
              <Badge variant="outline" className="ml-1">
                {row.original.groups.length} grupo
                {row.original.groups.length === 1 ? "" : "s"}
              </Badge>
            ) : null}
            {combos > 0 ? (
              <Badge variant="outline" className="ml-1">
                {combos} combo{combos === 1 ? "" : "s"}
              </Badge>
            ) : null}
          </div>
        )
      },
    }),

    columnHelper.display({
      id: "actions",
      header: () => <span className="sr-only">Acciones</span>,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <MenuActionsMenu menu={row.original} actions={actions} />
        </div>
      ),
    }),
  ])
}
