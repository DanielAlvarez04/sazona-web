"use client"

import * as React from "react"
import {
  PencilIcon,
  Trash2Icon,
  UserCheckIcon,
  UserPlusIcon,
  UserXIcon,
} from "lucide-react"
import { toast } from "sonner"
import type { RowSelectionState } from "@tanstack/react-table"

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
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuGroupLabel,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu"
import {
  DataTable,
  DATA_TABLE_ALL,
  type DataTableFilter,
} from "@/components/data-table/data-table"
import { CreateUserDialog, EditUserDialog } from "@/components/users/user-dialogs"
import { createUserColumns } from "@/components/users/users-columns"
import type { Branch } from "@/lib/branches"
import { ROLE_OPTIONS, type InternalUser } from "@/lib/users"
import {
  activateInternalUser,
  deactivateInternalUser,
  deleteUserFromOrg,
  deleteUsersFromOrg,
  purgeDeletedUsers,
} from "@/app/(app)/users/actions"

const PAGE_SIZES = [10, 20, 30, 40, 50]
const DEFAULT_PAGE_SIZE = 10

/** Etiquetas legibles para el selector de columnas. */
const COLUMN_LABELS: Record<string, string> = {
  name: "Nombre",
  username: "ID / Usuario",
  roles: "Roles",
  branch: "Sucursal",
  isActive: "Estado",
}

function userName(user: InternalUser) {
  return user.name ?? user.username ?? user.email ?? "este usuario"
}

export function UsersTable({
  users,
  branches,
  currentUserId,
  organizationDomain,
}: {
  users: InternalUser[]
  branches: Branch[]
  currentUserId: string
  organizationDomain: string
}) {
  const [creating, setCreating] = React.useState(false)
  const [editing, setEditing] = React.useState<InternalUser | null>(null)
  const [globalFilter, setGlobalFilter] = React.useState("")
  const [roleFilter, setRoleFilter] = React.useState<string>(DATA_TABLE_ALL)
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})

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

  /** Filtrado local: texto (nombre, usuario o correo) y rol. */
  const filteredUsers = React.useMemo(() => {
    const term = globalFilter.trim().toLowerCase()

    return users.filter((user) => {
      if (term) {
        const haystack = [user.name, user.username, user.email]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
        if (!haystack.includes(term)) return false
      }
      if (
        roleFilter !== DATA_TABLE_ALL &&
        !user.roles.some((role) => role === roleFilter)
      ) {
        return false
      }
      return true
    })
  }, [users, globalFilter, roleFilter])

  const filters = React.useMemo<DataTableFilter[]>(
    () => [
      {
        id: "role",
        ariaLabel: "Filtrar por rol",
        placeholder: "Todos los roles",
        allLabel: "Todos los roles",
        value: roleFilter,
        onValueChange: setRoleFilter,
        options: [
          { value: DATA_TABLE_ALL, label: "Todos los roles" },
          ...ROLE_OPTIONS.map((role) => ({
            value: role.value,
            label: role.label,
          })),
        ],
      },
    ],
    [roleFilter]
  )

  const selectedUsers = React.useMemo(
    () => filteredUsers.filter((user) => rowSelection[user.id]),
    [filteredUsers, rowSelection]
  )
  const selectedCount = selectedUsers.length
  const inactiveCount = users.filter((user) => !user.isActive).length
  const activeFilterCount =
    (globalFilter.trim().length > 0 ? 1 : 0) +
    (roleFilter !== DATA_TABLE_ALL ? 1 : 0)

  const clearFilters = React.useCallback(() => {
    setGlobalFilter("")
    setRoleFilter(DATA_TABLE_ALL)
  }, [])

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

      setRowSelection({})
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
        setRowSelection({})
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
          branches={branches}
        />
      ) : null}
      {editing ? (
        <EditUserDialog
          user={editing}
          isSelf={editing.id === currentUserId}
          onClose={() => setEditing(null)}
          branches={branches}
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
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={busy}
            >
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

      <DataTable
        idPrefix="users"
        data={filteredUsers}
        columns={columns}
        getRowId={(user) => user.id}
        pageResetKey={`${globalFilter}|${roleFilter}`}
        search={{
          label: "Buscar usuario",
          placeholder: "Buscar por nombre, usuario o correo...",
          value: globalFilter,
          onValueChange: setGlobalFilter,
        }}
        filters={filters}
        activeFilterCount={activeFilterCount}
        onClearFilters={clearFilters}
        columnLabels={COLUMN_LABELS}
        rowSelection={rowSelection}
        onRowSelectionChange={setRowSelection}
        // El propio usuario no puede eliminarse ni desactivarse, así que tampoco
        // se puede seleccionar para acciones en bloque.
        enableRowSelection={(user) => user.id !== currentUserId}
        actions={
          <>
            {selectedCount > 0 ? (
              <Button
                variant="destructive"
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
                onClick={() => setConfirmingPurge(true)}
                disabled={busy}
              >
                <Trash2Icon />
                {`Eliminar inactivos (${inactiveCount})`}
              </Button>
            ) : null}

            <Button onClick={() => setCreating(true)}>
              <UserPlusIcon />
              <span className="hidden lg:inline">Añadir usuario</span>
            </Button>
          </>
        }
        rowContextMenu={(user) => {
          const isSelf = user.id === currentUserId
          const pending = pendingIds.includes(user.id)

          return (
            <ContextMenuContent align="end">
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
          )
        }}
        emptyState={
          <p className="text-muted-foreground">
            Todavía no hay usuarios. Crea el primero para que tu equipo pueda
            entrar.
          </p>
        }
        filteredEmptyState={
          <p className="text-muted-foreground">
            No hay usuarios que coincidan con la búsqueda o los filtros.
          </p>
        }
        summary={
          <>
            {selectedCount} de {filteredUsers.length} fila(s) seleccionada(s).
          </>
        }
        pageSizeOptions={PAGE_SIZES}
        defaultPageSize={DEFAULT_PAGE_SIZE}
      />
    </div>
  )
}
