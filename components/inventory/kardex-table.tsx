"use client"

import * as React from "react"
import { createColumnHelper } from "@tanstack/react-table"
import { ClipboardListIcon } from "lucide-react"

import type { DataTableFeatures } from "@/components/data-table/data-table-features"
import {
  DataTable,
  DATA_TABLE_ALL,
  type DataTableFilter,
} from "@/components/data-table/data-table"
import { Badge } from "@/components/ui/badge"
import type { Branch } from "@/lib/branches"
import {
  formatDateTime,
  formatQuantity,
  MOVEMENT_LABELS,
  unitLabel,
  type InventoryMovement,
  type MovementType,
} from "@/lib/catalog"

const columnHelper = createColumnHelper<DataTableFeatures, InventoryMovement>()

const PAGE_SIZES = [15, 30, 50, 100]
const DEFAULT_PAGE_SIZE = 15

const COLUMN_LABELS: Record<string, string> = {
  createdAt: "Fecha",
  product: "Producto",
  branch: "Sucursal",
  type: "Tipo",
  quantity: "Cantidad",
  stockAfter: "Saldo",
  reason: "Motivo",
  user: "Usuario",
}

function MovementColumnHeader({
  title,
  column,
  align = "left",
}: {
  title: string
  column: {
    getCanSort: () => boolean
    getIsSorted: () => false | "asc" | "desc"
    getToggleSortingHandler: () => ((event: unknown) => void) | undefined
  }
  align?: "left" | "right"
}) {
  return (
    <button
      type="button"
      onClick={column.getToggleSortingHandler()}
      className={`inline-flex items-center gap-1 font-medium ${
        align === "right" ? "w-full justify-end" : ""
      }`}
    >
      {title}
      {column.getIsSorted() === "asc"
        ? "↑"
        : column.getIsSorted() === "desc"
          ? "↓"
          : ""}
    </button>
  )
}

/**
 * Kardex de movimientos de inventario.
 *
 * Muestra la cantidad y el saldo en la unidad visible del producto (la API ya
 * los devuelve convertidos desde la unidad canónica).
 */
export function KardexTable({
  movements,
  branch,
}: {
  movements: InventoryMovement[]
  /** Sucursal activa; `null` = vista consolidada. */
  branch: Branch | null
}) {
  const [typeFilter, setTypeFilter] = React.useState<string>(DATA_TABLE_ALL)
  const [globalFilter, setGlobalFilter] = React.useState("")

  const filtered = React.useMemo(() => {
    const term = globalFilter.trim().toLowerCase()

    return movements.filter((movement) => {
      if (typeFilter !== DATA_TABLE_ALL && movement.type !== typeFilter) {
        return false
      }

      if (!term) return true

      const userName = movement.user?.name ?? movement.user?.email ?? ""

      return (
        movement.ingredientName.toLowerCase().includes(term) ||
        (movement.reason ?? "").toLowerCase().includes(term) ||
        userName.toLowerCase().includes(term)
      )
    })
  }, [movements, typeFilter, globalFilter])

  const filters = React.useMemo<DataTableFilter[]>(
    () => [
      {
        id: "type",
        ariaLabel: "Filtrar por tipo de movimiento",
        placeholder: "Tipo",
        allLabel: "Todos los tipos",
        value: typeFilter,
        onValueChange: setTypeFilter,
        options: [
          { value: DATA_TABLE_ALL, label: "Todos los tipos" },
          ...(Object.keys(MOVEMENT_LABELS) as MovementType[]).map((type) => ({
            value: type,
            label: MOVEMENT_LABELS[type],
          })),
        ],
      },
    ],
    [typeFilter]
  )

  const activeFilterCount =
    (globalFilter.trim().length > 0 ? 1 : 0) +
    (typeFilter !== DATA_TABLE_ALL ? 1 : 0)

  const columns = React.useMemo(
    () =>
      columnHelper.columns([
        columnHelper.accessor((row) => row.createdAt, {
          id: "createdAt",
          header: ({ column }) => (
            <MovementColumnHeader title="Fecha" column={column} />
          ),
          cell: ({ row }) => (
            <span className="whitespace-nowrap text-muted-foreground">
              {formatDateTime(row.original.createdAt)}
            </span>
          ),
          sortFn: "datetime",
        }),
        columnHelper.accessor((row) => row.ingredientName, {
          id: "product",
          header: ({ column }) => (
            <MovementColumnHeader title="Producto" column={column} />
          ),
          cell: ({ row }) => (
            <span className="flex items-center gap-1.5 font-medium">
              {row.original.ingredientName}
              {row.original.ingredient === null ? (
                <span className="text-xs font-normal text-muted-foreground">
                  (eliminado)
                </span>
              ) : null}
            </span>
          ),
          sortFn: "text",
        }),
        columnHelper.accessor((row) => row.branch?.name ?? "", {
          id: "branch",
          header: ({ column }) => (
            <MovementColumnHeader title="Sucursal" column={column} />
          ),
          cell: ({ row }) => (
            <span className="text-muted-foreground">
              {row.original.branch?.name ?? "—"}
            </span>
          ),
          sortFn: "text",
        }),
        columnHelper.accessor((row) => row.type, {
          id: "type",
          header: ({ column }) => (
            <MovementColumnHeader title="Tipo" column={column} />
          ),
          cell: ({ row }) => (
            <Badge
              variant={
                row.original.type === "ADJUSTMENT" ? "outline" : "secondary"
              }
            >
              {MOVEMENT_LABELS[row.original.type]}
            </Badge>
          ),
          enableSorting: false,
        }),
        columnHelper.accessor((row) => Number(row.quantity), {
          id: "quantity",
          header: ({ column }) => (
            <MovementColumnHeader title="Cantidad" column={column} align="right" />
          ),
          cell: ({ row }) => {
            const amount = Number(row.original.quantity)

            return (
              <div
                className={`text-right whitespace-nowrap tabular-nums ${
                  amount < 0
                    ? "text-destructive"
                    : "text-emerald-600 dark:text-emerald-400"
                }`}
              >
                {amount > 0 ? "+" : ""}
                {formatQuantity(row.original.quantity)}{" "}
                {unitLabel(row.original.displayUnit)}
              </div>
            )
          },
          sortFn: "basic",
        }),
        columnHelper.accessor(
          (row) => (row.stockAfter === null ? null : Number(row.stockAfter)),
          {
            id: "stockAfter",
            header: ({ column }) => (
              <MovementColumnHeader title="Saldo" column={column} align="right" />
            ),
            cell: ({ row }) =>
              row.original.stockAfter === null ? (
                <div className="text-right text-muted-foreground">—</div>
              ) : (
                <div className="text-right whitespace-nowrap tabular-nums">
                  {formatQuantity(row.original.stockAfter)}{" "}
                  <span className="text-muted-foreground">
                    {unitLabel(row.original.displayUnit)}
                  </span>
                </div>
              ),
            sortFn: "basic",
          }
        ),
        columnHelper.accessor((row) => row.reason ?? "", {
          id: "reason",
          header: () => <span className="font-medium">Motivo</span>,
          cell: ({ row }) => (
            <span className="text-muted-foreground">
              {row.original.reason ?? "—"}
            </span>
          ),
          enableSorting: false,
        }),
        columnHelper.display({
          id: "user",
          header: () => <span className="font-medium">Usuario</span>,
          cell: ({ row }) => (
            <span className="text-muted-foreground">
              {row.original.user
                ? (row.original.user.name ?? row.original.user.email ?? "—")
                : "Usuario eliminado"}
            </span>
          ),
          enableSorting: false,
          enableGlobalFilter: false,
        }),
      ]),
    []
  )

  return (
    <DataTable
      idPrefix="kardex"
      data={filtered}
      columns={columns}
      getRowId={(movement) => movement.id}
      pageResetKey={`${globalFilter}|${typeFilter}`}
      initialSorting={[{ id: "createdAt", desc: true }]}
      search={{
        label: "Buscar movimiento",
        placeholder: "Buscar por producto, motivo o usuario...",
        value: globalFilter,
        onValueChange: setGlobalFilter,
      }}
      filters={filters}
      activeFilterCount={activeFilterCount}
      onClearFilters={() => {
        setGlobalFilter("")
        setTypeFilter(DATA_TABLE_ALL)
      }}
      columnLabels={COLUMN_LABELS}
      emptyState={
        <div className="flex flex-col items-center gap-1 text-muted-foreground">
          <ClipboardListIcon className="size-6" />
          <p>Todavía no hay movimientos de inventario.</p>
        </div>
      }
      filteredEmptyState={
        <div className="flex flex-col items-center gap-1 text-muted-foreground">
          <ClipboardListIcon className="size-6" />
          <p>No hay movimientos que coincidan con los filtros.</p>
        </div>
      }
      summary={
        <>
          {filtered.length} movimiento{filtered.length === 1 ? "" : "s"}
          {branch ? ` · ${branch.name}` : " · Toda la organización"}.
        </>
      }
      pageSizeOptions={PAGE_SIZES}
      defaultPageSize={DEFAULT_PAGE_SIZE}
    />
  )
}
