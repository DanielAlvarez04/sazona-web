"use client"

import * as React from "react"
import {
  GroupIcon,
  PencilIcon,
  PlusIcon,
  PowerIcon,
  Trash2Icon,
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
import { Checkbox } from "@/components/ui/checkbox"
import {
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuGroupLabel,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu"
import { Label } from "@/components/ui/label"
import {
  PROMOTION_TYPE_LABELS,
  type ArticleListItem,
  type PromotionType,
  type Recipe,
} from "@/lib/catalog"
import { ACTIVE_FILTER_OUTLINE, cn } from "@/lib/utils"

import { ComboCards } from "./combo-cards"
import {
  COMBO_COLUMN_LABELS,
  createComboColumns,
  type ComboRowActions,
} from "./combos-columns"

type PendingAction =
  | { kind: "deactivate"; combos: ArticleListItem[] }
  | { kind: "delete"; combos: ArticleListItem[] }

export function CombosTable({
  combos,
  recipes,
  canManage,
  viewMode,
  onViewModeChange,
  onCreate,
  onEdit,
  onActivate,
  onDeactivate,
  onDelete,
}: {
  combos: ArticleListItem[]
  recipes: Recipe[]
  canManage: boolean
  viewMode: DataTableViewMode
  onViewModeChange: (mode: DataTableViewMode) => void
  onCreate: () => void
  onEdit: (combo: ArticleListItem) => void
  onActivate: (combo: ArticleListItem) => Promise<boolean>
  onDeactivate: (combo: ArticleListItem) => Promise<boolean>
  onDelete: (combos: ArticleListItem[]) => Promise<boolean>
}) {
  const [globalFilter, setGlobalFilter] = React.useState("")
  const [promotionFilter, setPromotionFilter] =
    React.useState<string>(DATA_TABLE_ALL)
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})
  const [pendingAction, setPendingAction] = React.useState<PendingAction | null>(
    null
  )
  const [busy, setBusy] = React.useState(false)

  const filtered = React.useMemo(() => {
    const term = globalFilter.trim().toLowerCase()

    return combos.filter((combo) => {
      if (term) {
        const matchesName = combo.name.toLowerCase().includes(term)
        const matchesSku = combo.sku?.toLowerCase().includes(term) ?? false
        if (!matchesName && !matchesSku) return false
      }

      const promotion = combo.promotions?.[0]
      if (promotionFilter === "none" && promotion) return false
      if (
        promotionFilter !== DATA_TABLE_ALL &&
        promotionFilter !== "none" &&
        promotion?.type !== promotionFilter
      ) {
        return false
      }

      return true
    })
  }, [combos, globalFilter, promotionFilter])

  const selectedCombos = React.useMemo(
    () => filtered.filter((combo) => rowSelection[combo.id]),
    [filtered, rowSelection]
  )
  const selectedCount = selectedCombos.length

  const allSelected =
    filtered.length > 0 && filtered.every((combo) => rowSelection[combo.id])
  const someSelected =
    !allSelected && filtered.some((combo) => rowSelection[combo.id])

  const toggleAllSelected = React.useCallback(
    (selected: boolean) => {
      setRowSelection((prev) => {
        const next = { ...prev }
        for (const combo of filtered) {
          if (selected) next[combo.id] = true
          else delete next[combo.id]
        }
        return next
      })
    },
    [filtered]
  )

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

  const promotionTypes = Object.keys(PROMOTION_TYPE_LABELS) as PromotionType[]

  const filters: DataTableFilter[] = [
    {
      id: "promotion",
      ariaLabel: "Filtrar por promoción",
      placeholder: "Promoción",
      allLabel: "Todas las promociones",
      value: promotionFilter,
      onValueChange: setPromotionFilter,
      options: [
        { value: DATA_TABLE_ALL, label: "Todas las promociones" },
        { value: "none", label: "Sin promoción" },
        ...promotionTypes.map((type) => ({
          value: type,
          label: PROMOTION_TYPE_LABELS[type],
        })),
      ],
    },
  ]

  const activeFilterCount =
    (globalFilter.trim() ? 1 : 0) +
    (promotionFilter !== DATA_TABLE_ALL ? 1 : 0)

  const clearFilters = React.useCallback(() => {
    setGlobalFilter("")
    setPromotionFilter(DATA_TABLE_ALL)
  }, [])

  const requestDeactivate = React.useCallback((combo: ArticleListItem) => {
    setPendingAction({ kind: "deactivate", combos: [combo] })
  }, [])

  const requestDelete = React.useCallback((combo: ArticleListItem) => {
    setPendingAction({ kind: "delete", combos: [combo] })
  }, [])

  const actions = React.useMemo<ComboRowActions>(
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
    () =>
      createComboColumns(actions, {
        selectable: canManage,
        recipes,
      }),
    [actions, canManage, recipes]
  )

  async function confirmPendingAction() {
    if (!pendingAction) return

    setBusy(true)
    const ok =
      pendingAction.kind === "deactivate"
        ? await onDeactivate(pendingAction.combos[0])
        : await onDelete(pendingAction.combos)
    setBusy(false)

    if (ok) {
      setPendingAction(null)
      setRowSelection({})
    }
  }

  const singleCombo =
    pendingAction && pendingAction.combos.length === 1
      ? pendingAction.combos[0]
      : null
  const actionCount = pendingAction?.combos.length ?? 0

  return (
    <>
      <DataTable
        idPrefix="combos"
        data={filtered}
        columns={columns}
        getRowId={(combo) => combo.id}
        pageResetKey={`${globalFilter}|${promotionFilter}`}
        rowSelection={rowSelection}
        onRowSelectionChange={setRowSelection}
        enableRowSelection={canManage}
        tableClassName="[&_td]:py-1.5"
        initialSorting={[{ id: "name", desc: false }]}
        layout="sidebar"
        search={{
          label: "Buscar combo",
          placeholder: "Buscar por nombre",
          value: globalFilter,
          onValueChange: setGlobalFilter,
        }}
        selectionToggle={
          canManage ? (
            <div
              className={cn(
                "flex h-9 items-center gap-2 rounded-md border border-input bg-transparent px-2.5 shadow-xs dark:bg-input/30",
                (allSelected || someSelected) && ACTIVE_FILTER_OUTLINE
              )}
            >
              <Checkbox
                id="combos-select-all"
                checked={allSelected}
                indeterminate={someSelected}
                disabled={filtered.length === 0}
                onCheckedChange={(value) => toggleAllSelected(!!value)}
                aria-label="Seleccionar todos"
              />
              <Label
                htmlFor="combos-select-all"
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
        selectionActions={
          canManage && selectedCount > 0 ? (
            <Button
              variant="destructive"
              onClick={() =>
                setPendingAction({ kind: "delete", combos: selectedCombos })
              }
              disabled={busy}
            >
              <Trash2Icon />
              {busy ? "Eliminando…" : `Eliminar ${selectedCount}`}
            </Button>
          ) : null
        }
        showColumnToggle={canManage}
        columnLabels={COMBO_COLUMN_LABELS}
        viewMode={viewMode}
        onViewModeChange={onViewModeChange}
        cardsView={(rows) => (
          <ComboCards
            combos={rows}
            actions={actions}
            canSelect={canManage}
            selectedIds={rowSelection}
            onSelectedChange={setCardSelected}
          />
        )}
        actions={
          canManage ? (
            <Button onClick={onCreate} className="w-full">
              <PlusIcon className="size-4 shrink-0" />
              <span className="truncate">Nuevo producto</span>
            </Button>
          ) : null
        }
        rowContextMenu={(combo) => (
          <ContextMenuContent align="end">
            <ContextMenuGroup>
              <ContextMenuGroupLabel>Acciones</ContextMenuGroupLabel>
              <ContextMenuItem onClick={() => onEdit(combo)}>
                <PencilIcon />
                Editar combo
              </ContextMenuItem>
              {canManage ? (
                combo.isActive ? (
                  <ContextMenuItem
                    className="text-amber-600 focus:bg-amber-500/10 focus:text-amber-600 dark:text-amber-400 dark:focus:text-amber-400"
                    onClick={() => requestDeactivate(combo)}
                  >
                    <PowerIcon />
                    Desactivar
                  </ContextMenuItem>
                ) : (
                  <ContextMenuItem
                    className="text-emerald-600 focus:bg-emerald-500/10 focus:text-emerald-600 dark:text-emerald-400 dark:focus:text-emerald-400"
                    onClick={() => onActivate(combo)}
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
                    onClick={() => requestDelete(combo)}
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
            <GroupIcon className="size-6" />
            <p>Todavía no hay combos. Crea el primero para empezar.</p>
          </div>
        }
        filteredEmptyState={
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <GroupIcon className="size-6" />
            <p>No hay combos que coincidan con los filtros.</p>
            <Button variant="outline" size="sm" onClick={clearFilters}>
              <XIcon className="size-4" />
              Limpiar filtros
            </Button>
          </div>
        }
        summary={
          <>
            {filtered.length} combo{filtered.length === 1 ? "" : "s"}
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
                  ? `¿Eliminar ${actionCount} combos?`
                  : "¿Eliminar este combo?"
                : "¿Desactivar este combo?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction?.kind === "delete" ? (
                <>
                  {singleCombo
                    ? `«${singleCombo.name}» se eliminará definitivamente. Ya no podrá usarse en los menús y se retirará de los menús donde se usaba.`
                    : `Se eliminarán definitivamente ${actionCount} combos. Ya no podrán usarse en los menús y se retirarán de los menús donde se usaban.`}{" "}
                  Esta acción no se puede deshacer. Los combos que aparecen en
                  pedidos no se pueden eliminar; desactívalos para ocultarlos.
                </>
              ) : (
                <>
                  {singleCombo ? `«${singleCombo.name}»` : "El combo"} dejará de
                  ser utilizable en los menús y se ocultará de los menús donde
                  se usaba. Puedes activarlo de nuevo cuando quieras.
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
