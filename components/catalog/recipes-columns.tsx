"use client"

import { createColumnHelper } from "@tanstack/react-table"
import {
  ChevronDownIcon,
  ChevronsUpDownIcon,
  ChevronUpIcon,
  EllipsisVerticalIcon,
  FlaskConicalIcon,
  PencilIcon,
  PlayIcon,
  Trash2Icon,
  Undo2Icon,
  UploadIcon,
} from "lucide-react"

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
import { formatMoney, formatQuantity, type Recipe } from "@/lib/catalog"

import type { DataTableFeatures } from "@/components/data-table/data-table-features"

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
}: {
  title: string
  column: SortableColumn
  align?: "left" | "right"
}) {
  const sorted = column.getIsSorted()

  if (!column.getCanSort()) {
    return (
      <span className={`font-medium ${align === "right" ? "block text-right" : ""}`}>
        {title}
      </span>
    )
  }

  return (
    <div className={align === "right" ? "flex justify-end" : undefined}>
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

export interface RecipeRowActions {
  onEdit: (recipe: Recipe) => void
  onPublish: (recipe: Recipe) => void
  onUnpublish: (recipe: Recipe) => void
  onProduce: (recipe: Recipe) => void
  onToggleActive: (recipe: Recipe) => void
  onDelete: (recipe: Recipe) => void
  canManage: boolean
  isPending: (recipe: Recipe) => boolean
}

function RecipeActionsMenu({
  recipe,
  actions,
}: {
  recipe: Recipe
  actions: RecipeRowActions
}) {
  const pending = actions.isPending(recipe)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon-sm" />}
        disabled={pending}
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
          ) : (
            <DropdownMenuItem onClick={() => actions.onPublish(recipe)}>
              <UploadIcon />
              Publicar como artículo
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => actions.onToggleActive(recipe)}>
            {recipe.isActive ? "Desactivar" : "Activar"}
          </DropdownMenuItem>
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

export function createRecipeColumns(
  actions: RecipeRowActions,
  options: { selectable: boolean }
) {
  return columnHelper.columns([
    ...(options.selectable
      ? [
          columnHelper.display({
            id: "select",
            header: ({ table }) => (
              <Checkbox
                aria-label="Seleccionar todas las recetas"
                checked={table.getIsAllPageRowsSelected()}
                indeterminate={table.getIsSomePageRowsSelected()}
                onCheckedChange={(checked) =>
                  table.toggleAllPageRowsSelected(checked === true)
                }
              />
            ),
            cell: ({ row }) => (
              <Checkbox
                aria-label={`Seleccionar ${row.original.name}`}
                checked={row.getIsSelected()}
                onCheckedChange={(checked) =>
                  row.toggleSelected(checked === true)
                }
              />
            ),
            enableSorting: false,
          }),
        ]
      : []),

    columnHelper.accessor("name", {
      id: "name",
      header: ({ column }) => (
        <RecipeColumnHeader title="Receta" column={column} />
      ),
      cell: ({ row }) => (
        <div className="flex flex-col gap-1">
          <button
            type="button"
            className="text-left font-medium hover:underline"
            onClick={() => actions.onEdit(row.original)}
          >
            {row.original.name}
          </button>
          <div className="flex flex-wrap gap-1">
            {row.original.itemId ? (
              <Badge variant="secondary">Artículo</Badge>
            ) : (
              <Badge variant="outline">Solo receta</Badge>
            )}
            {row.original.producesIngredient ? (
              <Badge variant="secondary">
                <FlaskConicalIcon data-icon="inline-start" />
                Insumo
              </Badge>
            ) : null}
            {row.original.estimatedCost === null ? (
              <Badge variant="outline">Sin costo</Badge>
            ) : null}
          </div>
        </div>
      ),
    }),

    columnHelper.accessor(
      (recipe) => recipe.category?.name ?? "Sin categoría",
      {
        id: "category",
        header: ({ column }) => (
          <RecipeColumnHeader title="Categoría" column={column} />
        ),
        cell: ({ getValue }) => (
          <span className="text-muted-foreground">{getValue()}</span>
        ),
      }
    ),

    columnHelper.accessor((recipe) => recipe.ingredients.length, {
      id: "ingredients",
      header: ({ column }) => (
        <RecipeColumnHeader title="Ingredientes" column={column} align="right" />
      ),
      cell: ({ getValue }) => (
        <span className="block text-right tabular-nums">{getValue()}</span>
      ),
    }),

    columnHelper.accessor(
      (recipe) =>
        recipe.estimatedCost === null ? null : Number(recipe.estimatedCost),
      {
        id: "cost",
        header: ({ column }) => (
          <RecipeColumnHeader title="Costo" column={column} align="right" />
        ),
        cell: ({ getValue }) => {
          const value = getValue()
          return (
            <span className="block text-right tabular-nums">
              {value === null ? "—" : formatMoney(value)}
            </span>
          )
        },
      }
    ),

    columnHelper.accessor(
      (recipe) => (recipe.item ? Number(recipe.item.price) : null),
      {
        id: "price",
        header: ({ column }) => (
          <RecipeColumnHeader title="Precio" column={column} align="right" />
        ),
        cell: ({ getValue }) => {
          const value = getValue()
          return (
            <span className="block text-right tabular-nums">
              {value === null ? "—" : formatMoney(value)}
            </span>
          )
        },
      }
    ),

    columnHelper.accessor((recipe) => recipe.isActive, {
      id: "status",
      header: ({ column }) => (
        <RecipeColumnHeader title="Estado" column={column} />
      ),
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {row.original.isActive ? (
            <Badge variant="secondary">Activa</Badge>
          ) : (
            <Badge variant="outline">Inactiva</Badge>
          )}
          {row.original.yieldQuantity ? (
            <Badge variant="outline">
              Rinde {formatQuantity(row.original.yieldQuantity)}
            </Badge>
          ) : null}
        </div>
      ),
    }),

    columnHelper.display({
      id: "actions",
      header: () => <span className="sr-only">Acciones</span>,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <RecipeActionsMenu recipe={row.original} actions={actions} />
        </div>
      ),
      enableSorting: false,
    }),
  ])
}

export const RECIPE_COLUMN_LABELS: Record<string, string> = {
  name: "Receta",
  category: "Categoría",
  ingredients: "Ingredientes",
  cost: "Costo",
  price: "Precio",
  status: "Estado",
}
