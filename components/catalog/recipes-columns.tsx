"use client"

import { createColumnHelper, type SortFn } from "@tanstack/react-table"
import type { ComponentProps, ReactNode } from "react"
import {
  BeefIcon,
  ChevronDownIcon,
  ChevronsUpDownIcon,
  ChevronUpIcon,
  EllipsisVerticalIcon,
  NotebookTextIcon,
  PackageIcon,
  PencilIcon,
  PlayIcon,
  SoupIcon,
  Trash2Icon,
  Undo2Icon,
  UploadIcon,
} from "lucide-react"

import { InfoHint } from "@/components/info-hint"
import { Badge } from "@/components/ui/badge"
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
  formatMarginPercent,
  formatMoney,
  priceWithoutTax,
  suggestedPriceFromCost,
  type ArticleListItem,
  type Recipe,
} from "@/lib/catalog"
import { cn } from "cn"

import type { DataTableFeatures } from "@/components/data-table/data-table-features"
import { IngredientsPreview } from "./ingredients-preview"
import { PresentationPreview } from "./articles-columns"
import { MenusCountBadge } from "./menus-count"
import { ComboBadge } from "./combo-badge"
import { costPercentClass, marginPercentClass } from "./metric-colors"

const columnHelper = createColumnHelper<DataTableFeatures, Recipe>()

interface SortableColumn {
  getCanSort: () => boolean
  getIsSorted: () => false | "asc" | "desc"
  getToggleSortingHandler: () => ((event: unknown) => void) | undefined
}

function RecipeColumnHeader({
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

export interface RecipeRowActions {
  onEdit: (recipe: Recipe) => void
  onPublish: (recipe: Recipe) => void
  onUnpublish: (recipe: Recipe) => void
  onProduce: (recipe: Recipe) => void
  onToggleActive: (recipe: Recipe) => void
  onDelete: (recipe: Recipe) => void
  /** Abre el combo indicado para editarlo. */
  onEditCombo: (comboId: string) => void
  canManage: boolean
  isPending: (recipe: Recipe) => boolean
}

export function RecipeActionsMenu({
  recipe,
  actions,
  triggerSize = "icon-xs",
  triggerClassName,
}: {
  recipe: Recipe
  actions: RecipeRowActions
  /** Tamaño del botón de tres puntos (más grande en las tarjetas). */
  triggerSize?: ComponentProps<typeof Button>["size"]
  /** Estilos extra del disparador (p. ej. puntos blancos sobre una imagen). */
  triggerClassName?: string
}) {
  const pending = actions.isPending(recipe)

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
            disabled={pending}
            aria-label={`Acciones de ${recipe.name}`}
          />
        }
      >
        <EllipsisVerticalIcon />
        <span className="sr-only">Acciones</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => actions.onEdit(recipe)}>
            <PencilIcon />
            Editar receta
          </DropdownMenuItem>
          {recipe.producesIngredient ? (
            <DropdownMenuItem onClick={() => actions.onProduce(recipe)}>
              <PlayIcon />
              Producir lote
            </DropdownMenuItem>
          ) : null}
          {recipe.itemId ? (
            <DropdownMenuItem onClick={() => actions.onUnpublish(recipe)}>
              <Undo2Icon />
              Quitar artículo
            </DropdownMenuItem>
          ) : recipe.producesIngredient ? null : (
            <DropdownMenuItem onClick={() => actions.onPublish(recipe)}>
              <UploadIcon />
              Publicar como artículo
            </DropdownMenuItem>
          )}
          {recipe.isActive ? null : (
            <DropdownMenuItem onClick={() => actions.onToggleActive(recipe)}>
              Activar
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>
        {actions.canManage ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => actions.onDelete(recipe)}
            >
              <Trash2Icon />
              Eliminar
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Costo estimado del producto (presentación principal). */
function recipeCost(recipe: Recipe): number | null {
  if (recipe.estimatedCost === null) return null

  const cost = Number(recipe.estimatedCost)
  return Number.isFinite(cost) ? cost : null
}

/** Precio guardado en el artículo, publicado o borrador. */
function recipePrice(article: ArticleListItem | null): number | null {
  if (!article) return null

  const price = Number(article.price)
  return Number.isFinite(price) ? price : null
}

/** Precio sugerido: costo / 35 % más el IVA correspondiente. */
function recipeSuggestedPrice(recipe: Recipe, taxRate: string): number | null {
  return suggestedPriceFromCost(recipeCost(recipe), taxRate)
}

/**
 * Precio de referencia para los porcentajes: el precio guardado si es válido
 * y, si no, el precio sugerido.
 */
function recipePriceBasis(
  recipe: Recipe,
  article: ArticleListItem | null,
  taxRate: string
): number | null {
  const price = recipePrice(article)
  if (price !== null && price > 0) return price

  const suggested = recipeSuggestedPrice(recipe, taxRate)
  return suggested !== null && suggested > 0 ? suggested : null
}

/** Precio sin IVA usado para costo % y margen. */
function recipeNetPriceBasis(
  recipe: Recipe,
  article: ArticleListItem | null,
  taxRate: string
): number | null {
  return priceWithoutTax(recipePriceBasis(recipe, article, taxRate), taxRate)
}

/** Margen en dinero: precio sin IVA menos costo. */
function recipeMargin(
  recipe: Recipe,
  article: ArticleListItem | null,
  taxRate: string
): number | null {
  const price = recipeNetPriceBasis(recipe, article, taxRate)
  const cost = recipeCost(recipe)
  if (price === null || cost === null) return null
  return price - cost
}

/**
 * Orden del nombre: primero las recetas activas y, dentro de cada grupo,
 * alfabético. Así, al desactivar una receta, cae al final de la tabla.
 */
const sortRecipesByName: SortFn<DataTableFeatures, Recipe> = (rowA, rowB) => {
  if (rowA.original.isActive !== rowB.original.isActive) {
    return rowA.original.isActive ? -1 : 1
  }

  return rowA.original.name.localeCompare(rowB.original.name, "es", {
    sensitivity: "base",
  })
}

/**
 * Definición de columnas de la tabla de recetas.
 *
 * Selección · Receta · Precio/Precio sugerido · Costo $/Costo % ·
 * Margen $/Margen % · Categoría · Ingredientes · Acciones.
 */
export function createRecipeColumns(
  actions: RecipeRowActions,
  options: { selectable: boolean; articles: ArticleListItem[]; taxRate: string }
) {
  const articleById = new Map<string, ArticleListItem>()
  const articleByCatalogEntry = new Map<string, ArticleListItem>()

  for (const article of options.articles) {
    articleById.set(article.id, article)
    if (article.catalogEntryId) {
      articleByCatalogEntry.set(article.catalogEntryId, article)
    }
  }

  const articleForRecipe = (recipe: Recipe): ArticleListItem | null => {
    if (recipe.itemId) return articleById.get(recipe.itemId) ?? null
    if (recipe.catalogEntryId) {
      return articleByCatalogEntry.get(recipe.catalogEntryId) ?? null
    }
    return null
  }

  const taxRateFor = (recipe: Recipe) =>
    articleForRecipe(recipe)?.taxRate ?? options.taxRate

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
        <RecipeColumnHeader title="Receta" column={column} />
      ),
      cell: ({ row }) => {
        const article = articleForRecipe(row.original)

        return (
          <div className="flex items-center gap-1.5">
            <span className="font-medium whitespace-nowrap">
              {row.original.name}
            </span>
            {article ? (
              <PresentationPreview
                price={article.price}
                variants={article.variants}
                compact
              />
            ) : null}
            <ComboBadge
              combos={article?.componentOf ?? []}
              onEditCombo={actions.onEditCombo}
            />
            {row.original.itemId ? (
              <Badge
                variant="outline"
                title="Publicada como artículo"
                aria-label="Publicada como artículo"
                className="h-5 border-primary/90 bg-primary/5 px-2 py-0.5 text-primary/90 dark:border-chart-1/90 dark:bg-primary/10 dark:text-chart-1"
              >
                <SoupIcon />
              </Badge>
            ) : null}
            {row.original.producesIngredient ? (
              <Badge variant="secondary">
                <PackageIcon data-icon="inline-start" />
                Insumo
              </Badge>
            ) : null}
            {row.original.isActive ? null : (
              <Badge
                variant="outline"
                className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400"
              >
                Inactiva
              </Badge>
            )}
          </div>
        )
      },
      sortFn: sortRecipesByName,
    }),

    columnHelper.accessor(
      (recipe) => {
        const price = recipePrice(articleForRecipe(recipe))
        return price !== null && price > 0
          ? price
          : recipeSuggestedPrice(recipe, taxRateFor(recipe))
      },
      {
        id: "price",
        header: ({ column }) => (
          <RecipeColumnHeader
            title="Precio/Sugerido"
            column={column}
            align="right"
            hint="Precio guardado del producto; si aún no tiene precio, el sugerido con margen bruto del 65 % e IVA incluido."
          />
        ),
        cell: ({ row }) => {
          const price = recipePrice(articleForRecipe(row.original))
          const hasPrice = price !== null && price > 0
          const suggested = recipeSuggestedPrice(
            row.original,
            taxRateFor(row.original)
          )

          return (
            <div
              className="flex items-baseline justify-end gap-1 whitespace-nowrap tabular-nums"
              title="Precio/Sugerido"
            >
              <span
                className={cn(
                  "font-medium",
                  !hasPrice && "text-muted-foreground"
                )}
              >
                {hasPrice ? formatMoney(price) : "—"}
              </span>
              <span className="text-muted-foreground">/</span>
              <span
                className={cn(
                  "text-muted-foreground",
                  !hasPrice && suggested !== null && "font-medium text-foreground"
                )}
              >
                {suggested === null ? "—" : formatMoney(suggested)}
              </span>
            </div>
          )
        },
        sortFn: "basic",
      }
    ),

    columnHelper.accessor(
      (recipe) => {
        const cost = recipeCost(recipe)
        if (cost === null) return null
        const netPrice = recipeNetPriceBasis(
          recipe,
          articleForRecipe(recipe),
          taxRateFor(recipe)
        )
        return netPrice !== null && netPrice > 0 ? cost / netPrice : null
      },
      {
        id: "cost",
        header: ({ column }) => (
          <RecipeColumnHeader
            title="Costo ($/%)"
            column={column}
            align="right"
            hint="Costo estimado del producto y su porcentaje sobre el precio sin IVA."
          />
        ),
        cell: ({ row }) => {
          const cost = recipeCost(row.original)
          if (cost === null) {
            return <span className="block text-right">—</span>
          }

          const netPrice = recipeNetPriceBasis(
            row.original,
            articleForRecipe(row.original),
            taxRateFor(row.original)
          )
          const share =
            netPrice !== null && netPrice > 0 ? cost / netPrice : null

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
      (recipe) => {
        const article = articleForRecipe(recipe)
        const margin = recipeMargin(recipe, article, taxRateFor(recipe))
        const netPrice = recipeNetPriceBasis(
          recipe,
          article,
          taxRateFor(recipe)
        )
        if (margin === null || netPrice === null || netPrice <= 0) return null
        return margin / netPrice
      },
      {
        id: "margin",
        header: ({ column }) => (
          <RecipeColumnHeader
            title="Margen ($/%)"
            column={column}
            align="right"
            hint="Diferencia entre el precio sin IVA y el costo, y su margen bruto sobre el precio sin IVA."
          />
        ),
        cell: ({ row }) => {
          const margin = recipeMargin(
            row.original,
            articleForRecipe(row.original),
            taxRateFor(row.original)
          )
          const netPrice = recipeNetPriceBasis(
            row.original,
            articleForRecipe(row.original),
            taxRateFor(row.original)
          )

          if (margin === null || netPrice === null || netPrice <= 0) {
            return <span className="block text-right">—</span>
          }

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

    columnHelper.accessor(
      (recipe) =>
        recipe.category?.name ??
        recipe.producesIngredient?.category?.name ??
        "",
      {
        id: "category",
        header: ({ column }) => (
          <RecipeColumnHeader title="Categoría" column={column} />
        ),
        cell: ({ row }) => {
          const category = row.original.category?.name

          return (
            <Badge
              variant="secondary"
              title={
                category ??
                row.original.producesIngredient?.category?.name ??
                "Sin categoría"
              }
            >
              {category ??
                row.original.producesIngredient?.category?.name ??
                "Sin categoría"}
            </Badge>
          )
        },
        enableSorting: false,
      }
    ),

    columnHelper.accessor((recipe) => recipe.ingredients.length, {
      id: "ingredients",
      header: ({ column }) => (
        <RecipeColumnHeader
          title="Ingredientes"
          column={column}
          align="right"
          hint="Insumos de la receta; las opciones y presentaciones se cuentan aparte."
          icon={<BeefIcon className="size-4" />}
        />
      ),
      cell: ({ row }) => (
        <div className="flex items-center justify-end">
          <IngredientsPreview recipe={row.original} />
        </div>
      ),
      enableSorting: false,
    }),

    columnHelper.accessor(
      (recipe) => articleForRecipe(recipe)?.menus?.length ?? 0,
      {
        id: "menu",
        header: ({ column }) => (
          <RecipeColumnHeader
            title="Menú"
            column={column}
            align="right"
            hint="Menús donde se usa el artículo de la receta."
            icon={<NotebookTextIcon className="size-4" />}
          />
        ),
        cell: ({ row }) => (
          <div className="flex items-center justify-end">
            <MenusCountBadge
              count={articleForRecipe(row.original)?.menus?.length ?? 0}
            />
          </div>
        ),
        enableSorting: false,
      }
    ),

    columnHelper.display({
      id: "actions",
      header: () => <span className="sr-only">Acciones</span>,
      cell: ({ row }) => (
        <div
          className="flex items-center justify-center"
          onClick={(event) => event.stopPropagation()}
        >
          <RecipeActionsMenu recipe={row.original} actions={actions} />
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
      enableGlobalFilter: false,
    }),
  ])
}

export const RECIPE_COLUMN_LABELS: Record<string, string> = {
  select: "Selección",
  name: "Receta",
  price: "Precio/Sugerido",
  cost: "Costo ($/%)",
  margin: "Margen ($/%)",
  category: "Categoría",
  ingredients: "Ingredientes",
  menu: "Menú",
}
