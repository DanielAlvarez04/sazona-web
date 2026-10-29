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
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
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
  activeBranch,
  currentUserId,
  organizationDomain,
}: {
  users: InternalUser[]
  branches: Branch[]
  /** Sucursal activa; `null` = vista consolidada de todas las sucursales. */
  activeBranch: Branch | null
  currentUserId: string
  organizationDomain: string
}) {
  const [creating, setCreating] = React.useState(false)
  const [editing, setEditing] = React.useState<InternalUser | null>(null)
  const [globalFilter, setGlobalFilter] = React.useState("")
  const [roleFilter, setRoleFilter] = React.useState<string>(DATA_TABLE_ALL)
  const [branchFilter, setBranchFilter] = React.useState<string>(DATA_TABLE_ALL)
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

  /**
   * Usuarios visibles según la sucursal activa.
   *
   * En una sucursal concreta la API devuelve toda la organización, así que el
   * recorte se hace aquí; en la vista consolidada se muestran todos. Quien no
   * tiene sucursal asignada (`branchId === null`) opera en todas, por lo que es
   * visible desde cualquier sucursal.
   */
  const scopedUsers = React.useMemo(
    () =>
      activeBranch
        ? users.filter(
            (user) =>
              user.branchId === null || user.branchId === activeBranch.id
          )
        : users,
    [users, activeBranch]
  )

  /**
   * Filtro por sucursal efectivo.
   *
   * Solo aplica en la vista consolidada: al cambiar a una sucursal concreta se
   * ignora cualquier valor previo, aunque el estado del componente se conserve.
   */
  const effectiveBranchFilter = activeBranch ? DATA_TABLE_ALL : branchFilter

  /** Filtrado local: texto (nombre, usuario o correo), sucursal y rol. */
  const filteredUsers = React.useMemo(() => {
    const term = globalFilter.trim().toLowerCase()

    return scopedUsers.filter((user) => {
      if (term) {
        const haystack = [user.name, user.username, user.email]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
        if (!haystack.includes(term)) return false
      }
      // Los usuarios sin sucursal (acceso a todas) aparecen en cualquier filtro.
      if (
        effectiveBranchFilter !== DATA_TABLE_ALL &&
        user.branchId !== effectiveBranchFilter &&
        user.branchId !== null
      ) {
        return false
      }
      if (
        roleFilter !== DATA_TABLE_ALL &&
        !user.roles.some((role) => role === roleFilter)
      ) {
        return false
      }
      return true
    })
  }, [scopedUsers, globalFilter, effectiveBranchFilter, roleFilter])

  const filters = React.useMemo<DataTableFilter[]>(() => {
    const list: DataTableFilter[] = []

    // El filtro por sucursal solo tiene sentido en la vista consolidada.
    if (!activeBranch) {
      const branchOptions = branches
        .filter(
          (branch) =>
            branch.isActive ||
            users.some((user) => user.branchId === branch.id)
        )
        .map((branch) => ({ value: branch.id, label: branch.name }))

      list.push({
        id: "branch",
        ariaLabel: "Filtrar por sucursal",
        placeholder: "Todas las sucursales",
        allLabel: "Todas las sucursales",
        value: branchFilter,
        onValueChange: setBranchFilter,
        options: [
          { value: DATA_TABLE_ALL, label: "Todas las sucursales" },
          ...branchOptions,
        ],
      })
    }

    list.push({
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
    })

    return list
  }, [activeBranch, branchFilter, branches, users, roleFilter])

  const selectedUsers = React.useMemo(
    () => filteredUsers.filter((user) => rowSelection[user.id]),
    [filteredUsers, rowSelection]
  )
  const selectedCount = selectedUsers.length
  const inactiveCount = users.filter((user) => !user.isActive).length
  const activeFilterCount =
    (globalFilter.trim().length > 0 ? 1 : 0) +
    (effectiveBranchFilter !== DATA_TABLE_ALL ? 1 : 0) +
    (roleFilter !== DATA_TABLE_ALL ? 1 : 0)

  const clearFilters = React.useCallback(() => {
    setGlobalFilter("")
    setBranchFilter(DATA_TABLE_ALL)
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
          onClose={() => setEditing(null)}
          branches={branches}
          organizationDomain={organizationDomain}
        />
      ) : null}

      <AlertDialog
        open={deleteTargets !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTargets(null)
        }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive">
              <Trash2Icon />
            </AlertDialogMedia>
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
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={busy}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmingPurge} onOpenChange={setConfirmingPurge}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive">
              <Trash2Icon />
            </AlertDialogMedia>
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
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handlePurge}
              disabled={busy}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DataTable
        idPrefix="users"
        data={filteredUsers}
        columns={columns}
        getRowId={(user) => user.id}
        pageResetKey={`${globalFilter}|${effectiveBranchFilter}|${roleFilter}`}
        tableClassName="[&_td]:py-1.5"
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
            {activeBranch
              ? `Todavía no hay usuarios en ${activeBranch.name}.`
              : "Todavía no hay usuarios. Crea el primero para que tu equipo pueda entrar."}
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
            {activeBranch ? (
              <span className="ml-1">Sucursal: {activeBranch.name}.</span>
            ) : null}
          </>
        }
        pageSizeOptions={PAGE_SIZES}
        defaultPageSize={DEFAULT_PAGE_SIZE}
      />
    </div>
  )
}
