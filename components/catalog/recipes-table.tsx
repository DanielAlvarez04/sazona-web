"use client"

import * as React from "react"
import {
  FlaskConicalIcon,
  PencilIcon,
  PlayIcon,
  PlusIcon,
  TagsIcon,
  Trash2Icon,
  Undo2Icon,
  UploadIcon,
  XIcon,
} from "lucide-react"
import type { RowSelectionState } from "@tanstack/react-table"

import {
  DataTable,
  DATA_TABLE_ALL,
  type DataTableFilter,
} from "@/components/data-table/data-table"
import { Button } from "@/components/ui/button"
import {
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuGroupLabel,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu"
import type { Category, Recipe } from "@/lib/catalog"

import {
  RECIPE_COLUMN_LABELS,
  createRecipeColumns,
} from "./recipes-columns"

export function RecipesTable({
  recipes,
  categories,
  canManage,
  onCreate,
  onEdit,
  onPublish,
  onUnpublish,
  onProduce,
  onToggleActive,
  onDelete,
  onManageCategories,
}: {
  recipes: Recipe[]
  categories: Category[]
  canManage: boolean
  onCreate: () => void
  onEdit: (recipe: Recipe) => void
  onPublish: (recipe: Recipe) => void
  onUnpublish: (recipe: Recipe) => void
  onProduce: (recipe: Recipe) => void
  onToggleActive: (recipe: Recipe) => void
  onDelete: (recipe: Recipe) => void
  onManageCategories: () => void
}) {
  const [globalFilter, setGlobalFilter] = React.useState("")
  const [categoryFilter, setCategoryFilter] =
    React.useState<string>(DATA_TABLE_ALL)
  const [publication, setPublication] = React.useState<string>(DATA_TABLE_ALL)
  const [produces, setProduces] = React.useState<string>(DATA_TABLE_ALL)
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})

  const filtered = React.useMemo(() => {
    const term = globalFilter.trim().toLowerCase()

    return recipes.filter((recipe) => {
      if (term && !recipe.name.toLowerCase().includes(term)) return false
      if (
        categoryFilter !== DATA_TABLE_ALL &&
        recipe.categoryId !== categoryFilter
      ) {
        return false
      }
      if (publication === "published" && !recipe.itemId) return false
      if (publication === "standalone" && recipe.itemId) return false
      if (produces === "yes" && !recipe.producesIngredient) return false
      if (produces === "no" && recipe.producesIngredient) return false
      return true
    })
  }, [recipes, globalFilter, categoryFilter, publication, produces])

  const selected = React.useMemo(
    () => filtered.filter((recipe) => rowSelection[recipe.id]),
    [filtered, rowSelection]
  )

  const filters: DataTableFilter[] = []

  if (categories.length > 0) {
    filters.push({
      id: "category",
      ariaLabel: "Filtrar por categoría",
      placeholder: "Categoría",
      allLabel: "Todas las categorías",
      value: categoryFilter,
      onValueChange: setCategoryFilter,
      options: [
        { value: DATA_TABLE_ALL, label: "Todas las categorías" },
        ...categories.map((category) => ({
          value: category.id,
          label: category.name,
        })),
      ],
    })
  }

  filters.push(
    {
      id: "publication",
      ariaLabel: "Filtrar por publicación",
      placeholder: "Publicación",
      allLabel: "Todas",
      value: publication,
      onValueChange: setPublication,
      options: [
        { value: DATA_TABLE_ALL, label: "Todas" },
        { value: "published", label: "Publicadas como artículo" },
        { value: "standalone", label: "Solo receta" },
      ],
    },
    {
      id: "produces",
      ariaLabel: "Filtrar por insumo producido",
      placeholder: "Produce insumo",
      allLabel: "Todas",
      value: produces,
      onValueChange: setProduces,
      options: [
        { value: DATA_TABLE_ALL, label: "Todas" },
        { value: "yes", label: "Producen insumo" },
        { value: "no", label: "No producen insumo" },
      ],
    }
  )

  const activeFilterCount =
    (globalFilter.trim() ? 1 : 0) +
    (categoryFilter !== DATA_TABLE_ALL ? 1 : 0) +
    (publication !== DATA_TABLE_ALL ? 1 : 0) +
    (produces !== DATA_TABLE_ALL ? 1 : 0)

  const clearFilters = React.useCallback(() => {
    setGlobalFilter("")
    setCategoryFilter(DATA_TABLE_ALL)
    setPublication(DATA_TABLE_ALL)
    setProduces(DATA_TABLE_ALL)
  }, [])

  const columns = React.useMemo(
    () =>
      createRecipeColumns(
        {
          onEdit,
          onPublish,
          onUnpublish,
          onProduce,
          onToggleActive,
          onDelete,
          canManage,
          isPending: () => false,
        },
        { selectable: canManage }
      ),
    [onEdit, onPublish, onUnpublish, onProduce, onToggleActive, onDelete, canManage]
  )

  return (
    <DataTable
      idPrefix="recipes"
      data={filtered}
      columns={columns}
      getRowId={(recipe) => recipe.id}
      pageResetKey={`${globalFilter}|${categoryFilter}|${publication}|${produces}`}
      rowSelection={rowSelection}
      onRowSelectionChange={setRowSelection}
      enableRowSelection={canManage}
      tableClassName="[&_td]:py-1.5"
      initialSorting={[{ id: "name", desc: false }]}
      search={{
        label: "Buscar receta",
        placeholder: "Buscar por nombre...",
        value: globalFilter,
        onValueChange: setGlobalFilter,
      }}
      filters={filters}
      activeFilterCount={activeFilterCount}
      onClearFilters={clearFilters}
      showColumnToggle={canManage}
      columnLabels={RECIPE_COLUMN_LABELS}
      actions={
        canManage ? (
          <>
            <Button variant="outline" onClick={onManageCategories}>
              <TagsIcon className="size-4" />
              Categorías
            </Button>
            <Button onClick={onCreate}>
              <PlusIcon className="size-4" />
              Nueva receta
            </Button>
          </>
        ) : null
      }
      rowContextMenu={(recipe) => (
        <ContextMenuContent align="end">
          <ContextMenuGroup>
            <ContextMenuGroupLabel>Acciones</ContextMenuGroupLabel>
            <ContextMenuItem onClick={() => onEdit(recipe)}>
              <PencilIcon />
              Editar receta
            </ContextMenuItem>
            {recipe.producesIngredient ? (
              <ContextMenuItem onClick={() => onProduce(recipe)}>
                <PlayIcon />
                Producir lote
              </ContextMenuItem>
            ) : null}
            {recipe.itemId ? (
              <ContextMenuItem onClick={() => onUnpublish(recipe)}>
                <Undo2Icon />
                Quitar artículo
              </ContextMenuItem>
            ) : (
              <ContextMenuItem onClick={() => onPublish(recipe)}>
                <UploadIcon />
                Publicar como artículo
              </ContextMenuItem>
            )}
          </ContextMenuGroup>
          {canManage ? (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem
                variant="destructive"
                onClick={() => onDelete(recipe)}
              >
                <Trash2Icon />
                Eliminar
              </ContextMenuItem>
            </>
          ) : null}
        </ContextMenuContent>
      )}
      emptyState={
        <div className="flex flex-col items-center gap-1 text-muted-foreground">
          <FlaskConicalIcon className="size-6" />
          <p>Todavía no hay recetas. Crea la primera para empezar.</p>
        </div>
      }
      filteredEmptyState={
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <FlaskConicalIcon className="size-6" />
          <p>No hay recetas que coincidan con los filtros.</p>
          <Button variant="outline" size="sm" onClick={clearFilters}>
            <XIcon className="size-4" />
            Limpiar filtros
          </Button>
        </div>
      }
      summary={
        <>
          {filtered.length} receta{filtered.length === 1 ? "" : "s"}
          {selected.length > 0 ? ` · ${selected.length} seleccionada(s)` : ""}
          {activeFilterCount > 0 ? " (filtradas)" : ""}.
        </>
      }
    />
  )
}
