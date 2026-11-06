"use client"

import type { ComponentProps, ReactNode } from "react"
import { createColumnHelper, type SortFn } from "@tanstack/react-table"
import {
  BeefIcon,
  BlenderIcon,
  ChevronDownIcon,
  ChevronsUpDownIcon,
  ChevronUpIcon,
  EllipsisVerticalIcon,
  LayersIcon,
  NotebookTextIcon,
  PencilIcon,
  PowerIcon,
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import {
  formatMarginPercent,
  formatMoney,
  priceWithoutTax,
  suggestedPriceFromCost,
  type ArticleListItem,
  type Recipe,
  type Variant,
} from "@/lib/catalog"
import { cn } from "cn"

import type { DataTableFeatures } from "@/components/data-table/data-table-features"
import { IngredientsPreview } from "./ingredients-preview"
import { MenusCountBadge } from "./menus-count"
import { ComboBadge } from "./combo-badge"
import { costPercentClass, marginPercentClass } from "./metric-colors"

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
  icon,
}: {
  title: string
  column: SortableColumn
  align?: "left" | "right"
  /** Texto de ayuda que se muestra en un icono junto al título. */
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
  /** Abre el combo indicado para editarlo. */
  onEditCombo: (comboId: string) => void
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
  price,
  variants: allVariants,
  compact = false,
  className,
}: {
  /** Precio del artículo; las presentaciones se calculan con su ajuste. */
  price: string
  variants: Variant[]
  /** En tarjetas: solo icono y número, sin la etiqueta de texto. */
  compact?: boolean
  /** Estilos extra del badge (p. ej. sobre una imagen oscura). */
  className?: string
}) {
  const variants = allVariants.filter((variant) => variant.isActive)

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

  const base = Number(price)
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
      <HoverCardContent align="end" className="w-64 p-2">
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
                className="rounded-md px-2 py-1 text-sm data-[primary=true]:bg-primary/10 data-[primary=true]:text-primary"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate" title={variant.name}>
                    {variant.name}
                  </span>
                  <span className="shrink-0 font-medium tabular-nums">
                    {formatMoney(base + Number(variant.priceAdjust))}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
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

/** Receta base (sin presentación) de cada artículo. */
function buildRecipeMap(recipes: Recipe[]): Map<string, Recipe> {
  const map = new Map<string, Recipe>()

  for (const recipe of recipes) {
    if (!recipe.itemId) continue

    const current = map.get(recipe.itemId)
    if (!current || (current.variantId !== null && recipe.variantId === null)) {
      map.set(recipe.itemId, recipe)
    }
  }

  return map
}

/** Costo estimado del artículo a partir de su receta. */
function articleRecipeCost(recipe: Recipe | null | undefined): number | null {
  if (!recipe || recipe.estimatedCost === null) return null

  const cost = Number(recipe.estimatedCost)
  return Number.isFinite(cost) ? cost : null
}

/**
 * Definición de columnas de la tabla de artículos.
 *
 * Selección · Artículo · Precio/Sugerido · Costo ($/%) · Margen ($/%) ·
 * Categoría · Ingredientes · Acciones. Sigue el mismo patrón que la tabla de
 * recetas.
 */
export function createArticleColumns(
  actions: ArticleRowActions,
  options: {
    selectable: boolean
    recipes: Recipe[]
    taxRate: string
    /**
     * `"selection"` deja solo las columnas para elegir artículos de un menú
     * (Artículo, Precio, Categoría y Grupo), sin acciones de fila.
     */
    variant?: "full" | "selection"
    /** Selector de grupo por fila; solo se usa en la variante `selection`. */
    renderGroup?: (article: ArticleListItem) => ReactNode
  }
) {
  const recipeByItemId = buildRecipeMap(options.recipes)
  const isSelection = options.variant === "selection"

  const columns = columnHelper.columns([
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
        <ArticleColumnHeader title="Artículo" column={column} />
      ),
      cell: ({ row }) => {
        const hasRecipe =
          (row.original.recipes?.length ?? row.original._count.recipes) > 0

        return (
          <div className="flex items-center gap-1.5">
            <span className="font-medium whitespace-nowrap">
              {row.original.name}
            </span>
            <PresentationPreview
              price={row.original.price}
              variants={row.original.variants}
              compact
            />
            <ComboBadge
              combos={row.original.componentOf ?? []}
              onEditCombo={actions.onEditCombo}
            />
            {hasRecipe ? (
              <Badge
                variant="outline"
                title="Publicado desde una receta"
                aria-label="Publicado desde una receta"
                className="h-5 border-primary/90 bg-primary/5 px-2 py-0.5 text-primary/90 dark:border-chart-1/90 dark:bg-primary/10 dark:text-chart-1"
              >
                <BlenderIcon />
              </Badge>
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
          title={isSelection ? "Precio" : "Precio/Sugerido"}
          column={column}
          align="right"
          hint={
            isSelection
              ? "Precio final del artículo."
              : "Precio final del artículo y el sugerido a partir del costo, con margen bruto del 65 % e IVA incluido."
          }
        />
      ),
      cell: ({ row }) => {
        const price = Number(row.original.price)

        if (isSelection) {
          return (
            <span className="block text-right font-medium whitespace-nowrap tabular-nums">
              {formatMoney(price)}
            </span>
          )
        }

        const recipe = recipeByItemId.get(row.original.id)
        const suggested = suggestedPriceFromCost(
          articleRecipeCost(recipe),
          row.original.taxRate ?? options.taxRate
        )

        return (
          <div
            className="flex items-baseline justify-end gap-1 whitespace-nowrap tabular-nums"
            title="Precio/Sugerido"
          >
            <span className="font-medium">{formatMoney(price)}</span>
            <span className="text-muted-foreground">/</span>
            <span className="text-muted-foreground">
              {suggested === null ? "—" : formatMoney(suggested)}
            </span>
          </div>
        )
      },
      sortFn: "basic",
    }),

    columnHelper.accessor(
      (article) => {
        const cost = articleRecipeCost(recipeByItemId.get(article.id))
        if (cost === null) return null
        const netPrice = priceWithoutTax(
          Number(article.price),
          article.taxRate ?? options.taxRate
        )
        return netPrice !== null && netPrice > 0 ? cost / netPrice : null
      },
      {
        id: "cost",
        header: ({ column }) => (
          <ArticleColumnHeader
            title="Costo ($/%)"
            column={column}
            align="right"
            hint="Costo estimado del artículo y su porcentaje sobre el precio sin IVA."
          />
        ),
        cell: ({ row }) => {
          const cost = articleRecipeCost(recipeByItemId.get(row.original.id))
          if (cost === null) {
            return <span className="block text-right">—</span>
          }

          const netPrice = priceWithoutTax(
            Number(row.original.price),
            row.original.taxRate ?? options.taxRate
          )
          const share = netPrice !== null && netPrice > 0 ? cost / netPrice : null

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
      (article) => {
        const cost = articleRecipeCost(recipeByItemId.get(article.id))
        if (cost === null) return null
        const netPrice = priceWithoutTax(
          Number(article.price),
          article.taxRate ?? options.taxRate
        )
        if (netPrice === null || netPrice <= 0) return null
        return (netPrice - cost) / netPrice
      },
      {
        id: "margin",
        header: ({ column }) => (
          <ArticleColumnHeader
            title="Margen ($/%)"
            column={column}
            align="right"
            hint="Diferencia entre el precio sin IVA y el costo, y su margen bruto sobre el precio sin IVA."
          />
        ),
        cell: ({ row }) => {
          const cost = articleRecipeCost(recipeByItemId.get(row.original.id))
          const netPrice = priceWithoutTax(
            Number(row.original.price),
            row.original.taxRate ?? options.taxRate
          )

          if (cost === null || netPrice === null || netPrice <= 0) {
            return <span className="block text-right">—</span>
          }

          const margin = netPrice - cost

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
              <span className={marginPercentClass(margin / netPrice)}>
                {formatMarginPercent(margin / netPrice)}
              </span>
            </div>
          )
        },
        sortFn: "basic",
      }
    ),

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

    columnHelper.accessor(
      (article) => recipeByItemId.get(article.id)?.ingredients.length ?? -1,
      {
        id: "ingredients",
        header: ({ column }) => (
          <ArticleColumnHeader
            title="Ingredientes"
            column={column}
            align="right"
            hint="Insumos de la receta del artículo; si no tiene receta, no hay ingredientes que mostrar."
            icon={<BeefIcon className="size-4" />}
          />
        ),
        cell: ({ row }) => {
          const recipe = recipeByItemId.get(row.original.id)

          if (!recipe) {
            return <span className="block text-right">—</span>
          }

          return (
            <div className="flex items-center justify-end">
              <IngredientsPreview recipe={recipe} />
            </div>
          )
        },
        enableSorting: false,
      }
    ),

    columnHelper.accessor((article) => article.menus?.length ?? 0, {
      id: "menu",
      header: ({ column }) => (
        <ArticleColumnHeader
          title="Menú"
          column={column}
          align="right"
          hint="Menús donde se usa el artículo."
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

    ...(options.renderGroup
      ? [
          columnHelper.display({
            id: "group",
            header: () => (
              <span className="px-1 text-sm font-medium">Grupo</span>
            ),
            cell: ({ row }) => options.renderGroup!(row.original),
            enableSorting: false,
          }),
        ]
      : []),

    ...(isSelection
      ? []
      : [
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
        ]),
  ])

  if (!isSelection) return columns

  // Solo lo necesario para elegir artículos: sin costo, margen ni acciones.
  return columns.filter((column) => {
    const id = String(column.id)
    return ["select", "name", "price", "category", "group"].includes(id)
  })
}

export const ARTICLE_COLUMN_LABELS: Record<string, string> = {
  select: "Selección",
  name: "Artículo",
  price: "Precio/Sugerido",
  cost: "Costo ($/%)",
  margin: "Margen ($/%)",
  category: "Categoría",
  group: "Grupo",
  ingredients: "Ingredientes",
  menu: "Menú",
}
