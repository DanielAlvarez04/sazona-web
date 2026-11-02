"use client"

import type { ComponentProps } from "react"
import { createColumnHelper, type SortFn } from "@tanstack/react-table"
import {
  BookOpenIcon,
  ChevronDownIcon,
  ChevronsUpDownIcon,
  ChevronUpIcon,
  EllipsisVerticalIcon,
  LayersIcon,
  PencilIcon,
  PowerIcon,
  Trash2Icon,
  UtensilsCrossedIcon,
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import { formatMoney, type ArticleListItem } from "@/lib/catalog"
import { cn } from "cn"

import type { DataTableFeatures } from "@/components/data-table/data-table-features"

const columnHelper = createColumnHelper<DataTableFeatures, ArticleListItem>()

interface SortableColumn {
  getCanSort: () => boolean
  getIsSorted: () => false | "asc" | "desc"
  getToggleSortingHandler: () => ((event: unknown) => void) | undefined
}

function ArticleColumnHeader({
  title,
  column,
  align = "left",
  hint,
}: {
  title: string
  column: SortableColumn
  align?: "left" | "right"
  /** Texto de ayuda que se muestra en un icono junto al título. */
  hint?: string
}) {
  const wrapper = cn(
    "flex items-center gap-1",
    align === "right" ? "justify-end" : undefined
  )

  if (!column.getCanSort()) {
    return (
      <div className={wrapper}>
        <span className="font-medium">{title}</span>
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
        className={`h-8 data-[sorted=true]:bg-accent ${align === "right" ? "ml-0" : "-ml-2"}`}
        data-sorted={sorted !== false}
        onClick={column.getToggleSortingHandler()}
      >
        {title}
        {/* La ayuda va entre el título y los chevrones de ordenación. */}
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

export interface ArticleRowActions {
  onEdit: (article: ArticleListItem) => void
  onActivate: (article: ArticleListItem) => void
  onDeactivate: (article: ArticleListItem) => void
  onDelete: (article: ArticleListItem) => void
  canManage: boolean
  isPending: (article: ArticleListItem) => boolean
}

export function ArticleActionsMenu({
  article,
  actions,
  triggerSize = "icon-xs",
  triggerClassName,
}: {
  article: ArticleListItem
  actions: ArticleRowActions
  /** Tamaño del botón de tres puntos (más grande en las tarjetas). */
  triggerSize?: ComponentProps<typeof Button>["size"]
  /** Estilos extra del disparador (p. ej. puntos blancos sobre una imagen). */
  triggerClassName?: string
}) {
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
            disabled={actions.isPending(article)}
            aria-label={`Acciones de ${article.name}`}
          />
        }
      >
        <EllipsisVerticalIcon />
        <span className="sr-only">Acciones</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Acciones</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => actions.onEdit(article)}>
            <PencilIcon />
            Editar artículo
          </DropdownMenuItem>
          {actions.canManage ? (
            article.isActive ? (
              <DropdownMenuItem
                className="text-amber-600 focus:bg-amber-500/10 focus:text-amber-600 dark:text-amber-400 dark:focus:text-amber-400"
                onClick={() => actions.onDeactivate(article)}
              >
                <PowerIcon />
                Desactivar
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                className="text-emerald-600 focus:bg-emerald-500/10 focus:text-emerald-600 dark:text-emerald-400 dark:focus:text-emerald-400"
                onClick={() => actions.onActivate(article)}
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
                onClick={() => actions.onDelete(article)}
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

/** Vista previa de las presentaciones con su precio absoluto. */
export function PresentationPreview({
  article,
  compact = false,
  className,
}: {
  article: ArticleListItem
  /** En tarjetas: solo icono y número, sin la etiqueta de texto. */
  compact?: boolean
  /** Estilos extra del badge (p. ej. sobre una imagen oscura). */
  className?: string
}) {
  const variants = article.variants.filter((variant) => variant.isActive)

  if (variants.length === 0) {
    // Sin presentaciones propias, el precio del artículo es la única.
    return (
      <Badge
        variant="outline"
        className={cn(
          "text-muted-foreground",
          compact && "gap-0.5 px-1.5",
          className
        )}
        title={compact ? "Única presentación" : undefined}
        aria-label="Única presentación"
      >
        <LayersIcon />
        {compact ? 1 : "Única presentación"}
      </Badge>
    )
  }

  const base = Number(article.price)
  const primary = variants.find((variant) => variant.isPrimary) ?? variants[0]

  return (
    <HoverCard>
      <HoverCardTrigger
        render={<button type="button" />}
        className={cn(
          badgeVariants({ variant: "outline" }),
          "cursor-default tabular-nums",
          compact && "gap-0.5 px-1.5",
          className
        )}
        aria-label={`${variants.length} ${variants.length === 1 ? "presentación" : "presentaciones"}. Ver precios`}
      >
        <LayersIcon />
        {variants.length}
        {compact ? null : (
          <span>
            {variants.length === 1 ? "Presentación" : "Presentaciones"}
          </span>
        )}
      </HoverCardTrigger>
      <HoverCardContent align="end" className="w-60 p-2">
        <p className="px-2 pb-1 text-xs font-medium text-muted-foreground">
          {variants.length === 1 ? "Presentación" : "Presentaciones"}
        </p>
        <div className="flex flex-col gap-0.5">
          {variants.map((variant) => {
            const isPrimary = variant.id === primary.id

            return (
              <div
                key={variant.id}
                data-primary={isPrimary}
                className="flex items-center justify-between gap-3 rounded-md px-2 py-1 text-sm data-[primary=true]:bg-primary/10 data-[primary=true]:text-primary"
              >
                <span className="min-w-0 truncate" title={variant.name}>
                  {variant.name}
                </span>
                <span className="shrink-0 font-medium tabular-nums">
                  {formatMoney(base + Number(variant.priceAdjust))}
                </span>
              </div>
            )
          })}
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}

/**
 * Menús donde se usa el artículo.
 *
 * Todavía no existe el módulo de menús: la UI queda lista para cuando la API
 * devuelva `menus` en el artículo.
 */
function MenuPreview({ article }: { article: ArticleListItem }) {
  const menus = article.menus ?? []

  return (
    <HoverCard>
      <HoverCardTrigger
        render={<button type="button" />}
        className={cn(
          badgeVariants({ variant: "outline" }),
          menus.length === 0 && "text-muted-foreground",
          "cursor-default tabular-nums"
        )}
        aria-label={`${menus.length} ${menus.length === 1 ? "menú" : "menús"}. Ver detalle`}
      >
        <UtensilsCrossedIcon />
        {menus.length}
      </HoverCardTrigger>
      <HoverCardContent align="end" className="w-60 p-2">
        <p className="px-2 pb-1 text-xs font-medium text-muted-foreground">
          {menus.length === 1 ? "Menú" : "Menús"}
        </p>
        {menus.length === 0 ? (
          <p className="px-2 py-1 text-sm text-muted-foreground">
            Aún no se usa en ningún menú.
          </p>
        ) : (
          <div className="flex flex-col gap-0.5">
            {menus.map((menu) => (
              <div
                key={menu.id}
                className="truncate rounded-md px-2 py-1 text-sm"
                title={menu.name}
              >
                {menu.name}
              </div>
            ))}
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  )
}

/**
 * Orden del nombre: primero los artículos activos y, dentro de cada grupo,
 * alfabético. Así, al desactivar un artículo, cae al final de la tabla.
 */
const sortArticlesByName: SortFn<DataTableFeatures, ArticleListItem> = (
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

/**
 * Definición de columnas de la tabla de artículos.
 *
 * Selección · SKU · Artículo · Precio · Categoría · Presentaciones · Menú ·
 * Acciones. Los estilos siguen la tabla de insumos de `/inventory`.
 */
export function createArticleColumns(
  actions: ArticleRowActions,
  options: { selectable: boolean }
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
                  aria-label="Seleccionar todos los artículos de la página"
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

    columnHelper.accessor((article) => article.sku ?? "", {
      id: "sku",
      header: ({ column }) => (
        <ArticleColumnHeader title="SKU" column={column} />
      ),
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-muted-foreground">
          {row.original.sku ?? "—"}
        </span>
      ),
      enableSorting: false,
    }),

    columnHelper.accessor("name", {
      id: "name",
      header: ({ column }) => (
        <ArticleColumnHeader title="Artículo" column={column} />
      ),
      cell: ({ row }) => {
        const hasRecipe =
          (row.original.recipes?.length ?? row.original._count.recipes) > 0

        return (
          <div className="flex items-center gap-2">
            <span className="font-medium whitespace-nowrap">
              {row.original.name}
            </span>
            {hasRecipe ? (
              <Badge
                title="Publicado desde una receta"
                aria-label="Publicado desde una receta"
              >
                <BookOpenIcon />
              </Badge>
            ) : null}
            {row.original.isCombo ? (
              <Badge variant="secondary">Combo</Badge>
            ) : null}
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
      sortFn: sortArticlesByName,
    }),

    columnHelper.accessor((article) => Number(article.price), {
      id: "price",
      header: ({ column }) => (
        <ArticleColumnHeader
          title="Precio"
          column={column}
          align="right"
          hint="Precio del artículo y/o de la presentación principal"
        />
      ),
      cell: ({ getValue }) => (
        <div className="text-right whitespace-nowrap font-medium tabular-nums">
          {formatMoney(getValue())}
        </div>
      ),
      sortFn: "basic",
    }),

    columnHelper.accessor((article) => article.category?.name ?? "", {
      id: "category",
      header: ({ column }) => (
        <ArticleColumnHeader title="Categoría" column={column} />
      ),
      cell: ({ row }) => {
        const category = row.original.category?.name

        return (
          <Badge variant="secondary" title={category ?? "Sin categoría"}>
            {category ?? "Sin categoría"}
          </Badge>
        )
      },
      enableSorting: false,
    }),

    columnHelper.display({
      id: "variants",
      header: () => <span className="font-medium">Presentaciones</span>,
      cell: ({ row }) => (
        <div className="flex items-center">
          <PresentationPreview article={row.original} />
        </div>
      ),
      enableSorting: false,
      enableGlobalFilter: false,
    }),

    columnHelper.display({
      id: "menus",
      header: () => <span className="font-medium">Menú</span>,
      cell: ({ row }) => (
        <div className="flex items-center">
          <MenuPreview article={row.original} />
        </div>
      ),
      enableSorting: false,
      enableGlobalFilter: false,
    }),

    columnHelper.display({
      id: "actions",
      header: () => <span className="sr-only">Acciones</span>,
      cell: ({ row }) => (
        <div
          className="flex items-center justify-center"
          onClick={(event) => event.stopPropagation()}
        >
          <ArticleActionsMenu article={row.original} actions={actions} />
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
      enableGlobalFilter: false,
    }),
  ])
}

export const ARTICLE_COLUMN_LABELS: Record<string, string> = {
  select: "Selección",
  sku: "SKU",
  name: "Artículo",
  price: "Precio",
  category: "Categoría",
  variants: "Presentaciones",
  menus: "Menú",
}
