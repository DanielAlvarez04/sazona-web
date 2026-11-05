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
  GroupIcon,
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
  suggestedPriceFromCost,
  type ArticleListItem,
  type Recipe,
  type Variant,
} from "@/lib/catalog"
import { cn } from "cn"

import type { DataTableFeatures } from "@/components/data-table/data-table-features"
import { IngredientsPreview } from "./ingredients-preview"
import { MenusCountBadge } from "./menus-count"

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
  costs,
  compact = false,
  className,
}: {
  /** Precio del artículo; las presentaciones se calculan con su ajuste. */
  price: string
  variants: Variant[]
  /** Costo base de cada presentación; opcional. */
  costs?: Array<{ variantId: string; estimatedCost: string | null }>
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
            const cost = costs?.find(
              (candidate) => candidate.variantId === variant.id
            )?.estimatedCost

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
                {costs ? (
                  <div className="text-right text-xs text-muted-foreground">
                    {cost ? `Costo ${formatMoney(cost)}` : "Sin costo"}
                  </div>
                ) : null}
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
  options: { selectable: boolean; recipes: Recipe[] }
) {
  const recipeByItemId = buildRecipeMap(options.recipes)

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
        <ArticleColumnHeader title="Artículo" column={column} />
      ),
      cell: ({ row }) => {
        const hasRecipe =
          (row.original.recipes?.length ?? row.original._count.recipes) > 0
        const recipe = recipeByItemId.get(row.original.id)

        return (
          <div className="flex items-center gap-1.5">
            <span className="font-medium whitespace-nowrap">
              {row.original.name}
            </span>
            <PresentationPreview
              price={row.original.price}
              variants={row.original.variants}
              costs={recipe?.variantCosts}
              compact
            />
            {hasRecipe ? (
              <Badge
                title="Publicado desde una receta"
                aria-label="Publicado desde una receta"
              >
                <BlenderIcon />
              </Badge>
            ) : null}
            {row.original.isCombo ? (
              <Badge variant="secondary">
                <GroupIcon data-icon="inline-start" />
                Combo
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
          title="Precio/Sugerido"
          column={column}
          align="right"
          hint="Precio del artículo y el precio sugerido a partir del costo, con un margen bruto del 65 %."
        />
      ),
      cell: ({ row }) => {
        const price = Number(row.original.price)
        const recipe = recipeByItemId.get(row.original.id)
        const suggested = suggestedPriceFromCost(articleRecipeCost(recipe))

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
      (article) => articleRecipeCost(recipeByItemId.get(article.id)),
      {
        id: "cost",
        header: ({ column }) => (
          <ArticleColumnHeader
            title="Costo ($/%)"
            column={column}
            align="right"
            hint="Costo estimado del artículo a partir de su receta y su porcentaje sobre el precio."
          />
        ),
        cell: ({ row }) => {
          const cost = articleRecipeCost(recipeByItemId.get(row.original.id))
          if (cost === null) {
            return <span className="block text-right">—</span>
          }

          const price = Number(row.original.price)
          const share = price > 0 ? cost / price : null

          return (
            <div className="flex items-baseline justify-end gap-1 whitespace-nowrap tabular-nums">
              <span className="font-medium">{formatMoney(cost)}</span>
              <span className="text-muted-foreground">/</span>
              <span className="text-muted-foreground">
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
        return Number(article.price) - cost
      },
      {
        id: "margin",
        header: ({ column }) => (
          <ArticleColumnHeader
            title="Margen ($/%)"
            column={column}
            align="right"
            hint="Diferencia entre el precio del artículo y su costo, y su margen bruto sobre el precio."
          />
        ),
        cell: ({ row }) => {
          const price = Number(row.original.price)
          const cost = articleRecipeCost(recipeByItemId.get(row.original.id))

          if (cost === null || price <= 0) {
            return <span className="block text-right">—</span>
          }

          const margin = price - cost

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
              <span
                className={cn(
                  "text-muted-foreground",
                  margin < 0 && "text-destructive"
                )}
              >
                {formatMarginPercent(margin / price)}
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
  name: "Artículo",
  price: "Precio/Sugerido",
  cost: "Costo ($/%)",
  margin: "Margen ($/%)",
  category: "Categoría",
  ingredients: "Ingredientes",
  menu: "Menú",
}
