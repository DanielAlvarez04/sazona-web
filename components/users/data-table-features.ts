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
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
} from "@tanstack/react-table"

/**
 * Features de TanStack Table v9 que usa la tabla de usuarios.
 *
 * En v9 las features son opt-in y las funciones de ordenación/filtrado deben
 * registrarse explícitamente; si no se registran, quedan fuera del bundle y la
 * tabla falla al ordenar o filtrar en tiempo de ejecución.
 *
 * Se exporta como módulo para compartir el mismo objeto (y el tipo derivado)
 * entre las columnas y el componente de la tabla.
 */
export const usersTableFeatures = tableFeatures({
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
    text: sortFn_text,
    datetime: sortFn_datetime,
  },
})

export type UsersTableFeatures = typeof usersTableFeatures
