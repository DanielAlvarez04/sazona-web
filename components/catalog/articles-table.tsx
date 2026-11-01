"use client"

import * as React from "react"
import {
  EllipsisVerticalIcon,
  PackageOpenIcon,
  PencilIcon,
  PlusIcon,
  PowerIcon,
  TagsIcon,
  Trash2Icon,
  UploadIcon,
  XIcon,
} from "lucide-react"
import type { RowSelectionState } from "@tanstack/react-table"

import {
  DataTable,
  DATA_TABLE_ALL,
  type DataTableFilter,
  type DataTableViewMode,
} from "@/components/data-table/data-table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuGroupLabel,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { ArticleListItem, Category } from "@/lib/catalog"

import { ArticleCards, ArticleCardsFull } from "./article-cards"
import {
  ARTICLE_COLUMN_LABELS,
  createArticleColumns,
  type ArticleRowActions,
} from "./articles-columns"

/** Acción que requiere confirmación en un alert dialog. */
type PendingAction =
  | { kind: "deactivate"; articles: ArticleListItem[] }
  | { kind: "delete"; articles: ArticleListItem[] }

export function ArticlesTable({
  articles,
  categories,
  canManage,
  onCreate,
  onEdit,
  onActivate,
  onDeactivate,
  onDelete,
  onManageCategories,
  onImportCsv,
}: {
  articles: ArticleListItem[]
  categories: Category[]
  canManage: boolean
  onCreate: () => void
  onEdit: (article: ArticleListItem) => void
  onActivate: (article: ArticleListItem) => Promise<boolean>
  onDeactivate: (article: ArticleListItem) => Promise<boolean>
  onDelete: (articles: ArticleListItem[]) => Promise<boolean>
  onManageCategories: () => void
  onImportCsv: () => void
}) {
  const [globalFilter, setGlobalFilter] = React.useState("")
  const [categoryFilter, setCategoryFilter] =
    React.useState<string>(DATA_TABLE_ALL)
  const [recipeFilter, setRecipeFilter] = React.useState<string>(DATA_TABLE_ALL)
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})
  const [viewMode, setViewMode] = React.useState<DataTableViewMode>("cards")
  const [pendingAction, setPendingAction] = React.useState<PendingAction | null>(
    null
  )
  const [busy, setBusy] = React.useState(false)

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

  const selectedArticles = React.useMemo(
    () => filtered.filter((article) => rowSelection[article.id]),
    [filtered, rowSelection]
  )
  const selectedCount = selectedArticles.length

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

  const requestDeactivate = React.useCallback((article: ArticleListItem) => {
    setPendingAction({ kind: "deactivate", articles: [article] })
  }, [])

  const requestDelete = React.useCallback((article: ArticleListItem) => {
    setPendingAction({ kind: "delete", articles: [article] })
  }, [])

  const setCardSelected = React.useCallback(
    (id: string, selected: boolean) => {
      setRowSelection((prev) => {
        const next = { ...prev }
        if (selected) next[id] = true
        else delete next[id]
        return next
      })
    },
    []
  )

  const actions = React.useMemo<ArticleRowActions>(
    () => ({
      onEdit,
      onActivate,
      onDeactivate: requestDeactivate,
      onDelete: requestDelete,
      canManage,
      isPending: () => busy,
    }),
    [onEdit, onActivate, requestDeactivate, requestDelete, canManage, busy]
  )

  const columns = React.useMemo(
    () => createArticleColumns(actions, { selectable: canManage }),
    [actions, canManage]
  )

  async function confirmPendingAction() {
    if (!pendingAction) return

    setBusy(true)
    const ok =
      pendingAction.kind === "deactivate"
        ? await onDeactivate(pendingAction.articles[0])
        : await onDelete(pendingAction.articles)
    setBusy(false)

    if (ok) {
      setPendingAction(null)
      setRowSelection({})
    }
  }

  const singleArticle =
    pendingAction && pendingAction.articles.length === 1
      ? pendingAction.articles[0]
      : null
  const actionCount = pendingAction?.articles.length ?? 0

  return (
    <>
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
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        cardsView={(rows) => (
          <ArticleCards
            articles={rows}
            actions={actions}
            canSelect={canManage}
            selectedIds={rowSelection}
            onSelectedChange={setCardSelected}
          />
        )}
        cardsFullView={(rows) => (
          <ArticleCardsFull
            articles={rows}
            actions={actions}
            canSelect={canManage}
            selectedIds={rowSelection}
            onSelectedChange={setCardSelected}
          />
        )}
        actions={
          canManage ? (
            <>
              {selectedCount > 0 ? (
                <Button
                  variant="destructive"
                  onClick={() =>
                    setPendingAction({
                      kind: "delete",
                      articles: selectedArticles,
                    })
                  }
                  disabled={busy}
                >
                  <Trash2Icon />
                  {busy
                    ? "Eliminando…"
                    : `Eliminar seleccionados (${selectedCount})`}
                </Button>
              ) : null}

              <Button onClick={onCreate}>
                <PlusIcon className="size-4" />
                Nuevo artículo
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger
                  render={<Button variant="outline" size="icon" />}
                >
                  <EllipsisVerticalIcon className="size-4" />
                  <span className="sr-only">Más acciones</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={onManageCategories}
                    className="flex items-center gap-2"
                  >
                    <TagsIcon className="size-4" />
                    Categorías
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={onImportCsv}
                    className="flex items-center gap-2"
                  >
                    <UploadIcon className="size-4" />
                    Importar CSV
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : null
        }
        rowContextMenu={(article) => (
          <ContextMenuContent align="end">
            <ContextMenuGroup>
              <ContextMenuGroupLabel>Acciones</ContextMenuGroupLabel>
              <ContextMenuItem onClick={() => onEdit(article)}>
                <PencilIcon />
                Editar artículo
              </ContextMenuItem>
              {canManage ? (
                article.isActive ? (
                  <ContextMenuItem
                    className="text-amber-600 focus:bg-amber-500/10 focus:text-amber-600 dark:text-amber-400 dark:focus:text-amber-400"
                    onClick={() => requestDeactivate(article)}
                  >
                    <PowerIcon />
                    Desactivar
                  </ContextMenuItem>
                ) : (
                  <ContextMenuItem
                    className="text-emerald-600 focus:bg-emerald-500/10 focus:text-emerald-600 dark:text-emerald-400 dark:focus:text-emerald-400"
                    onClick={() => onActivate(article)}
                  >
                    <PowerIcon />
                    Activar
                  </ContextMenuItem>
                )
              ) : null}
            </ContextMenuGroup>
            {canManage ? (
              <>
                <ContextMenuSeparator />
                <ContextMenuGroup>
                  <ContextMenuItem
                    variant="destructive"
                    onClick={() => requestDelete(article)}
                  >
                    <Trash2Icon />
                    Eliminar
                  </ContextMenuItem>
                </ContextMenuGroup>
              </>
            ) : null}
          </ContextMenuContent>
        )}
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
            {selectedCount > 0 ? ` · ${selectedCount} seleccionado(s)` : ""}
            {activeFilterCount > 0 ? " (filtrados)" : ""}.
          </>
        }
      />

      <AlertDialog
        open={pendingAction !== null}
        onOpenChange={(open) => {
          if (!open) setPendingAction(null)
        }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive">
              {pendingAction?.kind === "delete" ? (
                <Trash2Icon />
              ) : (
                <PowerIcon />
              )}
            </AlertDialogMedia>
            <AlertDialogTitle>
              {pendingAction?.kind === "delete"
                ? actionCount > 1
                  ? `¿Eliminar ${actionCount} artículos?`
                  : "¿Eliminar este artículo?"
                : "¿Desactivar este artículo?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction?.kind === "delete" ? (
                <>
                  {singleArticle
                    ? `«${singleArticle.name}» se eliminará definitivamente. Ya no podrá usarse en los menús y se retirará de los menús donde se usaba.`
                    : `Se eliminarán definitivamente ${actionCount} artículos. Ya no podrán usarse en los menús y se retirarán de los menús donde se usaban.`}{" "}
                  Esta acción no se puede deshacer. Los artículos que aparecen en
                  pedidos no se pueden eliminar; desactívalos para ocultarlos.
                </>
              ) : (
                <>
                  {singleArticle ? `«${singleArticle.name}»` : "El artículo"}{" "}
                  dejará de ser utilizable en los menús y se ocultará de los
                  menús donde se usaba. La información de esos menús no se
                  modifica: solo dejan de tomarlo en cuenta. Puedes activarlo de
                  nuevo cuando quieras.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => void confirmPendingAction()}
              disabled={busy}
            >
              {busy
                ? pendingAction?.kind === "delete"
                  ? "Eliminando…"
                  : "Desactivando…"
                : pendingAction?.kind === "delete"
                  ? "Eliminar"
                  : "Desactivar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
