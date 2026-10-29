"use client"

import * as React from "react"
import { Building2Icon } from "lucide-react"
import { toast } from "sonner"

import { setActiveBranch } from "@/app/(app)/branch-actions"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Branch } from "@/lib/branches"

/** Valor de la opción que representa la vista consolidada. */
const ALL = "all"

/**
 * Selector de sucursal del sidebar.
 *
 * Al elegir una sucursal se guarda en la cookie `np_branch` y el árbol de
 * Server Components se revalida: inventario, pedidos, caja y reportes pasan a
 * mostrar los datos de ese local.
 *
 * "Todas las sucursales" solo aparece cuando hay más de una; con una sola
 * sucursal el selector queda fijado a su nombre.
 */
export function BranchSelect({
  branches,
  activeBranchId,
  locked = false,
}: {
  branches: Branch[]
  activeBranchId: string | null
  /** `true` cuando el miembro está asignado a una sucursal fija. */
  locked?: boolean
}) {
  const [pending, startTransition] = React.useTransition()

  const activeBranches = React.useMemo(
    () => branches.filter((branch) => branch.isActive),
    [branches]
  )

  const showAll = !locked && activeBranches.length > 1

  const items = React.useMemo(
    () => [
      ...(showAll ? [{ value: ALL, label: "Todas las sucursales" }] : []),
      ...activeBranches.map((branch) => ({
        value: branch.id,
        label: branch.name,
      })),
    ],
    [activeBranches, showAll]
  )

  function handleChange(value: string | null) {
    if (locked || !showAll) return

    const next = !value || value === ALL ? null : value

    startTransition(async () => {
      const result = await setActiveBranch(next)

      if (!result.ok) {
        toast.error(result.message ?? "No se pudo cambiar de sucursal.")
      } else {
        // Recargar la página para reflejar el cambio de sucursal en los Server Components
        window.location.reload()
      }
    })
  }

  if (activeBranches.length === 0) {
    return null
  }

  const selectedValue =
    items.find((item) => item.value === activeBranchId)?.value ??
    (showAll ? ALL : items[0].value)

  return (
    <Select
      items={items}
      value={selectedValue}
      onValueChange={handleChange}
      disabled={pending || locked || !showAll}
    >
      <SelectTrigger className="w-full bg-background">
        <Building2Icon className="size-4 text-muted-foreground" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="bg-background">
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
