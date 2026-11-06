"use client"

import * as React from "react"
import {
  ChevronDownIcon,
  PencilIcon,
  PlusIcon,
  PowerIcon,
  SoupIcon,
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
import { ButtonGroup } from "@/components/ui/button-group"
import { Checkbox } from "@/components/ui/checkbox"
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
import { Label } from "@/components/ui/label"
import type { ArticleListItem, Category, Recipe } from "@/lib/catalog"
import { ACTIVE_FILTER_OUTLINE, cn } from "@/lib/utils"

import { ArticleCards } from "./article-cards"
import { ArticleGroupSelect } from "./article-group-select"
import {
  ARTICLE_COLUMN_LABELS,
  createArticleColumns,
  type ArticleRowActions,
} from "./articles-columns"
import { ArticlePriceFilter, type PriceRange } from "./article-price-filter"

/** Acción que requiere confirmación en un alert dialog. */
type PendingAction =
  | { kind: "deactivate"; articles: ArticleListItem[] }
  | { kind: "delete"; articles: ArticleListItem[] }

export function ArticlesTable({
  articles,
  recipes = [],
  categories,
  canManage = false,
  viewMode,
  onViewModeChange,
  taxRate = "0",
  onCreate,
  onEdit,
  onActivate,
  onDeactivate,
  onDelete,
  onEditCombo,
  onManageCategories,
  onImportCsv,
  mode = "manage",
  selectedItemIds,
  onSelectedItemIdsChange,
  groupNames,
  groupByItemId,
  onGroupChange,
  disabled = false,
}: {
  articles: ArticleListItem[]
  /** Recetas completas, para calcular costo, margen e ingredientes. */
  recipes?: Recipe[]
  categories: Category[]
  canManage?: boolean
  /** Vista compartida con la tab de Recetas. */
  viewMode: DataTableViewMode
  onViewModeChange: (mode: DataTableViewMode) => void
  /** Tasa de IVA por defecto de la organización (fracción). */
  taxRate?: string
  onCreate?: () => void
  onEdit?: (article: ArticleListItem) => void
  onActivate?: (article: ArticleListItem) => Promise<boolean>
  onDeactivate?: (article: ArticleListItem) => Promise<boolean>
  onDelete?: (articles: ArticleListItem[]) => Promise<boolean>
  /** Abre el combo indicado para editarlo. */
  onEditCombo?: (comboId: string) => void
  onManageCategories?: () => void
  onImportCsv?: () => void
  /**
   * `"select"` convierte la tabla en un selector de artículos para un menú:
   * sin acciones, con columnas mínimas y selección controlada por ids.
   */
  mode?: "manage" | "select"
  /** Modo `select`: ids incluidos, en el orden del menú. */
  selectedItemIds?: string[]
  onSelectedItemIdsChange?: (ids: string[]) => void
  /** Modo `select`: secciones del menú y grupo asignado por artículo. */
  groupNames?: string[]
  groupByItemId?: Record<string, string | null>
  onGroupChange?: (itemId: string, group: string | null) => void
  /** Modo `select`: bloquea la selección mientras se guarda. */
  disabled?: boolean
}) {
  const isSelectMode = mode === "select"
  const [globalFilter, setGlobalFilter] = React.useState("")
  const [categoryFilter, setCategoryFilter] =
    React.useState<string>(DATA_TABLE_ALL)
  const [recipeFilter, setRecipeFilter] = React.useState<string>(DATA_TABLE_ALL)
  const [priceRange, setPriceRange] = React.useState<PriceRange | null>(null)
  const [rowSelectionState, setRowSelectionState] =
    React.useState<RowSelectionState>({})
  const [pendingAction, setPendingAction] = React.useState<PendingAction | null>(
    null
  )
  const [busy, setBusy] = React.useState(false)

  const rowSelection = React.useMemo<RowSelectionState>(
    () =>
      isSelectMode
        ? Object.fromEntries(
            (selectedItemIds ?? []).map((id) => [id, true] as const)
          )
        : rowSelectionState,
    [isSelectMode, selectedItemIds, rowSelectionState]
  )

  /**
   * En Catálogo la selección vive aquí; en el selector de menú se traduce a la
   * lista de ids conservando el orden existente y agregando los nuevos al final.
   */
  const updateSelection = React.useCallback(
    (next: RowSelectionState) => {
      if (!isSelectMode) {
        setRowSelectionState(next)
        return
      }

      const checked = new Set(
        Object.keys(next).filter((id) => Boolean(next[id]))
      )
      const current = selectedItemIds ?? []
      const kept = current.filter((id) => checked.has(id))
      const added = [...checked].filter((id) => !current.includes(id))

      onSelectedItemIdsChange?.([...kept, ...added])
    },
    [isSelectMode, selectedItemIds, onSelectedItemIdsChange]
  )

  /** Precio más bajo y más alto de los artículos existentes, para el slider. */
  const priceBounds = React.useMemo(() => {
    const prices = articles
      .map((article) => Number(article.price))
      .filter((price) => Number.isFinite(price))

    if (prices.length === 0) return null

    const min = Math.floor(Math.min(...prices))
    const max = Math.ceil(Math.max(...prices))

    return max > min ? { min, max } : null
  }, [articles])

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
      if (priceRange) {
        const price = Number(article.price)
        if (price < priceRange[0] || price > priceRange[1]) return false
      }
      return true
    })
  }, [articles, globalFilter, categoryFilter, recipeFilter, priceRange])

  const selectedArticles = React.useMemo(
    () => filtered.filter((article) => rowSelection[article.id]),
    [filtered, rowSelection]
  )
  // En el selector de menú interesa el total incluido, no solo lo filtrado.
  const selectedCount = isSelectMode
    ? (selectedItemIds?.length ?? 0)
    : selectedArticles.length

  // Selección masiva sobre lo filtrado (no solo la página visible).
  const allSelected =
    filtered.length > 0 && filtered.every((article) => rowSelection[article.id])
  const someSelected =
    !allSelected && filtered.some((article) => rowSelection[article.id])

  const toggleAllSelected = React.useCallback(
    (selected: boolean) => {
      const next = { ...rowSelection }

      for (const article of filtered) {
        // Los inactivos no asignados al menú no se pueden agregar.
        if (isSelectMode && selected && !article.isActive) continue

        if (selected) next[article.id] = true
        else delete next[article.id]
      }

      updateSelection(next)
    },
    [filtered, isSelectMode, rowSelection, updateSelection]
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
    (recipeFilter !== DATA_TABLE_ALL ? 1 : 0) +
    (priceRange ? 1 : 0)

  const clearFilters = React.useCallback(() => {
    setGlobalFilter("")
    setCategoryFilter(DATA_TABLE_ALL)
    setRecipeFilter(DATA_TABLE_ALL)
    setPriceRange(null)
  }, [])

  const requestDeactivate = React.useCallback((article: ArticleListItem) => {
    setPendingAction({ kind: "deactivate", articles: [article] })
  }, [])

  const requestDelete = React.useCallback((article: ArticleListItem) => {
    setPendingAction({ kind: "delete", articles: [article] })
  }, [])

  const setCardSelected = React.useCallback(
    (id: string, selected: boolean) => {
      // En el selector del menú los inactivos no se pueden agregar.
      if (isSelectMode && selected) {
        const article = articles.find((candidate) => candidate.id === id)
        if (article && !article.isActive) return
      }

      const next = { ...rowSelection }
      if (selected) next[id] = true
      else delete next[id]
      updateSelection(next)
    },
    [articles, isSelectMode, rowSelection, updateSelection]
  )

  const actions = React.useMemo<ArticleRowActions>(
    () => ({
      onEdit: onEdit ?? (() => {}),
      onActivate: onActivate ?? (async () => false),
      onDeactivate: requestDeactivate,
      onDelete: requestDelete,
      onEditCombo: onEditCombo ?? (() => {}),
      canManage,
      isPending: () => busy,
    }),
    [
      onEdit,
      onActivate,
      requestDeactivate,
      requestDelete,
      onEditCombo,
      canManage,
      busy,
    ]
  )

  const columns = React.useMemo(
    () =>
      createArticleColumns(actions, {
        selectable: canManage || isSelectMode,
        recipes,
        taxRate,
        variant: isSelectMode ? "selection" : "full",
        renderGroup: isSelectMode
          ? (article) => (
              <ArticleGroupSelect
                groups={groupNames ?? []}
                value={groupByItemId?.[article.id] ?? null}
                disabled={
                  disabled || !onGroupChange || !rowSelection[article.id]
                }
                ariaLabel={`Grupo de ${article.name}`}
                onChange={(group) => onGroupChange?.(article.id, group)}
              />
            )
          : undefined,
      }),
    [
      actions,
      canManage,
      isSelectMode,
      recipes,
      taxRate,
      groupNames,
      groupByItemId,
      onGroupChange,
      disabled,
      rowSelection,
    ]
  )

  async function confirmPendingAction() {
    if (!pendingAction) return

    setBusy(true)
    const ok =
      pendingAction.kind === "deactivate"
        ? await onDeactivate?.(pendingAction.articles[0])
        : await onDelete?.(pendingAction.articles)
    setBusy(false)

    if (ok) {
      setPendingAction(null)
      updateSelection({})
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
        pageResetKey={`${globalFilter}|${categoryFilter}|${recipeFilter}|${priceRange?.join("-") ?? ""}`}
        rowSelection={rowSelection}
        onRowSelectionChange={updateSelection}
        enableRowSelection={
          isSelectMode
            ? disabled
              ? false
              : (article) => article.isActive || Boolean(rowSelection[article.id])
            : canManage
        }
        tableClassName="[&_td]:py-1.5"
        initialSorting={[{ id: "name", desc: false }]}
        layout="sidebar"
        filtersHeader={
          priceBounds ? (
            <ArticlePriceFilter
              min={priceBounds.min}
              max={priceBounds.max}
              value={priceRange}
              onChange={setPriceRange}
            />
          ) : null
        }
        search={{
          label: "Buscar artículo",
          placeholder: "Buscar por nombre",
          value: globalFilter,
          onValueChange: setGlobalFilter,
        }}
        selectionToggle={
          canManage || isSelectMode ? (
            <div
              className={cn(
                "flex h-9 items-center gap-2 rounded-md border border-input bg-transparent px-2.5 shadow-xs dark:bg-input/30",
                (allSelected || someSelected) && ACTIVE_FILTER_OUTLINE
              )}
            >
              <Checkbox
                id="articles-select-all"
                checked={allSelected}
                indeterminate={someSelected}
                disabled={filtered.length === 0 || disabled}
                onCheckedChange={(value) => toggleAllSelected(!!value)}
                aria-label="Seleccionar todos"
              />
              <Label
                htmlFor="articles-select-all"
                className={cn(
                  "text-sm font-medium whitespace-nowrap",
                  allSelected || someSelected
                    ? "text-foreground"
                    : "text-muted-foreground"
                )}
              >
                Seleccionar todos
              </Label>
            </div>
          ) : null
        }
        filters={filters}
        activeFilterCount={activeFilterCount}
        onClearFilters={clearFilters}
        showColumnToggle={isSelectMode || canManage}
        columnLabels={ARTICLE_COLUMN_LABELS}
        viewMode={viewMode}
        onViewModeChange={onViewModeChange}
        cardColumnsStorageKey="catalog-card-columns"
        cardsView={(rows) => (
          <ArticleCards
            articles={rows}
            actions={actions}
            showActions={!isSelectMode}
            canSelect={canManage || isSelectMode}
            selectedIds={rowSelection}
            onSelectedChange={setCardSelected}
            groups={groupNames}
            groupByItemId={groupByItemId}
            onGroupChange={disabled ? undefined : onGroupChange}
            isSelectable={
              isSelectMode
                ? (article) =>
                    article.isActive || Boolean(rowSelection[article.id])
                : undefined
            }
          />
        )}
        selectionActions={
          !isSelectMode && canManage && selectedCount > 0 ? (
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
              {busy ? "Eliminando…" : `Eliminar ${selectedCount}`}
            </Button>
          ) : null
        }
        actions={
          !isSelectMode && canManage ? (
            <ButtonGroup className="w-full">
              <Button onClick={() => onCreate?.()} className="min-w-0 flex-1">
                <PlusIcon className="size-4 shrink-0" />
                <span className="truncate">Nuevo producto</span>
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger
                  render={<Button variant="default" size="icon" />}
                >
                  <ChevronDownIcon className="size-4" />
                  <span className="sr-only">Más acciones</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => onManageCategories?.()}
                    className="flex items-center gap-2"
                  >
                    <TagsIcon className="size-4" />
                    Categorías
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onImportCsv?.()}
                    className="flex items-center gap-2"
                  >
                    <UploadIcon className="size-4" />
                    Importar CSV
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </ButtonGroup>
          ) : null
        }
        rowContextMenu={
          isSelectMode
            ? undefined
            : (article) => (
                <ContextMenuContent align="end">
                  <ContextMenuGroup>
                    <ContextMenuGroupLabel>Acciones</ContextMenuGroupLabel>
                    <ContextMenuItem onClick={() => onEdit?.(article)}>
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
                          onClick={() => onActivate?.(article)}
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
              )
        }
        emptyState={
          <div className="flex flex-col items-center gap-1 text-muted-foreground">
            <SoupIcon className="size-6" />
            <p>
              {isSelectMode
                ? "No hay artículos disponibles para agregar al menú."
                : "Todavía no hay artículos. Crea uno o publica una receta como artículo."}
            </p>
          </div>
        }
        filteredEmptyState={
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <SoupIcon className="size-6" />
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
            {selectedCount > 0
              ? isSelectMode
                ? ` · ${selectedCount} en el menú`
                : ` · ${selectedCount} seleccionado(s)`
              : ""}
            {activeFilterCount > 0 ? " (filtrados)" : ""}.
          </>
        }
        isFiltered={isSelectMode ? activeFilterCount > 0 : undefined}
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
