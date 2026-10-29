"use client"

import * as React from "react"
import {
  FlexRender,
  functionalUpdate,
  useTable,
  type ColumnDef,
  type ColumnVisibilityState,
  type PaginationState,
  type RowData,
  type RowSelectionState,
  type SortingState,
} from "@tanstack/react-table"
import { Columns3Icon, SearchIcon, XIcon } from "lucide-react"
import { cn } from "cn"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
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
  dataTableFeatures,
  type DataTableFeatures,
} from "./data-table-features"

/** Valor centinela para "sin filtro" en los `Select` de la barra de filtros. */
export const DATA_TABLE_ALL = "__all__"

const DEFAULT_PAGE_SIZES = [10, 20, 30, 50, 100]
const DEFAULT_PAGE_SIZE = 10

export interface DataTableFilterOption {
  value: string
  label: string
}

/** Filtro de la barra de herramientas (se pinta como un `Select`). */
export interface DataTableFilter {
  /** Identificador único del filtro; se usa para la `key` del `Select`. */
  id: string
  ariaLabel: string
  /** Texto del trigger cuando no hay valor elegido. */
  placeholder: string
  /** Etiqueta de la opción "sin filtro" (también se usa como `title`). */
  allLabel: string
  value: string
  onValueChange: (value: string) => void
  options: DataTableFilterOption[]
}

/** Buscador de la barra de herramientas. */
export interface DataTableSearch {
  label: string
  placeholder: string
  value: string
  onValueChange: (value: string) => void
}

export interface DataTableProps<TData extends RowData> {
  data: TData[]
  columns: ColumnDef<DataTableFeatures, TData>[]
  /** `id` estable de cada fila; por defecto TanStack usa el índice. */
  getRowId?: (row: TData) => string
  /** Prefijo de los `id` del DOM (buscador y filas por página). */
  idPrefix?: string

  // Barra de herramientas
  search?: DataTableSearch
  filters?: DataTableFilter[]
  /** Nº de filtros activos; muestra "Limpiar" cuando es mayor que 0. */
  activeFilterCount?: number
  onClearFilters?: () => void
  /** Cambia este valor para volver a la primera página (p. ej. al filtrar). */
  pageResetKey?: unknown
  /** Muestra el menú de visibilidad de columnas. */
  showColumnToggle?: boolean
  /** Etiquetas legibles para el menú de columnas (`id` → texto). */
  columnLabels?: Record<string, string>
  /** Acciones extra a la derecha de la barra (botones, menús…). */
  actions?: React.ReactNode

  // Filas
  onRowClick?: (row: TData) => void
  rowClassName?: string | ((row: TData) => string | undefined)
  /**
   * Contenido del menú contextual de una fila (normalmente un
   * `<ContextMenuContent>`). Si se omite, la fila no tiene menú.
   */
  rowContextMenu?: (row: TData) => React.ReactNode
  /** Selección de filas controlada (`rowId` → seleccionada). */
  rowSelection?: RowSelectionState
  onRowSelectionChange?: (selection: RowSelectionState) => void
  /** Habilita (o limita) la selección de filas con checkbox. */
  enableRowSelection?: boolean | ((row: TData) => boolean)

  // Estados vacíos y pie
  /** Clases extra para el `<table>` (por ejemplo, densidad de celdas). */
  tableClassName?: string
  emptyState?: React.ReactNode
  filteredEmptyState?: React.ReactNode
  /** Fuerza el estado "sin resultados por filtros"; por defecto usa `activeFilterCount`. */
  isFiltered?: boolean
  /** Texto/indicadores de la izquierda del pie de tabla. */
  summary?: React.ReactNode
  pageSizeOptions?: number[]
  defaultPageSize?: number
  initialSorting?: SortingState
}

/**
 * Tabla de datos reutilizable: barra de búsqueda/filtros, selector de columnas,
 * tabla con encabezado fijo, menú contextual por fila y paginación.
 *
 * El filtrado de los datos es responsabilidad del consumidor (recibe `data` ya
 * filtrada); la tabla se encarga de ordenar y paginar.
 */
export function DataTable<TData extends RowData>({
  data,
  columns,
  getRowId,
  idPrefix = "data-table",
  search,
  filters = [],
  activeFilterCount = 0,
  onClearFilters,
  pageResetKey,
  showColumnToggle = true,
  columnLabels,
  actions,
  onRowClick,
  rowClassName,
  rowContextMenu,
  rowSelection,
  onRowSelectionChange,
  enableRowSelection,
  tableClassName,
  emptyState,
  filteredEmptyState,
  isFiltered,
  summary,
  pageSizeOptions = DEFAULT_PAGE_SIZES,
  defaultPageSize = DEFAULT_PAGE_SIZE,
  initialSorting,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = React.useState<SortingState>(
    initialSorting ?? []
  )
  const [columnVisibility, setColumnVisibility] =
    React.useState<ColumnVisibilityState>({})
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: defaultPageSize,
  })
  // La selección puede ser controlada por el consumidor o interna.
  const [internalRowSelection, setInternalRowSelection] =
    React.useState<RowSelectionState>({})
  const selection = rowSelection ?? internalRowSelection

  const table = useTable<DataTableFeatures, TData>({
    features: dataTableFeatures,
    data,
    columns,
    state: { sorting, columnVisibility, pagination, rowSelection: selection },
    getRowId: getRowId ? (row) => getRowId(row) : undefined,
    enableRowSelection:
      typeof enableRowSelection === "function"
        ? (row) => enableRowSelection(row.original)
        : enableRowSelection,
    onRowSelectionChange: (updater) => {
      const next = functionalUpdate(updater, selection)
      if (rowSelection === undefined) setInternalRowSelection(next)
      onRowSelectionChange?.(next)
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
  })

  // Al cambiar los filtros se vuelve a la primera página. Es estado derivado
  // de una prop: se ajusta durante el render (patrón recomendado por React)
  // para no provocar un render extra con un efecto.
  const [paginationResetKey, setPaginationResetKey] =
    React.useState(pageResetKey)
  if (pageResetKey !== paginationResetKey) {
    setPaginationResetKey(pageResetKey)
    setPagination((current) =>
      current.pageIndex === 0 ? current : { ...current, pageIndex: 0 }
    )
  }

  const rows = table.getRowModel().rows
  const hasFilters = activeFilterCount > 0
  const showingFiltered = isFiltered ?? hasFilters
  const columnCount = table.getVisibleLeafColumns().length

  const resolveRowClassName = (row: TData) =>
    typeof rowClassName === "function" ? rowClassName(row) : rowClassName

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex min-w-0 flex-col gap-3">
        {/* Barra de herramientas: una sola fila con dos grupos. */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div
            role="group"
            aria-label="Filtros"
            className="flex min-w-0 flex-1 flex-wrap items-center gap-2"
          >
            {search ? (
              <div className="relative w-full sm:w-auto sm:min-w-40 sm:max-w-64">
                <Label htmlFor={`${idPrefix}-search`} className="sr-only">
                  {search.label}
                </Label>
                <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id={`${idPrefix}-search`}
                  type="search"
                  placeholder={search.placeholder}
                  value={search.value}
                  onChange={(event) => search.onValueChange(event.target.value)}
                  className="pl-8"
                />
              </div>
            ) : null}

            {filters.map((filter) => {
              const selectedLabel =
                filter.options.find((option) => option.value === filter.value)
                  ?.label ?? filter.allLabel

              return (
                <Select
                  key={filter.id}
                  value={filter.value}
                  onValueChange={(value) =>
                    filter.onValueChange((value as string) ?? DATA_TABLE_ALL)
                  }
                  items={filter.options}
                >
                  <SelectTrigger
                    // `w-auto` deja que el disparador crezca con el nombre
                    // elegido; así no se corta el texto de opciones largas.
                    className="w-auto min-w-40 max-w-64"
                    aria-label={filter.ariaLabel}
                    title={selectedLabel}
                  >
                    <SelectValue placeholder={filter.placeholder} />
                  </SelectTrigger>
                  <SelectContent>
                    {filter.options.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )
            })}

            {hasFilters && onClearFilters ? (
              <Button
                variant="ghost"
                className="text-muted-foreground"
                onClick={onClearFilters}
              >
                <XIcon className="size-4" />
                Limpiar
                <Badge variant="secondary" className="ml-1 px-1.5 text-xs">
                  {activeFilterCount}
                </Badge>
              </Button>
            ) : null}
          </div>

          {showColumnToggle || actions ? (
            <div
              role="group"
              aria-label="Acciones"
              className="flex shrink-0 flex-wrap items-center gap-2"
            >
              {showColumnToggle ? (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="outline"
                        aria-label="Mostrar u ocultar columnas"
                      />
                    }
                  >
                    <Columns3Icon className="size-4" />
                    <span>Columnas</span>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
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
                            {columnLabels?.[column.id] ?? column.id}
                          </DropdownMenuCheckboxItem>
                        ))}
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}

              {actions}
            </div>
          ) : null}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <Table className={tableClassName}>
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
            {rows.length > 0 ? (
              rows.map((row) => {
                const tableRow = (
                  <TableRow
                    data-state={row.getIsSelected() ? "selected" : undefined}
                    className={cn("h-max", resolveRowClassName(row.original))}
                    onClick={
                      onRowClick
                        ? () => onRowClick(row.original)
                        : undefined
                    }
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        <FlexRender cell={cell} />
                      </TableCell>
                    ))}
                  </TableRow>
                )

                if (!rowContextMenu) {
                  return <React.Fragment key={row.id}>{tableRow}</React.Fragment>
                }

                return (
                  <ContextMenu key={row.id}>
                    <ContextMenuTrigger asChild>{tableRow}</ContextMenuTrigger>
                    {rowContextMenu(row.original)}
                  </ContextMenu>
                )
              })
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columnCount}
                  className="h-32 text-center whitespace-normal"
                >
                  {showingFiltered
                    ? (filteredEmptyState ?? emptyState ?? (
                        <p className="text-muted-foreground">
                          No hay resultados que coincidan con los filtros.
                        </p>
                      ))
                    : (emptyState ?? (
                        <p className="text-muted-foreground">Todavía no hay datos.</p>
                      ))}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">{summary}</div>

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
              items={pageSizeOptions.map((pageSize) => ({
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
                {pageSizeOptions.map((pageSize) => (
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
    </div>
  )
}
