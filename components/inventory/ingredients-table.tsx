"use client"

import * as React from "react"
import {
  FlexRender,
  useTable,
  type ColumnVisibilityState,
  type PaginationState,
  type SortingState,
} from "@tanstack/react-table"
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  FileTextIcon,
  ListPlusIcon,
  MinusIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuGroupLabel,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  activateIngredient,
  adjustStock,
  deactivateIngredient,
} from "@/app/(app)/inventory/actions"
import { AdjustStockDialog } from "@/components/inventory/adjust-stock-dialog"
import type { Branch } from "@/lib/branches"
import type { Ingredient } from "@/lib/catalog"

import { inventoryTableFeatures } from "./data-table-features"
import {
  createIngredientColumns,
  INGREDIENT_COLUMN_LABELS,
} from "./ingredients-columns"

/** Valor centinela para "sin filtro" en los `Select` de categoría/ubicación. */
const ALL_VALUE = "__all__"

const PAGE_SIZES = [15, 30, 50, 100]

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
  /** Prefijo de los `id` del DOM (varias tablas en la misma página). */
  idPrefix?: string
  categories?: { id: string; name: string }[]
  locations?: { id: string; name: string }[]
}) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnVisibility, setColumnVisibility] =
    React.useState<ColumnVisibilityState>({})
  const [globalFilter, setGlobalFilter] = React.useState("")
  const [categoryFilter, setCategoryFilter] = React.useState<string>(ALL_VALUE)
  const [locationFilter, setLocationFilter] = React.useState<string>(ALL_VALUE)
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 15,
  })
  const [pendingIds, setPendingIds] = React.useState<string[]>([])
  const [adjustingStock, setAdjustingStock] = React.useState<{ ingredient: Ingredient; type: "add" | "subtract" } | null>(null)

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

  const handleAddStock = React.useCallback(
    (ingredient: Ingredient) => {
      setAdjustingStock({ ingredient, type: "add" })
    },
    []
  )

  const handleSubtractStock = React.useCallback(
    (ingredient: Ingredient) => {
      setAdjustingStock({ ingredient, type: "subtract" })
    },
    []
  )

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
        categoryFilter !== ALL_VALUE &&
        ingredient.category?.id !== categoryFilter
      ) {
        return false
      }
      if (
        locationFilter !== ALL_VALUE &&
        ingredient.location?.id !== locationFilter
      ) {
        return false
      }
      return true
    })
  }, [ingredients, globalFilter, categoryFilter, locationFilter])

  const table = useTable({
    features: inventoryTableFeatures,
    data: filteredIngredients,
    columns,
    state: {
      sorting,
      columnVisibility,
      pagination,
    },
    getRowId: (row) => row.id,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
  })

  const rowCount = filteredIngredients.length
  const hasFilters =
    globalFilter.trim().length > 0 ||
    categoryFilter !== ALL_VALUE ||
    locationFilter !== ALL_VALUE

  return (
    <>
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Label htmlFor={`${idPrefix}-search`} className="sr-only">
                Buscar insumo
              </Label>
              <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id={`${idPrefix}-search`}
                type="search"
                placeholder="Buscar insumo..."
                value={globalFilter}
                onChange={(event) => {
                  setGlobalFilter(event.target.value)
                  setPagination((current) => ({ ...current, pageIndex: 0 }))
                }}
                className="h-8 w-[200px] pl-8"
              />
            </div>

            {categories.length > 0 && (
              <Select
                value={categoryFilter}
                onValueChange={(value) => {
                  setCategoryFilter((value as string) ?? ALL_VALUE)
                  setPagination((current) => ({ ...current, pageIndex: 0 }))
                }}
                items={[
                  { value: ALL_VALUE, label: "Todas las categorías" },
                  ...categories.map((category) => ({
                    value: category.id,
                    label: category.name,
                  })),
                ]}
              >
                <SelectTrigger
                  className="h-8 w-[168px]"
                  aria-label="Filtrar por categoría"
                >
                  <SelectValue placeholder="Categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_VALUE}>Todas las categorías</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {locations.length > 0 && (
              <Select
                value={locationFilter}
                onValueChange={(value) => {
                  setLocationFilter((value as string) ?? ALL_VALUE)
                  setPagination((current) => ({ ...current, pageIndex: 0 }))
                }}
                items={[
                  { value: ALL_VALUE, label: "Todas las ubicaciones" },
                  ...locations.map((location) => ({
                    value: location.id,
                    label: location.name,
                  })),
                ]}
              >
                <SelectTrigger
                  className="h-8 w-[168px]"
                  aria-label="Filtrar por ubicación"
                >
                  <SelectValue placeholder="Ubicación" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_VALUE}>Todas las ubicaciones</SelectItem>
                  {locations.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {hasFilters ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-8"
                onClick={() => {
                  setGlobalFilter("")
                  setCategoryFilter(ALL_VALUE)
                  setLocationFilter(ALL_VALUE)
                  setPagination((current) => ({ ...current, pageIndex: 0 }))
                }}
              >
                Limpiar filtros
              </Button>
            ) : null}

          </div>

          {canManage ? (
            <ButtonGroup>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={<Button variant="outline" size="default" />}
                >
                  <ChevronDownIcon className="h-4 w-4" />
                  <span>Columnas</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>Columnas</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {table
                      .getAllColumns()
                      .filter((column) => column.getCanHide())
                      .map((column) => (
                        <DropdownMenuCheckboxItem
                          key={column.id}
                          checked={column.getIsVisible()}
                          onCheckedChange={(value) =>
                            column.toggleVisibility(!!value)
                          }
                        >
                          {INGREDIENT_COLUMN_LABELS[column.id] ?? column.id}
                        </DropdownMenuCheckboxItem>
                      ))}
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button onClick={onCreate}>
                <PlusIcon className="mr-2 h-4 w-4" />
                Nuevo insumo
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button className="pl-2 pr-2">
                      <ChevronDownIcon className="h-4 w-4" />
                    </Button>
                  }
                >
                  <ChevronDownIcon className="h-4 w-4" />
                  <span className="sr-only">Más opciones</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-max">
                  <DropdownMenuItem
                    onClick={onBulkCreate}
                    className="flex items-center gap-2"
                  >
                    <ListPlusIcon className="h-4 w-4" />
                    Añadir varios
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={onImportCsv}
                    className="flex items-center gap-2"
                  >
                    <FileTextIcon className="h-4 w-4" />
                    Importar CSV
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </ButtonGroup>
          ) : null}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-muted">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} colSpan={header.colSpan}>
                    {header.isPlaceholder ? null : (
                      <FlexRender header={header} />
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => {
                const ingredient = row.original
                const pending = pendingIds.includes(ingredient.id)

                return (
                  <ContextMenu key={row.id}>
                    <ContextMenuTrigger asChild>
                      <TableRow
                        className={
                          canManage
                            ? "cursor-pointer data-[open]:bg-accent"
                            : undefined
                        }
                        onClick={() => {
                          if (canManage) onEdit(ingredient)
                        }}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id}>
                            <FlexRender cell={cell} />
                          </TableCell>
                        ))}
                      </TableRow>
                    </ContextMenuTrigger>
                    <ContextMenuContent align="end" className="w-44">
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
                  </ContextMenu>
                )
              })
            ) : (
              <TableRow>
                <TableCell
                  colSpan={table.getVisibleLeafColumns().length}
                  className="h-24 text-center text-muted-foreground"
                >
                  {ingredients.length === 0
                    ? "Todavía no hay insumos. Crea el primero para empezar."
                    : "No hay insumos que coincidan con la búsqueda."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {rowCount} insumo{rowCount === 1 ? "" : "s"}
          {branch ? ` · Stock de ${branch.name}` : " · Toda la organización"}
          {hasFilters ? " (filtrados)" : ""}.
        </p>

        <div className="flex flex-wrap items-center gap-4">
          <div className="hidden items-center gap-2 sm:flex">
            <Label
              htmlFor={`${idPrefix}-rows-per-page`}
              className="text-sm font-medium"
            >
              Filas por página
            </Label>
            <Select
              value={`${pagination.pageSize}`}
              onValueChange={(value) => {
                if (!value) return
                table.setPageSize(Number(value))
              }}
              items={PAGE_SIZES.map((pageSize) => ({
                label: `${pageSize}`,
                value: `${pageSize}`,
              }))}
            >
              <SelectTrigger
                size="sm"
                className="w-20"
                id={`${idPrefix}-rows-per-page`}
              >
                <SelectValue placeholder={`${pagination.pageSize}`} />
              </SelectTrigger>
              <SelectContent side="top">
                {PAGE_SIZES.map((pageSize) => (
                  <SelectItem key={pageSize} value={`${pageSize}`}>
                    {pageSize}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex w-fit items-center justify-center text-sm font-medium">
            Página {pagination.pageIndex + 1} de {table.getPageCount()}
          </div>

          <div className="ml-auto flex items-center gap-2 sm:ml-0">
            <Button
              variant="outline"
              size="icon-sm"
              className="hidden lg:flex"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
            >
              <span className="sr-only">Ir a la primera página</span>
              <ChevronsLeftIcon />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <span className="sr-only">Ir a la página anterior</span>
              <ChevronLeftIcon />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <span className="sr-only">Ir a la página siguiente</span>
              <ChevronRightIcon />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              className="hidden lg:flex"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
            >
              <span className="sr-only">Ir a la última página</span>
              <ChevronsRightIcon />
            </Button>
          </div>
        </div>
      </div>
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
