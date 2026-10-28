"use client"

import * as React from "react"
import { Building2Icon } from "lucide-react"
import { toast } from "sonner"

import { setActiveBranch } from "@/app/(app)/branch-actions"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import { InputGroupAddon } from "@/components/ui/input-group"
import type { Branch } from "@/lib/branches"

/** Valor de la opción que representa la vista consolidada. */
const ALL = "all"

interface BranchOption {
  value: string
  label: string
}

/**
 * Buscador de sucursal del sidebar.
 *
 * Al elegir una sucursal se guarda en la cookie `np_branch` y el árbol de
 * Server Components se revalida: inventario, pedidos, caja y reportes pasan a
 * mostrar los datos de ese local.
 */
export function BranchCombobox({
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

  const items = React.useMemo<BranchOption[]>(() => {
    const options: BranchOption[] = branches
      .filter((branch) => branch.isActive)
      .map((branch) => ({ value: branch.id, label: branch.name }))

    // Con sucursal fija no se ofrece el consolidado.
    return locked
      ? options
      : [{ value: ALL, label: "Toda la organización" }, ...options]
  }, [branches, locked])

  const selectedValue = activeBranchId ?? ALL
  const selected = items.find((item) => item.value === selectedValue) ?? null

  function handleChange(value: BranchOption | null) {
    if (locked) return

    const next = !value || value.value === ALL ? null : value.value

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

  return (
    <Combobox
      items={items}
      value={selected}
      onValueChange={handleChange}
      disabled={pending || locked}
    >
      <ComboboxInput
        placeholder={locked ? (selected?.label ?? "Mi sucursal") : "Buscar sucursal"}
        showTrigger={!locked}
        showClear={false}
      >
        <InputGroupAddon align="inline-start">
          <Building2Icon className="size-4 text-muted-foreground" />
        </InputGroupAddon>
      </ComboboxInput>
      <ComboboxContent>
        <ComboboxEmpty>Sin resultados.</ComboboxEmpty>
        <ComboboxList>
          {(item: BranchOption) => (
            <ComboboxItem key={item.value} value={item}>
              {item.label}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
