"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { Loader2Icon, PlusIcon, SaveIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"

import { createIngredientsBulk } from "@/app/(app)/inventory/actions"
import { Button } from "@/components/ui/button"
import { FieldError } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { UnitOptions } from "@/components/ui/unit-options"
import { UNIT_SELECT_ITEMS, type UnitCode } from "@/lib/catalog"

interface BulkRow {
  key: string
  name: string
  sku: string
  baseUnit: UnitCode
  categoryId: string
  locationId: string
  unitCost: string
  maxStock: string
  currentStock: string
  minStock: string
}

let rowCounter = 0

function emptyRow(): BulkRow {
  rowCounter += 1
  return {
    key: `row-${rowCounter}`,
    name: "",
    sku: "",
    baseUnit: "UNIT",
    categoryId: "",
    locationId: "",
    unitCost: "",
    maxStock: "",
    currentStock: "",
    minStock: "",
  }
}

function parseQuantity(value: string): number {
  const trimmed = value.trim()
  if (trimmed === "") return 0
  return Number(trimmed.replace(",", "."))
}

/**
 * Alta de varios ingredientes en una sola operación.
 *
 * La API valida la lista completa (nombres repetidos, duplicados en la base)
 * antes de crear nada, así que un error no deja altas a medias.
 */
export function BulkIngredientsSheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [rows, setRows] = useState<BulkRow[]>([emptyRow()])
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const named = rows.filter((row) => row.name.trim().length > 0)

  function updateRow(key: string, patch: Partial<BulkRow>) {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row))
    )
  }

  function reset() {
    setRows([emptyRow()])
    setError(null)
  }

  async function handleSubmit() {
    setError(null)

    if (named.length === 0) {
      setError("Escribe al menos un ingrediente.")
      return
    }

    const invalid = named.find(
      (row) => !Number.isFinite(parseQuantity(row.currentStock)) ||
        !Number.isFinite(parseQuantity(row.minStock))
    )

    if (invalid) {
      setError(`Revisa las cantidades de "${invalid.name.trim()}".`)
      return
    }

    setPending(true)

    try {
      const result = await createIngredientsBulk(
        named.map((row) => ({
          name: row.name.trim(),
          baseUnit: row.baseUnit,
          currentStock: parseQuantity(row.currentStock),
          minStock: parseQuantity(row.minStock),
        }))
      )

      if (!result.ok) {
        setError(result.message ?? "No se pudieron crear los ingredientes")
        return
      }

      toast.success(
        named.length === 1
          ? "Ingrediente creado"
          : `${named.length} ingredientes creados`
      )
      reset()
      onOpenChange(false)
      router.refresh()
    } finally {
      setPending(false)
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <SheetContent
        side="right"
        className="data-[side=right]:sm:max-w-2xl"
        showCloseButton={!pending}
      >
        <SheetHeader>
          <SheetTitle>Añadir varios ingredientes</SheetTitle>
          <SheetDescription>
            Cada ingrediente se guarda con su stock inicial como movimiento de
            ajuste. Deja las cantidades vacías si aún no tienes stock.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-4">
          <div className="grid gap-2 pb-1 text-xs font-medium text-muted-foreground sm:grid-cols-[1fr_6rem_6rem_6rem_6rem_6rem_6rem_7rem_7rem_2rem]">
            <span>Nombre</span>
            <span>SKU</span>
            <span>Unidad</span>
            <span>Categoría</span>
            <span>Ubicación</span>
            <span>Costo unit.</span>
            <span>Máx.</span>
            <span>Stock inicial</span>
            <span>Mínimo</span>
            <span className="sr-only">Acciones</span>
          </div>

          {rows.map((row, index) => (
            <div
              key={row.key}
              className="grid gap-2 rounded-lg border p-2 sm:grid-cols-[1fr_6rem_6rem_6rem_6rem_6rem_6rem_7rem_7rem_2rem] sm:items-center sm:border-0 sm:p-0"
            >
              <Input
                value={row.name}
                onChange={(event) =>
                  updateRow(row.key, { name: event.target.value })
                }
                placeholder={`Ingrediente ${index + 1}`}
                maxLength={120}
                aria-label={`Nombre del ingrediente ${index + 1}`}
              />

              <Input
                value={row.sku}
                onChange={(event) =>
                  updateRow(row.key, { sku: event.target.value })
                }
                placeholder="SKU"
                maxLength={60}
                aria-label={`SKU del ingrediente ${index + 1}`}
              />

              <Select
                value={row.baseUnit}
                onValueChange={(value) =>
                  updateRow(row.key, { baseUnit: value as UnitCode })
                }
                items={UNIT_SELECT_ITEMS}
              >
                <SelectTrigger
                  className="w-full"
                  aria-label={`Unidad del ingrediente ${index + 1}`}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <UnitOptions />
                </SelectContent>
              </Select>

              <Select
                value={row.categoryId}
                onValueChange={(value) =>
                  updateRow(row.key, { categoryId: value ?? "" })
                }
                items={[
                  { value: "", label: "Sin categoría" },
                  ...UNIT_SELECT_ITEMS, // Placeholder - will need actual categories
                ]}
              >
                <SelectTrigger className="w-full" aria-label={`Categoría del ingrediente ${index + 1}`}>
                  <SelectValue placeholder="Categoría" />
                </SelectTrigger>
                <SelectContent>
                  <option value="">Sin categoría</option>
                </SelectContent>
              </Select>

              <Select
                value={row.locationId}
                onValueChange={(value) =>
                  updateRow(row.key, { locationId: value ?? "" })
                }
                items={[
                  { value: "", label: "Sin ubicación" },
                  ...UNIT_SELECT_ITEMS, // Placeholder - will need actual locations
                ]}
              >
                <SelectTrigger className="w-full" aria-label={`Ubicación del ingrediente ${index + 1}`}>
                  <SelectValue placeholder="Ubicación" />
                </SelectTrigger>
                <SelectContent>
                  <option value="">Sin ubicación</option>
                </SelectContent>
              </Select>

              <Input
                value={row.unitCost}
                onChange={(event) =>
                  updateRow(row.key, { unitCost: event.target.value })
                }
                type="number"
                min="0"
                step="0.01"
                placeholder="0"
                inputMode="decimal"
                aria-label={`Costo unitario del ingrediente ${index + 1}`}
              />

              <Input
                value={row.maxStock}
                onChange={(event) =>
                  updateRow(row.key, { maxStock: event.target.value })
                }
                type="number"
                min="0"
                step="0.0001"
                inputMode="decimal"
                placeholder="0"
                aria-label={`Stock máximo del ingrediente ${index + 1}`}
              />

              <Input
                value={row.currentStock}
                onChange={(event) =>
                  updateRow(row.key, { currentStock: event.target.value })
                }
                inputMode="decimal"
                placeholder="0"
                aria-label={`Stock inicial del ingrediente ${index + 1}`}
              />

              <Input
                value={row.minStock}
                onChange={(event) =>
                  updateRow(row.key, { minStock: event.target.value })
                }
                inputMode="decimal"
                placeholder="0"
                aria-label={`Stock mínimo del ingrediente ${index + 1}`}
              />

              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Quitar ingrediente ${index + 1}`}
                disabled={pending || rows.length === 1}
                onClick={() =>
                  setRows((current) =>
                    current.length === 1
                      ? current
                      : current.filter((item) => item.key !== row.key)
                  )
                }
              >
                <Trash2Icon />
              </Button>
            </div>
          ))}

          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => setRows((current) => [...current, emptyRow()])}
            >
              <PlusIcon />
              Añadir fila
            </Button>
          </div>

          {error ? <FieldError>{error}</FieldError> : null}
        </div>

        <SheetFooter className="flex-row justify-end gap-2 border-t">
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button type="button" disabled={pending} onClick={handleSubmit}>
            {pending ? (
              <Loader2Icon className="animate-spin" />
            ) : (
              <SaveIcon />
            )}
            Crear {named.length > 0 ? `${named.length} ` : ""}ingrediente
            {named.length === 1 ? "" : "s"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
