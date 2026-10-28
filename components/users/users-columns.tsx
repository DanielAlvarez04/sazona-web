"use client"

import { createColumnHelper } from "@tanstack/react-table"
import {
  ChevronDownIcon,
  ChevronsUpDownIcon,
  ChevronUpIcon,
  CopyIcon,
  CheckIcon,
  EllipsisVerticalIcon,
  PencilIcon,
  Trash2Icon,
  UserCheckIcon,
  UserXIcon,
} from "lucide-react"
import { useState } from "react"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ROLE_OPTIONS, type InternalUser } from "@/lib/users"

import type { UsersTableFeatures } from "./data-table-features"

function CopyIdButton({
  display,
}: {
  display: string
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(display)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Tooltip>
      <TooltipTrigger>
        <span
          className="inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:pointer-events-none transition-colors cursor-pointer"
          onClick={handleCopy}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              handleCopy()
            }
          }}
          aria-label={copied ? "ID copiado" : "Copiar ID de usuario"}
        >
          {copied ? <CheckIcon className="size-4 text-green-500" /> : <CopyIcon className="size-4" />}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">
        {copied ? "ID copiado" : "Copiar ID de usuario"}
      </TooltipContent>
    </Tooltip>
  )
}

const columnHelper = createColumnHelper<UsersTableFeatures, InternalUser>()

/** Interfaz mínima de columna que necesitan los headers ordenables. */
interface SortableColumn {
  getCanSort: () => boolean
  getIsSorted: () => false | "asc" | "desc"
  getToggleSortingHandler: () => ((event: unknown) => void) | undefined
}

function UserColumnHeader({
  title,
  column,
}: {
  title: string
  column: SortableColumn
}) {
  if (!column.getCanSort()) {
    return <span className="font-medium">{title}</span>
  }

  const sorted = column.getIsSorted()

  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-2 h-8 data-[sorted=true]:bg-accent"
      data-sorted={sorted !== false}
      onClick={column.getToggleSortingHandler()}
    >
      {title}
      {sorted === "asc" ? (
        <ChevronUpIcon data-icon="inline-end" />
      ) : sorted === "desc" ? (
        <ChevronDownIcon data-icon="inline-end" />
      ) : (
        <ChevronsUpDownIcon
          data-icon="inline-end"
          className="text-muted-foreground"
        />
      )}
    </Button>
  )
}

function roleLabel(role: string) {
  return ROLE_OPTIONS.find((option) => option.value === role)?.label ?? role
}

export interface UserRowActions {
  /** Usuario de la sesión: no se puede eliminar ni desactivar a sí mismo. */
  currentUserId: string
  onEdit: (user: InternalUser) => void
  onRequestDelete: (users: InternalUser[]) => void
  onToggleActive: (user: InternalUser) => void
  /** Hay una mutación en curso para ese usuario (desactiva el menú). */
  isPending: (user: InternalUser) => boolean
}

function UserRowActionsMenu({
  user,
  currentUserId,
  onEdit,
  onRequestDelete,
  onToggleActive,
  isPending,
}: UserRowActions & { user: InternalUser }) {
  const isSelf = user.id === currentUserId
  const pending = isPending(user)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground aria-expanded:bg-muted"
            disabled={pending}
            aria-label={`Acciones de ${user.name ?? user.username ?? "usuario"}`}
          />
        }
      >
        <EllipsisVerticalIcon />
        <span className="sr-only">Abrir menú</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Acciones</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => onEdit(user)}>
            <PencilIcon />
            Editar
          </DropdownMenuItem>
          {user.isActive ? (
            <DropdownMenuItem
              onClick={() => onToggleActive(user)}
              disabled={isSelf}
            >
              <UserXIcon />
              Desactivar
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => onToggleActive(user)}>
              <UserCheckIcon />
              Activar
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() => onRequestDelete([user])}
          disabled={isSelf}
        >
          <Trash2Icon />
          Eliminar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * Definición de columnas de la tabla de usuarios.
 *
 * Se construye como factory porque las acciones de fila necesitan callbacks del
 * componente que tiene el estado (diálogos, mutaciones en curso).
 */
export function createUserColumns(actions: UserRowActions) {
  return columnHelper.columns([
    columnHelper.display({
      id: "select",
      header: ({ table }) => (
        <div className="flex items-center justify-center">
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            indeterminate={
              table.getIsSomePageRowsSelected() &&
              !table.getIsAllPageRowsSelected()
            }
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Seleccionar todas las filas de la página"
          />
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex items-center justify-center">
          <Checkbox
            checked={row.getIsSelected()}
            disabled={!row.getCanSelect()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label={`Seleccionar ${row.original.name ?? row.original.username ?? "usuario"}`}
          />
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
      enableGlobalFilter: false,
    }),
    columnHelper.accessor("name", {
      header: ({ column }) => <UserColumnHeader title="Nombre" column={column} />,
      cell: ({ row }) => (
        <div className="font-medium">
          {row.original.name ?? row.original.username ?? "Sin nombre"}
          {row.original.id === actions.currentUserId ? (
            <span className="ml-2 text-xs text-muted-foreground">(tú)</span>
          ) : null}
        </div>
      ),
      sortFn: "text",
    }),
    columnHelper.accessor("username", {
      header: ({ column }) => (
        <UserColumnHeader title="ID / Usuario" column={column} />
      ),
      cell: ({ row }) => {
        const display = row.original.email ?? row.original.username ?? "Sin usuario"
        return (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-foreground whitespace-nowrap">{display}</span>
            <CopyIdButton display={display} />
          </div>
        )
      },
      sortFn: "text",
    }),
    columnHelper.accessor("roles", {
      header: () => <span className="font-medium">Roles</span>,
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {row.original.roles.length > 0 ? (
            row.original.roles.map((role) => (
              <Badge key={role} variant="outline" className="px-2 py-1 text-xs">
                {roleLabel(role)}
              </Badge>
            ))
          ) : (
            <span className="text-xs text-muted-foreground">Sin roles</span>
          )}
        </div>
      ),
      // En v9 el segundo argumento es el id de la columna; el valor del filtro
      // llega en el tercero.
      filterFn: (row, _columnId, filterValue) => {
        const selected = (filterValue ?? []) as string[]
        if (selected.length === 0) return true
        return row.original.roles.some((role) => selected.includes(role))
      },
      enableSorting: false,
      enableGlobalFilter: false,
    }),
    columnHelper.display({
      id: "branch",
      header: () => <span className="font-medium">Sucursal</span>,
      cell: ({ row }) =>
        row.original.branchName ? (
          <span className="text-sm">{row.original.branchName}</span>
        ) : (
          <span className="text-xs text-muted-foreground">Todas</span>
        ),
      enableSorting: false,
      enableGlobalFilter: false,
    }),
    columnHelper.accessor("isActive", {
      header: () => <span className="font-medium">Estado</span>,
      cell: ({ row }) => (
        <Badge variant={row.original.isActive ? "secondary" : "outline"}>
          {row.original.isActive ? "Activo" : "Inactivo"}
        </Badge>
      ),
      enableSorting: false,
      enableGlobalFilter: false,
    }),
    columnHelper.display({
      id: "actions",
      header: () => <span className="sr-only">Acciones</span>,
      cell: ({ row }) => (
        <div className="flex items-center justify-center">
          <UserRowActionsMenu user={row.original} {...actions} />
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
      enableGlobalFilter: false,
    }),
  ])
}
