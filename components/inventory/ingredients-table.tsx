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
  Columns3Icon,
  EllipsisVerticalIcon,
  FileTextIcon,
  ListPlusIcon,
  MinusIcon,
  PencilIcon,
  PlusIcon,
  PackageOpenIcon,
  SearchIcon,
  XIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
  /** Prefijo de los `id` del DOM (búsqueda y selector de filas por página). */
  idPrefix?: string
  /** Categorías disponibles para el filtro. */
  categories?: { id: string; name: string }[]
  /** Ubicaciones disponibles para el filtro. */
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
  const activeFilterCount =
    (globalFilter.trim().length > 0 ? 1 : 0) +
    (categoryFilter !== ALL_VALUE ? 1 : 0) +
    (locationFilter !== ALL_VALUE ? 1 : 0)
  const selectedCategoryLabel =
    categories.find((category) => category.id === categoryFilter)?.name ??
    "Todas las categorías"
  const selectedLocationLabel =
    locations.find((location) => location.id === locationFilter)?.name ??
    "Todas las ubicaciones"

  return (
    <>
      <div className="flex min-w-0 flex-col gap-3">
        {/* Barra de herramientas: una sola fila con dos grupos. */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div
            role="group"
            aria-label="Filtros"
            className="flex min-w-0 flex-1 flex-wrap items-center gap-2"
          >
            {/* Mismo rango de ancho que los `Select` de categoría/ubicación
                (`min-w-40`–`max-w-64`), en lugar de un ancho fijo. */}
            <div className="relative w-full sm:w-auto sm:min-w-40 sm:max-w-64">
              <Label htmlFor={`${idPrefix}-search`} className="sr-only">
                Buscar insumo
              </Label>
              <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id={`${idPrefix}-search`}
                type="search"
                placeholder="Buscar por nombre o SKU..."
                value={globalFilter}
                onChange={(event) => {
                  setGlobalFilter(event.target.value)
                  setPagination((current) => ({ ...current, pageIndex: 0 }))
                }}
                className="pl-8"
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
                  // `w-auto` deja que el disparador crezca con el nombre elegido;
                  // así no se corta el texto de categorías largas.
                  className="w-auto min-w-40 max-w-64"
                  aria-label="Filtrar por categoría"
                  title={selectedCategoryLabel}
                >
                  <SelectValue placeholder="Categoría" />
                </SelectTrigger>
                <SelectContent className="w-max max-w-[min(24rem,var(--available-width))]">
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
                  className="w-auto min-w-40 max-w-64"
                  aria-label="Filtrar por ubicación"
                  title={selectedLocationLabel}
                >
                  <SelectValue placeholder="Ubicación" />
                </SelectTrigger>
                <SelectContent className="w-max max-w-[min(24rem,var(--available-width))]">
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
                className="text-muted-foreground"
                onClick={() => {
                  setGlobalFilter("")
                  setCategoryFilter(ALL_VALUE)
                  setLocationFilter(ALL_VALUE)
                  setPagination((current) => ({ ...current, pageIndex: 0 }))
                }}
              >
                <XIcon className="size-4" />
                Limpiar
                <Badge variant="secondary" className="ml-1 px-1.5 text-xs">
                  {activeFilterCount}
                </Badge>
              </Button>
            ) : null}
          </div>

          {canManage ? (
            <div
              role="group"
              aria-label="Acciones"
              className="flex shrink-0 items-center gap-2"
            >
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button variant="outline" aria-label="Mostrar u ocultar columnas" />
                  }
                >
                  <Columns3Icon className="size-4" />
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
                <DropdownMenuContent align="end" className="w-max">
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
            </div>
          ) : null}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border">
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
                  className="h-32 text-center whitespace-normal"
                >
                  {ingredients.length === 0 ? (
                    <div className="flex flex-col items-center gap-1 text-muted-foreground">
                      <PackageOpenIcon className="size-6" />
                      <p>Todavía no hay insumos. Crea el primero para empezar.</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3 text-muted-foreground">
                      <PackageOpenIcon className="size-6" />
                      <p>No hay insumos que coincidan con los filtros.</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setGlobalFilter("")
                          setCategoryFilter(ALL_VALUE)
                          setLocationFilter(ALL_VALUE)
                          setPagination((current) => ({
                            ...current,
                            pageIndex: 0,
                          }))
                        }}
                      >
                        <XIcon className="size-4" />
                        Limpiar filtros
                      </Button>
                    </div>
                  )}
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
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Siguiente
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
