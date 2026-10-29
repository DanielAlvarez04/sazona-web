"use client"

import * as React from "react"
import {
  EllipsisVerticalIcon,
  FileTextIcon,
  ListPlusIcon,
  MinusIcon,
  PackageOpenIcon,
  PencilIcon,
  PlusIcon,
  XIcon,
} from "lucide-react"
import { toast } from "sonner"

import {
  activateIngredient,
  adjustStock,
  deactivateIngredient,
} from "@/app/(app)/inventory/actions"
import {
  DataTable,
  DATA_TABLE_ALL,
  type DataTableFilter,
} from "@/components/data-table/data-table"
import { AdjustStockDialog } from "@/components/inventory/adjust-stock-dialog"
import { Button } from "@/components/ui/button"
import {
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuGroupLabel,
  ContextMenuItem,
} from "@/components/ui/context-menu"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Branch } from "@/lib/branches"
import type { Ingredient } from "@/lib/catalog"

import {
  createIngredientColumns,
  INGREDIENT_COLUMN_LABELS,
} from "./ingredients-columns"

const PAGE_SIZES = [15, 30, 50, 100]
const DEFAULT_PAGE_SIZE = 15

export function IngredientsTable({
  ingredients,
  branch,
  canManage,
  onCreate,
  onBulkCreate,
  onImportCsv,
  onEdit,
  idPrefix = "ingredients",
  categories = [],
  locations = [],
}: {
  ingredients: Ingredient[]
  /** Sucursal activa; `null` = vista consolidada de la organización. */
  branch: Branch | null
  canManage: boolean
  onCreate: () => void
  onBulkCreate: () => void
  onImportCsv: () => void
  onEdit: (ingredient: Ingredient) => void
  /** Prefijo de los `id` del DOM (búsqueda y selector de filas por página). */
  idPrefix?: string
  /** Categorías disponibles para el filtro. */
  categories?: { id: string; name: string }[]
  /** Ubicaciones disponibles para el filtro. */
  locations?: { id: string; name: string }[]
}) {
  const [globalFilter, setGlobalFilter] = React.useState("")
  const [categoryFilter, setCategoryFilter] =
    React.useState<string>(DATA_TABLE_ALL)
  const [locationFilter, setLocationFilter] =
    React.useState<string>(DATA_TABLE_ALL)
  const [pendingIds, setPendingIds] = React.useState<string[]>([])
  const [adjustingStock, setAdjustingStock] = React.useState<{
    ingredient: Ingredient
    type: "add" | "subtract"
  } | null>(null)

  const isPending = React.useCallback(
    (ingredient: Ingredient) => pendingIds.includes(ingredient.id),
    [pendingIds]
  )

  const handleToggleActive = React.useCallback(
    async (ingredient: Ingredient) => {
      setPendingIds((ids) => [...ids, ingredient.id])
      try {
        const result = ingredient.isActive
          ? await deactivateIngredient(ingredient.id)
          : await activateIngredient(
              ingredient.id,
              ingredient.location?.id ?? null
            )

        if (result?.ok) {
          toast.success(
            ingredient.isActive ? "Insumo desactivado" : "Insumo activado"
          )
        } else {
          toast.error(
            result?.message ?? "No se pudo actualizar el estado del insumo"
          )
        }
      } catch {
        toast.error("No se pudo actualizar el estado del insumo")
      } finally {
        setPendingIds((ids) => ids.filter((id) => id !== ingredient.id))
      }
    },
    []
  )

  const handleAddStock = React.useCallback((ingredient: Ingredient) => {
    setAdjustingStock({ ingredient, type: "add" })
  }, [])

  const handleSubtractStock = React.useCallback((ingredient: Ingredient) => {
    setAdjustingStock({ ingredient, type: "subtract" })
  }, [])

  const handleSubmitAdjustment = React.useCallback(
    async (quantity: string, reason: string) => {
      if (!adjustingStock?.ingredient || !quantity || !reason) return

      const { ingredient, type } = adjustingStock
      setPendingIds((ids) => [...ids, ingredient.id])
      try {
        const result = await adjustStock({
          ingredientId: ingredient.id,
          quantity,
          reason,
        })

        if (result?.ok) {
          toast.success(
            type === "add"
              ? "Stock añadido correctamente"
              : "Stock restado correctamente"
          )
          setAdjustingStock(null)
        } else {
          toast.error(result?.message ?? "No se pudo ajustar el stock")
        }
      } catch {
        toast.error("No se pudo ajustar el stock")
      } finally {
        setPendingIds((ids) => ids.filter((id) => id !== ingredient.id))
      }
    },
    [adjustingStock]
  )

  const columns = React.useMemo(
    () =>
      createIngredientColumns({
        onEdit,
        onToggleActive: handleToggleActive,
        onAddStock: handleAddStock,
        onSubtractStock: handleSubtractStock,
        isPending,
      }),
    [onEdit, handleToggleActive, handleAddStock, handleSubtractStock, isPending]
  )

  const filteredIngredients = React.useMemo(() => {
    const term = globalFilter.trim().toLowerCase()

    return ingredients.filter((ingredient) => {
      if (term) {
        const matchesName = ingredient.name.toLowerCase().includes(term)
        const matchesSku = ingredient.sku?.toLowerCase().includes(term) ?? false
        if (!matchesName && !matchesSku) return false
      }
      if (
        categoryFilter !== DATA_TABLE_ALL &&
        ingredient.category?.id !== categoryFilter
      ) {
        return false
      }
      if (
        locationFilter !== DATA_TABLE_ALL &&
        ingredient.location?.id !== locationFilter
      ) {
        return false
      }
      return true
    })
  }, [ingredients, globalFilter, categoryFilter, locationFilter])

  const filters = React.useMemo<DataTableFilter[]>(() => {
    const items: DataTableFilter[] = []

    if (categories.length > 0) {
      items.push({
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

    if (locations.length > 0) {
      items.push({
        id: "location",
        ariaLabel: "Filtrar por ubicación",
        placeholder: "Ubicación",
        allLabel: "Todas las ubicaciones",
        value: locationFilter,
        onValueChange: setLocationFilter,
        options: [
          { value: DATA_TABLE_ALL, label: "Todas las ubicaciones" },
          ...locations.map((location) => ({
            value: location.id,
            label: location.name,
          })),
        ],
      })
    }

    return items
  }, [categories, locations, categoryFilter, locationFilter])

  const activeFilterCount =
    (globalFilter.trim().length > 0 ? 1 : 0) +
    (categoryFilter !== DATA_TABLE_ALL ? 1 : 0) +
    (locationFilter !== DATA_TABLE_ALL ? 1 : 0)
  const hasFilters = activeFilterCount > 0

  const clearFilters = React.useCallback(() => {
    setGlobalFilter("")
    setCategoryFilter(DATA_TABLE_ALL)
    setLocationFilter(DATA_TABLE_ALL)
  }, [])

  return (
    <>
      <DataTable
        idPrefix={idPrefix}
        data={filteredIngredients}
        columns={columns}
        getRowId={(ingredient) => ingredient.id}
        pageResetKey={`${globalFilter}|${categoryFilter}|${locationFilter}`}
        search={{
          label: "Buscar insumo",
          placeholder: "Buscar por nombre o SKU...",
          value: globalFilter,
          onValueChange: setGlobalFilter,
        }}
        filters={filters}
        activeFilterCount={activeFilterCount}
        onClearFilters={clearFilters}
        showColumnToggle={canManage}
        columnLabels={INGREDIENT_COLUMN_LABELS}
        actions={
          canManage ? (
            <>
              <Button onClick={onCreate}>
                <PlusIcon className="size-4" />
                Nuevo insumo
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
                    onClick={onBulkCreate}
                    className="flex items-center gap-2"
                  >
                    <ListPlusIcon className="size-4" />
                    Añadir varios
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={onImportCsv}
                    className="flex items-center gap-2"
                  >
                    <FileTextIcon className="size-4" />
                    Importar CSV
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : null
        }
        onRowClick={canManage ? onEdit : undefined}
        rowClassName={
          canManage ? "cursor-pointer data-[open]:bg-accent" : undefined
        }
        rowContextMenu={(ingredient) => {
          const pending = pendingIds.includes(ingredient.id)

          return (
            <ContextMenuContent align="end">
              <ContextMenuGroup>
                <ContextMenuGroupLabel>Acciones</ContextMenuGroupLabel>
                <ContextMenuItem
                  onClick={() => handleAddStock(ingredient)}
                  disabled={pending}
                >
                  <PlusIcon />
                  Añadir stock
                </ContextMenuItem>
                <ContextMenuItem
                  onClick={() => handleSubtractStock(ingredient)}
                  disabled={pending}
                >
                  <MinusIcon />
                  Restar stock
                </ContextMenuItem>
                <ContextMenuItem
                  onClick={() => onEdit(ingredient)}
                  disabled={pending}
                >
                  <PencilIcon />
                  Editar
                </ContextMenuItem>
              </ContextMenuGroup>
            </ContextMenuContent>
          )
        }}
        emptyState={
          <div className="flex flex-col items-center gap-1 text-muted-foreground">
            <PackageOpenIcon className="size-6" />
            <p>Todavía no hay insumos. Crea el primero para empezar.</p>
          </div>
        }
        filteredEmptyState={
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <PackageOpenIcon className="size-6" />
            <p>No hay insumos que coincidan con los filtros.</p>
            <Button variant="outline" size="sm" onClick={clearFilters}>
              <XIcon className="size-4" />
              Limpiar filtros
            </Button>
          </div>
        }
        summary={
          <>
            {filteredIngredients.length} insumo
            {filteredIngredients.length === 1 ? "" : "s"}
            {branch
              ? ` · Stock de ${branch.name}`
              : " · Toda la organización"}
            {hasFilters ? " (filtrados)" : ""}.
          </>
        }
        pageSizeOptions={PAGE_SIZES}
        defaultPageSize={DEFAULT_PAGE_SIZE}
      />

      <AdjustStockDialog
        ingredient={adjustingStock?.ingredient ?? null}
        open={!!adjustingStock}
        onOpenChange={(open) => {
          if (!open) setAdjustingStock(null)
        }}
        onSubmit={handleSubmitAdjustment}
        pending={pendingIds.includes(adjustingStock?.ingredient.id ?? "")}
        type={adjustingStock?.type ?? "add"}
      />
    </>
  )
}
