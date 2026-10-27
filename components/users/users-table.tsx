"use client"

import * as React from "react"
import {
  FlexRender,
  useTable,
  type ColumnFiltersState,
  type ColumnVisibilityState,
  type RowSelectionState,
  type SortingState,
} from "@tanstack/react-table"
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  PencilIcon,
  SearchIcon,
  Trash2Icon,
  UserCheckIcon,
  UserPlusIcon,
  UserXIcon,
} from "lucide-react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuGroupLabel,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
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
import { CreateUserDialog, EditUserDialog } from "@/components/users/user-dialogs"
import { usersTableFeatures } from "@/components/users/data-table-features"
import { createUserColumns } from "@/components/users/users-columns"
import { ROLE_OPTIONS, type InternalUser } from "@/lib/users"
import {
  activateInternalUser,
  deactivateInternalUser,
  deleteUserFromOrg,
  deleteUsersFromOrg,
  purgeDeletedUsers,
} from "@/app/(app)/users/actions"

const PAGE_SIZES = [10, 20, 30, 40, 50]

/** Etiquetas legibles para el selector de columnas. */
const COLUMN_LABELS: Record<string, string> = {
  name: "Nombre",
  username: "ID / Usuario",
  roles: "Roles",
  isActive: "Estado",
}

function userName(user: InternalUser) {
  return user.name ?? user.username ?? user.email ?? "este usuario"
}

export function UsersTable({
  users,
  currentUserId,
  organizationDomain,
}: {
  users: InternalUser[]
  currentUserId: string
  organizationDomain: string
}) {
  const [creating, setCreating] = React.useState(false)
  const [editing, setEditing] = React.useState<InternalUser | null>(null)

  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] =
    React.useState<ColumnVisibilityState>({})
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})
  const [globalFilter, setGlobalFilter] = React.useState("")
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 10,
  })

  /** Usuarios a eliminar, pendientes de confirmación. */
  const [deleteTargets, setDeleteTargets] = React.useState<InternalUser[] | null>(
    null
  )
  const [confirmingPurge, setConfirmingPurge] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [pendingIds, setPendingIds] = React.useState<string[]>([])

  const handleEdit = React.useCallback((user: InternalUser) => {
    setEditing(user)
  }, [])

  const handleRequestDelete = React.useCallback((targets: InternalUser[]) => {
    setDeleteTargets(targets)
  }, [])

  const isPending = React.useCallback(
    (user: InternalUser) => pendingIds.includes(user.id),
    [pendingIds]
  )

  const handleToggleActive = React.useCallback(async (user: InternalUser) => {
    setPendingIds((ids) => [...ids, user.id])
    try {
      const result = user.isActive
        ? await deactivateInternalUser(user.id)
        : await activateInternalUser(user.id)

      if (result?.ok) {
        toast.success(
          user.isActive ? "Usuario desactivado" : "Usuario activado"
        )
      } else {
        toast.error(
          result?.message ?? "No se pudo actualizar el estado del usuario"
        )
      }
    } catch {
      toast.error("No se pudo actualizar el estado del usuario")
    } finally {
      setPendingIds((ids) => ids.filter((id) => id !== user.id))
    }
  }, [])

  const columns = React.useMemo(
    () =>
      createUserColumns({
        currentUserId,
        onEdit: handleEdit,
        onRequestDelete: handleRequestDelete,
        onToggleActive: handleToggleActive,
        isPending,
      }),
    [
      currentUserId,
      handleEdit,
      handleRequestDelete,
      handleToggleActive,
      isPending,
    ]
  )

  const table = useTable({
    features: usersTableFeatures,
    data: users,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      globalFilter,
      pagination,
    },
    globalFilterFn: "includesString",
    getRowId: (row) => row.id,
    // El propio usuario no puede eliminarse ni desactivarse, así que tampoco se
    // puede seleccionar para acciones en bloque.
    enableRowSelection: (row) => row.original.id !== currentUserId,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: (value) => {
      setGlobalFilter(value as string)
      setPagination((current) => ({ ...current, pageIndex: 0 }))
    },
    onPaginationChange: setPagination,
  })

  const selectedUsers = table
    .getFilteredSelectedRowModel()
    .rows.map((row) => row.original)
  const selectedCount = selectedUsers.length
  const roleFilter =
    (table.getColumn("roles")?.getFilterValue() as string[] | undefined) ?? []
  const inactiveCount = users.filter((user) => !user.isActive).length
  const filteredRowCount = table.getFilteredRowModel().rows.length

  const handleRoleFilterChange = (value: string | null) => {
    const next = !value || value === "all" ? [] : [value]
    table.getColumn("roles")?.setFilterValue(next.length > 0 ? next : undefined)
    setPagination((current) => ({ ...current, pageIndex: 0 }))
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTargets || deleteTargets.length === 0) return

    setBusy(true)
    try {
      if (deleteTargets.length === 1) {
        const result = await deleteUserFromOrg(deleteTargets[0].id)
        if (result?.ok) {
          toast.success("Usuario eliminado")
        } else {
          toast.error(result?.message ?? "No se pudo eliminar el usuario")
        }
      } else {
        const result = await deleteUsersFromOrg(
          deleteTargets.map((user) => user.id)
        )
        if (result?.ok) {
          const deleted = result.data?.deletedCount ?? deleteTargets.length
          toast.success(`${deleted} usuario(s) eliminados`)
        } else {
          toast.error(result?.message ?? "No se pudieron eliminar los usuarios")
        }
      }

      table.resetRowSelection()
      setDeleteTargets(null)
    } catch {
      toast.error("No se pudieron eliminar los usuarios seleccionados")
    } finally {
      setBusy(false)
    }
  }

  const handlePurge = async () => {
    setBusy(true)
    try {
      const result = await purgeDeletedUsers()
      if (result?.ok) {
        const deleted = result.data?.deletedCount ?? inactiveCount
        toast.success(`${deleted} usuario(s) inactivo(s) eliminados`)
        table.resetRowSelection()
      } else {
        toast.error(
          result?.message ?? "No se pudieron eliminar los usuarios inactivos"
        )
      }
    } catch {
      toast.error("No se pudieron eliminar los usuarios inactivos")
    } finally {
      setBusy(false)
      setConfirmingPurge(false)
    }
  }

  return (
    <div className="@container/main flex flex-1 flex-col gap-4 px-4 py-6 lg:px-6">
      {creating ? (
        <CreateUserDialog
          onClose={() => setCreating(false)}
          organizationDomain={organizationDomain}
        />
      ) : null}
      {editing ? (
        <EditUserDialog
          user={editing}
          isSelf={editing.id === currentUserId}
          onClose={() => setEditing(null)}
        />
      ) : null}

      <AlertDialog
        open={deleteTargets !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTargets(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteTargets && deleteTargets.length > 1
                ? `¿Eliminar ${deleteTargets.length} usuarios?`
                : "¿Eliminar este usuario?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTargets && deleteTargets.length === 1
                ? `${userName(deleteTargets[0])} se eliminará definitivamente de la organización. Sus pedidos, pagos y demás registros se conservan.`
                : "Se eliminarán definitivamente de la organización. Sus pedidos, pagos y demás registros se conservan."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTargets(null)}
              disabled={busy}
            >
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm} disabled={busy}>
              {busy ? "Eliminando…" : "Eliminar"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmingPurge} onOpenChange={setConfirmingPurge}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Eliminar los {inactiveCount} usuarios inactivos?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminarán definitivamente las cuentas desactivadas de la
              organización. Los pedidos, pagos y demás registros que crearon se
              conservan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmingPurge(false)}
              disabled={busy}
            >
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handlePurge} disabled={busy}>
              {busy ? "Eliminando…" : "Eliminar inactivos"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Label htmlFor="users-search" className="sr-only">
              Buscar usuario
            </Label>
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="users-search"
              type="search"
              placeholder="Buscar usuario..."
              value={globalFilter}
              onChange={(event) => {
                setGlobalFilter(event.target.value)
                setPagination((current) => ({ ...current, pageIndex: 0 }))
              }}
              className="h-8 w-[220px] pl-8"
            />
          </div>

          <Label htmlFor="role-filter" className="sr-only">
            Filtrar por rol
          </Label>
          <Select
            id="role-filter"
            value={roleFilter[0] ?? "all"}
            onValueChange={handleRoleFilterChange}
            items={[
              { label: "Todos los roles", value: "all" },
              ...ROLE_OPTIONS.map((role) => ({
                label: role.label,
                value: role.value,
              })),
            ]}
          >
            <SelectTrigger className="h-8 w-[180px]">
              <SelectValue placeholder="Todos los roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los roles</SelectItem>
              {ROLE_OPTIONS.map((role) => (
                <SelectItem key={role.value} value={role.value}>
                  {role.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {selectedCount > 0 ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setDeleteTargets(selectedUsers)}
              disabled={busy}
            >
              <Trash2Icon />
              {busy
                ? "Eliminando…"
                : `Eliminar seleccionados (${selectedCount})`}
            </Button>
          ) : null}

          {inactiveCount > 0 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmingPurge(true)}
              disabled={busy}
            >
              <Trash2Icon />
              {`Eliminar inactivos (${inactiveCount})`}
            </Button>
          ) : null}

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="outline"
                  size="sm"
                  aria-label="Mostrar u ocultar columnas"
                />
              }
            >
              <ChevronDownIcon />
              <span className="hidden lg:inline">Columnas</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
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
                      {COLUMN_LABELS[column.id] ?? column.id}
                    </DropdownMenuCheckboxItem>
                  ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="default" size="sm" onClick={() => setCreating(true)}>
            <UserPlusIcon />
            <span className="hidden lg:inline">Añadir usuario</span>
          </Button>
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
                const user = row.original
                const isSelf = user.id === currentUserId
                const pending = pendingIds.includes(user.id)

                return (
                  <ContextMenu key={row.id}>
                    <ContextMenuTrigger>
                      <TableRow
                        data-state={row.getIsSelected() ? "selected" : undefined}
                        className="data-[open]:bg-accent"
                      >
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id}>
                            <FlexRender cell={cell} />
                          </TableCell>
                        ))}
                      </TableRow>
                    </ContextMenuTrigger>
                    <ContextMenuContent align="end" className="w-48">
                      <ContextMenuGroup>
                        <ContextMenuGroupLabel>Acciones</ContextMenuGroupLabel>
                        <ContextMenuItem
                          onClick={() => handleEdit(user)}
                          disabled={pending}
                        >
                          <PencilIcon />
                          Editar
                        </ContextMenuItem>
                        {user.isActive ? (
                          <ContextMenuItem
                            onClick={() => handleToggleActive(user)}
                            disabled={isSelf || pending}
                          >
                            <UserXIcon />
                            Desactivar
                          </ContextMenuItem>
                        ) : (
                          <ContextMenuItem
                            onClick={() => handleToggleActive(user)}
                            disabled={pending}
                          >
                            <UserCheckIcon />
                            Activar
                          </ContextMenuItem>
                        )}
                      </ContextMenuGroup>
                      <ContextMenuSeparator />
                      <ContextMenuItem
                        variant="destructive"
                        onClick={() => handleRequestDelete([user])}
                        disabled={isSelf || pending}
                      >
                        <Trash2Icon />
                        Eliminar
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                )
              })
            ) : (
              <TableRow>
                <TableCell
                  colSpan={table.getVisibleLeafColumns().length}
                  className="h-24 text-center"
                >
                  {users.length === 0
                    ? "Todavía no hay usuarios. Crea el primero para que tu equipo pueda entrar."
                    : "No hay usuarios que coincidan con la búsqueda o los filtros."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {selectedCount} de {filteredRowCount} fila(s) seleccionada(s).
        </p>

        <div className="flex flex-wrap items-center gap-4">
          <div className="hidden items-center gap-2 sm:flex">
            <Label htmlFor="rows-per-page" className="text-sm font-medium">
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
              <SelectTrigger size="sm" className="w-20" id="rows-per-page">
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
    </div>
  )
}
