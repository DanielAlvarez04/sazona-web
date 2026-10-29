"use client"

import * as React from "react"
import { PackageOpenIcon, PlusIcon, XIcon } from "lucide-react"
import type { RowSelectionState } from "@tanstack/react-table"

import {
  DataTable,
  DATA_TABLE_ALL,
  type DataTableFilter,
} from "@/components/data-table/data-table"
import { Button } from "@/components/ui/button"
import type { ArticleListItem, Category } from "@/lib/catalog"

import {
  ARTICLE_COLUMN_LABELS,
  createArticleColumns,
} from "./articles-columns"

const PAGE_SIZES = [15, 30, 50, 100]
const DEFAULT_PAGE_SIZE = 15

export function ArticlesTable({
  articles,
  categories,
  canManage,
  onCreate,
  onEdit,
  onDeactivate,
}: {
  articles: ArticleListItem[]
  categories: Category[]
  canManage: boolean
  onCreate: () => void
  onEdit: (article: ArticleListItem) => void
  onDeactivate: (article: ArticleListItem) => void
}) {
  const [globalFilter, setGlobalFilter] = React.useState("")
  const [categoryFilter, setCategoryFilter] =
    React.useState<string>(DATA_TABLE_ALL)
  const [recipeFilter, setRecipeFilter] = React.useState<string>(DATA_TABLE_ALL)
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})

  const filtered = React.useMemo(() => {
    const term = globalFilter.trim().toLowerCase()

    return articles.filter((article) => {
      if (term) {
        const matchesName = article.name.toLowerCase().includes(term)
        const matchesSku = article.sku?.toLowerCase().includes(term) ?? false
        if (!matchesName && !matchesSku) return false
      }
      if (
        categoryFilter !== DATA_TABLE_ALL &&
        article.category?.id !== categoryFilter
      ) {
        return false
      }
      const hasRecipe =
        (article.recipes?.length ?? article._count.recipes) > 0
      if (recipeFilter === "yes" && !hasRecipe) return false
      if (recipeFilter === "no" && hasRecipe) return false
      return true
    })
  }, [articles, globalFilter, categoryFilter, recipeFilter])

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

  filters.push({
    id: "recipe",
    ariaLabel: "Filtrar por receta",
    placeholder: "Receta",
    allLabel: "Todos",
    value: recipeFilter,
    onValueChange: setRecipeFilter,
    options: [
      { value: DATA_TABLE_ALL, label: "Todos" },
      { value: "yes", label: "Con receta" },
      { value: "no", label: "Sin receta" },
    ],
  })

  const activeFilterCount =
    (globalFilter.trim() ? 1 : 0) +
    (categoryFilter !== DATA_TABLE_ALL ? 1 : 0) +
    (recipeFilter !== DATA_TABLE_ALL ? 1 : 0)

  const clearFilters = React.useCallback(() => {
    setGlobalFilter("")
    setCategoryFilter(DATA_TABLE_ALL)
    setRecipeFilter(DATA_TABLE_ALL)
  }, [])

  const columns = React.useMemo(
    () =>
      createArticleColumns(
        { onEdit, onDeactivate, canManage, isPending: () => false },
        { selectable: canManage }
      ),
    [onEdit, onDeactivate, canManage]
  )

  return (
    <DataTable
      idPrefix="articles"
      data={filtered}
      columns={columns}
      getRowId={(article) => article.id}
      pageResetKey={`${globalFilter}|${categoryFilter}|${recipeFilter}`}
      rowSelection={rowSelection}
      onRowSelectionChange={setRowSelection}
      enableRowSelection={canManage}
      tableClassName="[&_td]:py-1.5"
      initialSorting={[{ id: "name", desc: false }]}
      search={{
        label: "Buscar artículo",
        placeholder: "Buscar por nombre o SKU...",
        value: globalFilter,
        onValueChange: setGlobalFilter,
      }}
      filters={filters}
      activeFilterCount={activeFilterCount}
      onClearFilters={clearFilters}
      showColumnToggle={canManage}
      columnLabels={ARTICLE_COLUMN_LABELS}
      actions={
        canManage ? (
          <Button onClick={onCreate}>
            <PlusIcon className="size-4" />
            Nuevo artículo
          </Button>
        ) : null
      }
      emptyState={
        <div className="flex flex-col items-center gap-1 text-muted-foreground">
          <PackageOpenIcon className="size-6" />
          <p>
            Todavía no hay artículos. Crea uno o publica una receta como
            artículo.
          </p>
        </div>
      }
      filteredEmptyState={
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <PackageOpenIcon className="size-6" />
          <p>No hay artículos que coincidan con los filtros.</p>
          <Button variant="outline" size="sm" onClick={clearFilters}>
            <XIcon className="size-4" />
            Limpiar filtros
          </Button>
        </div>
      }
      summary={
        <>
          {filtered.length} artículo{filtered.length === 1 ? "" : "s"}
          {activeFilterCount > 0 ? " (filtrados)" : ""}.
        </>
      }
      pageSizeOptions={PAGE_SIZES}
      defaultPageSize={DEFAULT_PAGE_SIZE}
    />
  )
}
