"use client"

import * as React from "react"
import { NotebookTextIcon, PlusIcon, XIcon } from "lucide-react"

import {
  DataTable,
  DATA_TABLE_ALL,
  type DataTableFilter,
  type DataTableViewMode,
} from "@/components/data-table/data-table"
import { Button } from "@/components/ui/button"
import {
  isMenuAvailableNow,
  isMenuScheduled,
  MENU_DAY_LABELS,
  menuMatchesDay,
  type Menu,
} from "@/lib/menus"

import { MenuCards } from "./menu-card"
import {
  createMenuColumns,
  type MenuRowActions,
} from "./menus-columns"

const DAY_OPTIONS = [
  ...([1, 2, 3, 4, 5, 6, 0] as const).map((day) => ({
    value: String(day),
    label: MENU_DAY_LABELS[day],
  })),
]

export function MenusTable({
  menus,
  imageById,
  actions,
  canManage,
  viewMode,
  onViewModeChange,
  now,
  onCreate,
}: {
  menus: Menu[]
  imageById: Map<string, string | null>
  actions: MenuRowActions
  canManage: boolean
  viewMode: DataTableViewMode
  onViewModeChange: (mode: DataTableViewMode) => void
  now: Date | null
  onCreate: () => void
}) {
  const [globalFilter, setGlobalFilter] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState(DATA_TABLE_ALL)
  const [availabilityFilter, setAvailabilityFilter] =
    React.useState(DATA_TABLE_ALL)
  const [dayFilter, setDayFilter] = React.useState(DATA_TABLE_ALL)

  const filtered = React.useMemo(() => {
    const term = globalFilter.trim().toLowerCase()
    const today = now?.getDay() ?? null

    const rows = menus.filter((menu) => {
      if (statusFilter === "active" && !menu.isActive) return false
      if (statusFilter === "inactive" && menu.isActive) return false

      const available = now
        ? isMenuAvailableNow(menu, now)
        : menu.isAvailableNow

      if (availabilityFilter === "now" && (!menu.isActive || !available)) {
        return false
      }
      if (
        availabilityFilter === "outside" &&
        (!menu.isActive || !isMenuScheduled(menu) || available)
      ) {
        return false
      }
      if (
        availabilityFilter === "unscheduled" &&
        isMenuScheduled(menu)
      ) {
        return false
      }

      if (dayFilter !== DATA_TABLE_ALL) {
        const day = dayFilter === "today" ? today : Number(dayFilter)
        if (day === null || !menuMatchesDay(menu, day)) return false
      }

      if (!term) return true

      return (
        menu.name.toLowerCase().includes(term) ||
        (menu.description ?? "").toLowerCase().includes(term) ||
        menu.items.some((entry) =>
          entry.item.name.toLowerCase().includes(term)
        )
      )
    })

    return [...rows].sort(
      (left, right) =>
        left.sortOrder - right.sortOrder ||
        left.name.localeCompare(right.name, "es", {
          sensitivity: "base",
        })
    )
  }, [menus, globalFilter, statusFilter, availabilityFilter, dayFilter, now])

  const filters = React.useMemo<DataTableFilter[]>(
    () => [
      {
        id: "status",
        ariaLabel: "Filtrar por estado",
        placeholder: "Estado",
        allLabel: "Todos",
        value: statusFilter,
        onValueChange: setStatusFilter,
        options: [
          { value: DATA_TABLE_ALL, label: "Todos" },
          { value: "active", label: "Activos" },
          { value: "inactive", label: "Inactivos" },
        ],
      },
      {
        id: "availability",
        ariaLabel: "Filtrar por disponibilidad",
        placeholder: "Disponibilidad",
        allLabel: "Todas",
        value: availabilityFilter,
        onValueChange: setAvailabilityFilter,
        options: [
          { value: DATA_TABLE_ALL, label: "Todas" },
          { value: "now", label: "En horario" },
          { value: "outside", label: "Fuera de horario" },
          { value: "unscheduled", label: "Sin programar" },
        ],
      },
      {
        id: "day",
        ariaLabel: "Filtrar por día",
        placeholder: "Día",
        allLabel: "Todos",
        value: dayFilter,
        onValueChange: setDayFilter,
        options: [
          { value: DATA_TABLE_ALL, label: "Todos" },
          { value: "today", label: "Hoy" },
          ...DAY_OPTIONS,
        ],
      },
    ],
    [statusFilter, availabilityFilter, dayFilter]
  )

  const activeFilterCount =
    (globalFilter.trim().length > 0 ? 1 : 0) +
    (statusFilter !== DATA_TABLE_ALL ? 1 : 0) +
    (availabilityFilter !== DATA_TABLE_ALL ? 1 : 0) +
    (dayFilter !== DATA_TABLE_ALL ? 1 : 0)

  const clearFilters = React.useCallback(() => {
    setGlobalFilter("")
    setStatusFilter(DATA_TABLE_ALL)
    setAvailabilityFilter(DATA_TABLE_ALL)
    setDayFilter(DATA_TABLE_ALL)
  }, [])

  const columns = React.useMemo(
    () => createMenuColumns(actions, imageById),
    [actions, imageById]
  )

  return (
    <DataTable
      idPrefix="menus"
      data={filtered}
      columns={columns}
      getRowId={(menu) => menu.id}
      pageResetKey={`${globalFilter}|${statusFilter}|${availabilityFilter}|${dayFilter}`}
      tableClassName="[&_td]:py-2"
      layout="sidebar"
      search={{
        label: "Buscar menú",
        placeholder: "Buscar por menú o artículo",
        value: globalFilter,
        onValueChange: setGlobalFilter,
      }}
      filters={filters}
      activeFilterCount={activeFilterCount}
      onClearFilters={clearFilters}
      showColumnToggle={false}
      viewMode={viewMode}
      onViewModeChange={onViewModeChange}
      defaultCardColumns={3}
      cardColumnRange={{ min: 2, max: 4 }}
      cardColumnsStorageKey="menus-card-columns"
      cardsView={(rows) => (
        <MenuCards
          menus={rows}
          imageById={imageById}
          actions={actions}
          now={now}
        />
      )}
      actions={
        canManage ? (
          <Button className="w-full" onClick={onCreate}>
            <PlusIcon className="size-4 shrink-0" />
            <span className="truncate">Nuevo menú</span>
          </Button>
        ) : null
      }
      emptyState={
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <NotebookTextIcon className="size-7" />
          <div>
            <p className="font-medium text-foreground">Todavía no hay menús</p>
            <p className="text-sm">
              Crea el menú infantil, el nocturno o cualquier colección que
              quieras usar como filtro en el POS.
            </p>
          </div>
          {canManage ? (
            <Button size="sm" onClick={onCreate}>
              Crear el primer menú
            </Button>
          ) : null}
        </div>
      }
      filteredEmptyState={
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <NotebookTextIcon className="size-7" />
          <p>No hay menús que coincidan con los filtros.</p>
          <Button variant="outline" size="sm" onClick={clearFilters}>
            <XIcon className="size-4" />
            Limpiar filtros
          </Button>
        </div>
      }
      summary={
        <>
          {filtered.length} menú{filtered.length === 1 ? "" : "s"}
          {activeFilterCount > 0 ? " (filtrados)" : ""}.
        </>
      }
    />
  )
}
