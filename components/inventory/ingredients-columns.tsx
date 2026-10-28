"use client"

import { createColumnHelper } from "@tanstack/react-table"
import {
  BookOpenIcon,
  ChevronDownIcon,
  ChevronsUpDownIcon,
  ChevronUpIcon,
  EllipsisVerticalIcon,
  MinusIcon,
  PlusIcon,
  PencilIcon,
  TrendingDownIcon,
  TriangleAlertIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  formatMoney,
  formatQuantity,
  unitLabel,
  type Ingredient,
} from "@/lib/catalog"

import type { InventoryTableFeatures } from "./data-table-features"

const columnHelper = createColumnHelper<InventoryTableFeatures, Ingredient>()

/** Interfaz mínima de columna que necesitan los headers ordenables. */
interface SortableColumn {
  getCanSort: () => boolean
  getIsSorted: () => false | "asc" | "desc"
  getToggleSortingHandler: () => ((event: unknown) => void) | undefined
}

function IngredientColumnHeader({
  title,
  column,
  align = "left",
}: {
  title: string
  column: SortableColumn
  align?: "left" | "right"
}) {
  const wrapper = align === "right" ? "flex justify-end" : undefined

  if (!column.getCanSort()) {
    return (
      <span className={`font-medium ${align === "right" ? "block text-right" : ""}`}>
        {title}
      </span>
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

export interface IngredientRowActions {
  onEdit: (ingredient: Ingredient) => void
  onToggleActive: (ingredient: Ingredient) => void
  onAddStock: (ingredient: Ingredient) => void
  onSubtractStock: (ingredient: Ingredient) => void
  /** Hay una mutación en curso para ese insumo (desactiva el menú). */
  isPending: (ingredient: Ingredient) => boolean
}

function IngredientRowActionsMenu({
  ingredient,
  onEdit,
  onToggleActive,
  onAddStock,
  onSubtractStock,
  isPending,
}: IngredientRowActions & { ingredient: Ingredient }) {
  const pending = isPending(ingredient)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground aria-expanded:bg-muted"
            disabled={pending}
            aria-label={`Acciones de ${ingredient.name}`}
          />
        }
      >
        <EllipsisVerticalIcon />
        <span className="sr-only">Abrir menú</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Acciones</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => onAddStock(ingredient)}>
            <PlusIcon />
            Añadir stock
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onSubtractStock(ingredient)}>
            <MinusIcon />
            Restar stock
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onEdit(ingredient)}>
            <PencilIcon />
            Editar
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Etiquetas legibles para el selector de columnas. */
export const INGREDIENT_COLUMN_LABELS: Record<string, string> = {
  sku: "SKU",
  name: "Insumo",
  stock: "Stock / mínimo",
  unitCost: "Costo unitario",
  maxStock: "Stock máximo",
  category: "Categoría",
  location: "Ubicación",
  recipes: "Recetas",
}

/**
 * Definición de columnas de la tabla de insumos.
 *
 * Orden: SKU · Insumo · Stock/mínimo · Costo · Máximo · Clasificación · Acciones
 *
 * Categoría, ubicación y número de recetas comparten una sola columna con un
 * `BadgeGroup` para que la tabla sea más angosta.
 */
export function createIngredientColumns(actions: IngredientRowActions) {
  return columnHelper.columns([
    columnHelper.accessor((row) => row.sku ?? "", {
      id: "sku",
      header: ({ column }) => (
        <IngredientColumnHeader title="SKU" column={column} />
      ),
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-muted-foreground">
          {row.original.sku ?? "—"}
        </span>
      ),
      enableSorting: false,
    }),
    columnHelper.accessor("name", {
      header: ({ column }) => (
        <IngredientColumnHeader title="Insumo" column={column} />
      ),
      cell: ({ row }) => {
        const outOfStock = Number(row.original.currentStock) === 0

        return (
          <div className="flex items-center gap-2 font-medium">
            {row.original.isLowStock ? (
              outOfStock ? (
                <TriangleAlertIcon
                  className="size-4 shrink-0 text-destructive"
                  aria-label="Sin stock"
                />
              ) : (
                <TrendingDownIcon
                  className="size-4 shrink-0 text-destructive"
                  aria-label="Stock bajo mínimo"
                />
              )
            ) : null}
            <span className="whitespace-nowrap">{row.original.name}</span>
          </div>
        )
      },
      sortFn: "text",
    }),
    columnHelper.accessor((row) => Number(row.currentStock), {
      id: "stock",
      header: ({ column }) => (
        <IngredientColumnHeader title="Stock / mínimo" column={column} align="right" />
      ),
      cell: ({ row }) => {
        const unit = unitLabel(row.original.baseUnit)

        return (
          <div className="flex items-baseline justify-end gap-1 whitespace-nowrap tabular-nums">
            <span
              className={
                row.original.isLowStock
                  ? "font-medium text-destructive"
                  : "font-medium"
              }
            >
              {formatQuantity(row.original.currentStock)} {unit}
            </span>
            <span className="text-muted-foreground">/</span>
            <span className="text-muted-foreground">
              {formatQuantity(row.original.minStock)} {unit}
            </span>
          </div>
        )
      },
      enableSorting: false,
    }),
    columnHelper.accessor(
      (row) => (row.unitCost === null ? null : Number(row.unitCost)),
      {
        id: "unitCost",
        header: ({ column }) => (
          <IngredientColumnHeader title="Costo unitario" column={column} align="right" />
        ),
        cell: ({ row }) =>
          row.original.unitCost === null ? (
            <div className="text-right text-muted-foreground">—</div>
          ) : (
            <div className="text-right whitespace-nowrap tabular-nums">
              {formatMoney(row.original.unitCost)}{" "}
              <span className="text-muted-foreground">
                / {unitLabel(row.original.baseUnit)}
              </span>
            </div>
          ),
        enableSorting: false,
      }
    ),
    columnHelper.accessor(
      (row) => (row.maxStock === null ? null : Number(row.maxStock)),
      {
        id: "maxStock",
        header: ({ column }) => (
          <IngredientColumnHeader title="Stock máximo" column={column} align="right" />
        ),
        cell: ({ row }) =>
          row.original.maxStock === null ? (
            <div className="text-right text-muted-foreground">—</div>
          ) : (
            <div className="text-right whitespace-nowrap tabular-nums">
              {formatQuantity(row.original.maxStock)}{" "}
              <span className="text-muted-foreground">
                {unitLabel(row.original.baseUnit)}
              </span>
            </div>
          ),
        enableSorting: false,
      }
    ),
    columnHelper.accessor((row) => row.category?.name ?? "", {
      id: "category",
      header: ({ column }) => (
        <IngredientColumnHeader title="Categoría" column={column} />
      ),
      cell: ({ row }) => {
        const category = row.original.category?.name
        return (
          <Badge
            variant="secondary"
            className="max-w-36 truncate"
            title={category ?? "Sin categoría"}
          >
            {category ?? "Sin categoría"}
          </Badge>
        )
      },
      enableSorting: false,
    }),
    columnHelper.accessor((row) => row.location?.name ?? "", {
      id: "location",
      header: ({ column }) => (
        <IngredientColumnHeader title="Ubicación" column={column} />
      ),
      cell: ({ row }) => {
        const location = row.original.location?.name
        if (!location) return <span className="text-muted-foreground">—</span>
        return (
          <Badge
            variant="outline"
            className="max-w-32 truncate"
            title={location}
          >
            {location}
          </Badge>
        )
      },
      enableSorting: false,
    }),
    columnHelper.accessor((row) => row._count?.recipeIngredients ?? 0, {
      id: "recipes",
      header: ({ column }) => (
        <IngredientColumnHeader title="Recetas" column={column} align="left" />
      ),
      cell: ({ row }) => {
        const recipes = row.original._count?.recipeIngredients ?? 0
        return (
          <div className="flex items-center justify-center gap-1">
            <BookOpenIcon className="size-4 text-muted-foreground" />
            <span className="font-medium tabular-nums">{recipes}</span>
          </div>
        )
      },
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
          <IngredientRowActionsMenu ingredient={row.original} {...actions} />
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
      enableGlobalFilter: false,
    }),
  ])
}
