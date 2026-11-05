"use client"

import { createColumnHelper, type SortFn } from "@tanstack/react-table"
import type { ComponentProps, ReactNode } from "react"
import {
  ChevronDownIcon,
  ChevronsUpDownIcon,
  ChevronUpIcon,
  EllipsisVerticalIcon,
  NotebookTextIcon,
  PencilIcon,
  PowerIcon,
  SoupIcon,
  TicketPercentIcon,
  Trash2Icon,
} from "lucide-react"

import { InfoHint } from "@/components/info-hint"
import { Badge, badgeVariants } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import {
  PROMOTION_TYPE_LABELS,
  formatMarginPercent,
  formatMoney,
  type ArticleListItem,
  type ComboPromotion,
  type Recipe,
} from "@/lib/catalog"
import { cn } from "cn"

import type { DataTableFeatures } from "@/components/data-table/data-table-features"
import { MenusCountBadge } from "./menus-count"
import { ComboComponentsPreview } from "./combo-components-preview"
import { comboCost, comboPricing } from "./combo-metrics"
import { costPercentClass, marginPercentClass } from "./metric-colors"

const columnHelper = createColumnHelper<DataTableFeatures, ArticleListItem>()

interface SortableColumn {
  getCanSort: () => boolean
  getIsSorted: () => false | "asc" | "desc"
  getToggleSortingHandler: () => ((event: unknown) => void) | undefined
}

function ComboColumnHeader({
  title,
  column,
  align = "left",
  hint,
  icon,
}: {
  title: string
  column: SortableColumn
  align?: "left" | "right"
  hint?: string
  /** Si se indica, sustituye al texto del encabezado por este icono. */
  icon?: ReactNode
}) {
  const wrapper = cn(
    "flex items-center gap-1",
    align === "right" ? "justify-end" : undefined
  )

  if (!column.getCanSort()) {
    return (
      <div className={wrapper}>
        {icon ? (
          <>
            {icon}
            <span className="sr-only">{title}</span>
          </>
        ) : (
          <span className="font-medium">{title}</span>
        )}
        {hint ? <InfoHint text={hint} /> : null}
      </div>
    )
  }

  const sorted = column.getIsSorted()

  return (
    <div className={wrapper}>
      <Button
        variant="ghost"
        size="sm"
        aria-label={icon ? title : undefined}
        className={`h-8 data-[sorted=true]:bg-accent ${align === "right" ? "ml-0" : "-ml-2"}`}
        data-sorted={sorted !== false}
        onClick={column.getToggleSortingHandler()}
      >
        {icon ?? title}
        {hint ? <InfoHint text={hint} /> : null}
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
    </div>
  )
}

/** Resumen legible de los parámetros configurados en la promoción. */
function promotionSummary(promotion: ComboPromotion): string {
  switch (promotion.type) {
    case "PERCENT":
      return `${Number(promotion.value)} % de descuento.`
    case "FIXED":
      return `${formatMoney(Number(promotion.value))} de descuento.`
    case "SPECIAL_PRICE":
      return `Precio especial de ${formatMoney(Number(promotion.specialPrice ?? 0))}.`
    case "BOGO":
      return "Paga 1 y recibe 2."
    case "PAY_X_GET_Y":
      return `Paga ${promotion.payQuantity ?? 1} y recibe ${promotion.getQuantity ?? 2}.`
    case "FREE_ITEM":
      return "Incluye un artículo gratis."
    case "SECOND_HALF_PRICE":
      return "Segundo artículo al 50 %."
    default:
      return ""
  }
}

function ComboPromotionHint({ promotion }: { promotion: ComboPromotion }) {
  return (
    <HoverCard>
      <HoverCardTrigger
        render={<button type="button" />}
        className={cn(
          badgeVariants({ variant: "outline" }),
          "cursor-default border-sky-700 bg-sky-500/10 text-sky-700 dark:border-sky-400 dark:bg-sky-400/10 dark:text-sky-400"
        )}
        aria-label={`Promoción: ${PROMOTION_TYPE_LABELS[promotion.type]}`}
      >
        <TicketPercentIcon />
      </HoverCardTrigger>
      <HoverCardContent align="end" className="w-60 p-2">
        <p className="px-2 pb-1 text-xs font-medium text-muted-foreground">
          Promoción
        </p>
        <div className="flex items-center justify-between gap-2 rounded-md px-2 py-1 text-sm">
          <span className="truncate">
            {PROMOTION_TYPE_LABELS[promotion.type]}
          </span>
          {promotion.isActive ? null : (
            <Badge variant="outline" className="shrink-0 text-[10px]">
              Inactiva
            </Badge>
          )}
        </div>
        <p className="px-2 pt-1 text-xs text-muted-foreground">
          {promotionSummary(promotion)}
        </p>
      </HoverCardContent>
    </HoverCard>
  )
}

export interface ComboRowActions {
  onEdit: (combo: ArticleListItem) => void
  onActivate: (combo: ArticleListItem) => void
  onDeactivate: (combo: ArticleListItem) => void
  onDelete: (combo: ArticleListItem) => void
  canManage: boolean
  isPending: (combo: ArticleListItem) => boolean
}

export function ComboActionsMenu({
  combo,
  actions,
  triggerSize = "icon-xs",
}: {
  combo: ArticleListItem
  actions: ComboRowActions
  triggerSize?: ComponentProps<typeof Button>["size"]
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size={triggerSize}
            className="text-muted-foreground aria-expanded:bg-muted"
            disabled={actions.isPending(combo)}
            aria-label={`Acciones de ${combo.name}`}
          />
        }
      >
        <EllipsisVerticalIcon />
        <span className="sr-only">Acciones</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => actions.onEdit(combo)}>
            <PencilIcon />
            Editar combo
          </DropdownMenuItem>
          {actions.canManage ? (
            combo.isActive ? (
              <DropdownMenuItem
                className="text-amber-600 focus:bg-amber-500/10 focus:text-amber-600 dark:text-amber-400 dark:focus:text-amber-400"
                onClick={() => actions.onDeactivate(combo)}
              >
                <PowerIcon />
                Desactivar
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                className="text-emerald-600 focus:bg-emerald-500/10 focus:text-emerald-600 dark:text-emerald-400 dark:focus:text-emerald-400"
                onClick={() => actions.onActivate(combo)}
              >
                <PowerIcon />
                Activar
              </DropdownMenuItem>
            )
          ) : null}
        </DropdownMenuGroup>
        {actions.canManage ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                variant="destructive"
                onClick={() => actions.onDelete(combo)}
              >
                <Trash2Icon />
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

const sortCombosByName: SortFn<DataTableFeatures, ArticleListItem> = (
  rowA,
  rowB
) => {
  if (rowA.original.isActive !== rowB.original.isActive) {
    return rowA.original.isActive ? -1 : 1
  }

  return rowA.original.name.localeCompare(rowB.original.name, "es", {
    sensitivity: "base",
  })
}

export function createComboColumns(
  actions: ComboRowActions,
  options: { selectable: boolean; recipes: Recipe[] }
) {
  return columnHelper.columns([
    ...(options.selectable
      ? [
          columnHelper.display({
            id: "select",
            header: ({ table }) => (
              <div className="flex items-center justify-center">
                <Checkbox
                  checked={table.getIsAllPageRowsSelected()}
                  indeterminate={
                    table.getIsSomePageRowsSelected() &&
                    !table.getIsAllPageRowsSelected()
                  }
                  onCheckedChange={(value) =>
                    table.toggleAllPageRowsSelected(!!value)
                  }
                  aria-label="Seleccionar todos los registros de la página"
                />
              </div>
            ),
            cell: ({ row }) => (
              <div className="flex items-center justify-center">
                <Checkbox
                  checked={row.getIsSelected()}
                  disabled={!row.getCanSelect()}
                  onCheckedChange={(value) => row.toggleSelected(!!value)}
                  aria-label={`Seleccionar ${row.original.name}`}
                />
              </div>
            ),
            enableSorting: false,
            enableHiding: false,
            enableGlobalFilter: false,
          }),
        ]
      : []),

    columnHelper.accessor("name", {
      id: "name",
      header: ({ column }) => (
        <ComboColumnHeader title="Combo" column={column} />
      ),
      cell: ({ row }) => {
        const promotion = row.original.promotions?.[0]

        return (
          <div className="flex items-center gap-1.5">
            <span className="font-medium whitespace-nowrap">
              {row.original.name}
            </span>
            {promotion ? <ComboPromotionHint promotion={promotion} /> : null}
            {row.original.isActive ? null : (
              <Badge
                variant="outline"
                className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400"
              >
                Inactivo
              </Badge>
            )}
          </div>
        )
      },
      sortFn: sortCombosByName,
    }),

    columnHelper.accessor(
      (combo) => comboPricing(combo).effective,
      {
        id: "price",
        header: ({ column }) => (
          <ComboColumnHeader
            title="Precio"
            column={column}
            align="right"
            hint="Precio efectivo y, si hay una promoción activa, precio real del combo."
          />
        ),
        cell: ({ row }) => {
          const { normal, effective } = comboPricing(row.original)

          return (
            <div className="flex items-baseline justify-end gap-1 whitespace-nowrap tabular-nums">
              <span className="font-medium">{formatMoney(effective)}</span>
              <span className="text-muted-foreground">/</span>
              <span
                className={cn(
                  "text-muted-foreground",
                  effective !== normal && "line-through"
                )}
              >
                {formatMoney(normal)}
              </span>
            </div>
          )
        },
        sortFn: "basic",
      }
    ),

    columnHelper.accessor(
      (combo) => {
        const cost = comboCost(combo, options.recipes)
        const { effective } = comboPricing(combo)
        if (cost === null || effective <= 0) return null
        return cost / effective
      },
      {
        id: "cost",
        header: ({ column }) => (
          <ComboColumnHeader
            title="Costo ($/%)"
            column={column}
            align="right"
            hint="Costo real de los componentes y su porcentaje sobre el precio efectivo."
          />
        ),
        cell: ({ row }) => {
          const cost = comboCost(row.original, options.recipes)
          if (cost === null) {
            return <span className="block text-right">—</span>
          }

          const { effective } = comboPricing(row.original)
          const share = effective > 0 ? cost / effective : null

          return (
            <div className="flex items-baseline justify-end gap-1 whitespace-nowrap tabular-nums">
              <span className="font-medium">{formatMoney(cost)}</span>
              <span className="text-muted-foreground">/</span>
              <span className={costPercentClass(share)}>
                {formatMarginPercent(share)}
              </span>
            </div>
          )
        },
        sortFn: "basic",
      }
    ),

    columnHelper.accessor(
      (combo) => {
        const cost = comboCost(combo, options.recipes)
        const { effective } = comboPricing(combo)
        if (cost === null || effective <= 0) return null
        return (effective - cost) / effective
      },
      {
        id: "margin",
        header: ({ column }) => (
          <ComboColumnHeader
            title="Margen ($/%)"
            column={column}
            align="right"
            hint="Precio efectivo menos costo, y su margen bruto."
          />
        ),
        cell: ({ row }) => {
          const cost = comboCost(row.original, options.recipes)
          const { effective } = comboPricing(row.original)

          if (cost === null || effective <= 0) {
            return <span className="block text-right">—</span>
          }

          const margin = effective - cost

          return (
            <div className="flex items-baseline justify-end gap-1 whitespace-nowrap tabular-nums">
              <span
                className={cn(
                  "font-medium",
                  margin < 0 && "text-destructive"
                )}
              >
                {formatMoney(margin)}
              </span>
              <span className="text-muted-foreground">/</span>
              <span className={marginPercentClass(margin / effective)}>
                {formatMarginPercent(margin / effective)}
              </span>
            </div>
          )
        },
        sortFn: "basic",
      }
    ),

    columnHelper.accessor(
      (combo) => combo.comboComponents?.length ?? 0,
      {
        id: "components",
        header: ({ column }) => (
          <ComboColumnHeader
            title="Artículos"
            column={column}
            align="right"
            hint="Artículos y presentaciones incluidos en el combo."
            icon={<SoupIcon className="size-4" />}
          />
        ),
        cell: ({ row }) => (
          <div className="flex items-center justify-end">
            <ComboComponentsPreview
              components={row.original.comboComponents ?? []}
            />
          </div>
        ),
        sortFn: "basic",
      }
    ),

    columnHelper.accessor((combo) => combo.menus?.length ?? 0, {
      id: "menu",
      header: ({ column }) => (
        <ComboColumnHeader
          title="Menú"
          column={column}
          align="right"
          hint="Menús donde se usa el combo."
          icon={<NotebookTextIcon className="size-4" />}
        />
      ),
      cell: ({ row }) => (
        <div className="flex items-center justify-end">
          <MenusCountBadge count={row.original.menus?.length ?? 0} />
        </div>
      ),
      enableSorting: false,
    }),

    columnHelper.display({
      id: "actions",
      header: () => <span className="sr-only">Acciones</span>,
      cell: ({ row }) => (
        <div
          className="flex items-center justify-center"
          onClick={(event) => event.stopPropagation()}
        >
          <ComboActionsMenu combo={row.original} actions={actions} />
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
      enableGlobalFilter: false,
    }),
  ])
}

export const COMBO_COLUMN_LABELS: Record<string, string> = {
  select: "Selección",
  name: "Combo",
  price: "Precio",
  cost: "Costo ($/%)",
  margin: "Margen ($/%)",
  components: "Artículos",
  menu: "Menú",
}
