import {
  columnFilteringFeature,
  columnVisibilityFeature,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFn_includesString,
  globalFilteringFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
} from "@tanstack/react-table"

/**
 * Features de TanStack Table v9 compartidas por las tablas de la app.
 *
 * En v9 las features son opt-in y las funciones de ordenación/filtrado deben
 * registrarse explícitamente; si no se registran, quedan fuera del bundle y la
 * tabla falla al ordenar o filtrar en tiempo de ejecución.
 *
 * Se declara una sola vez para que todos los componentes de la tabla (y las
 * columnas de cada módulo) usen el mismo objeto y el mismo tipo derivado.
 */
export const dataTableFeatures = tableFeatures({
  columnFilteringFeature,
  columnVisibilityFeature,
  globalFilteringFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  filteredRowModel: createFilteredRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortedRowModel: createSortedRowModel(),
  filterFns: {
    includesString: filterFn_includesString,
  },
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    basic: sortFn_basic,
    text: sortFn_text,
    datetime: sortFn_datetime,
  },
})

/** Pásalo como primer genérico de `ColumnDef`, `Column`, `Table` y `Row`. */
export type DataTableFeatures = typeof dataTableFeatures
