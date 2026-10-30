"use client"

import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import {
  CopyIcon,
  Loader2Icon,
  PlusIcon,
  SaveIcon,
  Trash2Icon,
} from "lucide-react"
import { toast } from "sonner"

import { createIngredientsBulk } from "@/app/(app)/inventory/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ClearFieldsButton } from "@/components/ui/clear-fields-button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { FieldError } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { UnitOptions } from "@/components/ui/unit-options"
import {
  UNIT_SELECT_ITEMS,
  unitLabel,
  type IngredientCategory,
  type IngredientLocation,
  type UnitCode,
} from "@/lib/catalog"
import { clearDraft, readDraft, writeDraft } from "@/lib/drafts"
import { cn } from "cn"

interface BulkRow {
  key: string
  name: string
  displayUnit: UnitCode
  categoryId: string
  locationId: string
  unitCost: string
  maxStock: string
  currentStock: string
  minStock: string
}

/** Fila inicial para precargar el diálogo (p. ej. desde el catálogo core). */
export interface BulkIngredientInitialRow {
  name: string
  displayUnit: UnitCode
  categoryId: string
  locationId: string
  unitCost?: string
  maxStock?: string
  currentStock?: string
  minStock?: string
}

let rowCounter = 0

function nextRowKey(): string {
  rowCounter += 1
  return `row-${rowCounter}`
}

function emptyRow(): BulkRow {
  return {
    key: nextRowKey(),
    name: "",
    displayUnit: "UNIT",
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

/** Una fila "tocada" tiene algún dato aunque le falte el nombre. */
function hasData(row: BulkRow): boolean {
  return (
    row.name.trim().length > 0 ||
    row.categoryId !== "" ||
    row.locationId !== "" ||
    row.unitCost.trim() !== "" ||
    row.maxStock.trim() !== "" ||
    row.currentStock.trim() !== "" ||
    row.minStock.trim() !== "" ||
    row.displayUnit !== "UNIT"
  )
}

export function BulkIngredientsDialog({
  open,
  onOpenChange,
  categories = [],
  locations = [],
  branchName = null,
  initialRows,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories?: IngredientCategory[]
  locations?: IngredientLocation[]
  /** Sucursal donde se registra el stock inicial; `null` = organización. */
  branchName?: string | null
  /** Filas precargadas (se usan en lugar del borrador). */
  initialRows?: BulkIngredientInitialRow[]
  /** Se invoca tras crear los insumos correctamente, con sus nombres. */
  onSaved?: (createdNames: string[]) => void
}) {
  const router = useRouter()
  const isOrgView = branchName === null
  // Con filas iniciales no se mezcla el borrador global de /inventory.
  const draftKey =
    initialRows && initialRows.length > 0 ? null : "bulk-ingredients"
  const [rows, setRows] = useState<BulkRow[]>(() => {
    if (initialRows && initialRows.length > 0) {
      return initialRows.map((row) => ({
        key: nextRowKey(),
        name: row.name,
        displayUnit: row.displayUnit,
        categoryId: row.categoryId,
        locationId: row.locationId,
        unitCost: row.unitCost ?? "",
        maxStock: row.maxStock ?? "",
        currentStock: row.currentStock ?? "",
        minStock: row.minStock ?? "",
      }))
    }

    return readDraft<BulkRow[]>("bulk-ingredients") ?? [emptyRow()]
  })
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  // Al añadir una fila la desplazamos a la vista: si la lista ya scrollea, la
  // fila nueva queda fuera de pantalla y habría que bajar a mano.
  const scrollOnNextRow = useRef(false)

  useEffect(() => {
    if (!scrollOnNextRow.current) return

    scrollOnNextRow.current = false
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    })
  }, [rows.length])

  const named = rows.filter((row) => row.name.trim().length > 0)
  const validRows = named.filter((row) => row.categoryId)

  const categoryItems = categories
    .filter((c) => c.isActive)
    .map((c) => ({ value: c.id, label: c.name }))

  const locationItems = [
    { value: "", label: "Sin ubicación" },
    ...locations
      .filter((l) => l.isActive)
      .map((l) => ({ value: l.id, label: l.name })),
  ]

  // Una sola fila por insumo: la rejilla es la misma en la cabecera y en los
  // datos para que todo quede alineado y sin saltos de línea.
  const rowGrid = cn(
    "grid items-center gap-2",
    isOrgView
      ? "grid-cols-[1.5rem_minmax(11rem,2.6fr)_5.5rem_minmax(8.5rem,1.5fr)_minmax(8.5rem,1.5fr)_7.5rem_4.5rem]"
      : "grid-cols-[1.5rem_minmax(11rem,2.4fr)_5.5rem_minmax(8.5rem,1.4fr)_minmax(8.5rem,1.4fr)_7.5rem_6.5rem_6rem_6rem_4.5rem]"
  )

  function updateRow(key: string, patch: Partial<BulkRow>) {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row))
    )
  }

  function addRow() {
    scrollOnNextRow.current = true
    setRows((current) => [...current, emptyRow()])
  }

  /** Clona la fila con todo lo que tenga escrito o seleccionado. */
  function duplicateRow(key: string) {
    setRows((current) => {
      const index = current.findIndex((row) => row.key === key)
      if (index === -1) return current
      const copy: BulkRow = { ...current[index], key: nextRowKey() }
      return [...current.slice(0, index + 1), copy, ...current.slice(index + 1)]
    })
  }

  function removeRow(key: string) {
    setRows((current) =>
      current.length === 1
        ? current
        : current.filter((row) => row.key !== key)
    )
  }

  function reset() {
    setRows([emptyRow()])
    setError(null)
  }

  /** Devuelve las filas a su estado inicial y descarta el borrador. */
  function handleClear() {
    if (draftKey) clearDraft(draftKey)
    reset()
  }

  /** Guarda las filas antes de cerrar para poder recuperarlas al reabrir. */
  function handleOpenChange(next: boolean) {
    if (!next && draftKey) writeDraft(draftKey, rows)

    onOpenChange(next)
  }

  async function handleSubmit() {
    setError(null)

    if (named.length === 0) {
      setError("Escribe al menos un insumo.")
      return
    }

    const missingName = rows.find((row) => hasData(row) && !row.name.trim())
    if (missingName) {
      setError(
        `Escribe el nombre del insumo en la fila ${rows.indexOf(missingName) + 1}.`
      )
      return
    }

    const withoutCategory = named.find((row) => !row.categoryId)
    if (withoutCategory) {
      setError(
        `Selecciona una categoría para "${withoutCategory.name.trim()}".`
      )
      return
    }

    const invalid = named.find(
      (row) =>
        !Number.isFinite(parseQuantity(row.unitCost)) ||
        !Number.isFinite(parseQuantity(row.maxStock)) ||
        !Number.isFinite(parseQuantity(row.currentStock)) ||
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
          displayUnit: row.displayUnit,
          categoryId: row.categoryId,
          locationId: row.locationId || undefined,
          unitCost: row.unitCost ? parseQuantity(row.unitCost) : undefined,
          maxStock: row.maxStock ? parseQuantity(row.maxStock) : undefined,
          currentStock: isOrgView ? 0 : parseQuantity(row.currentStock),
          minStock: isOrgView ? 0 : parseQuantity(row.minStock),
        }))
      )

      if (!result.ok) {
        setError(result.message ?? "No se pudieron crear los insumos")
        return
      }

      toast.success(
        named.length === 1
          ? "Insumo creado"
          : `${named.length} insumos creados`
      )
      if (draftKey) clearDraft(draftKey)
      const createdNames = named.map((row) => row.name.trim())
      reset()
      onSaved?.(createdNames)
      onOpenChange(false)
      router.refresh()
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="flex max-h-[90dvh] flex-col gap-3 sm:w-[90rem] sm:max-w-[calc(100%-2rem)]"
        showCloseButton={!pending}
      >
        <DialogHeader>
          <div className="flex items-start justify-between gap-4 pr-8">
            <div className="flex flex-col gap-1">
              <DialogTitle>Añadir varios insumos</DialogTitle>
              <DialogDescription>
                {branchName
                  ? `Cada insumo se guarda con su stock inicial como movimiento de ajuste en ${branchName}. El nombre, la unidad y la categoría son obligatorios; el SKU se genera automáticamente.`
                  : "El nombre, la unidad y la categoría son obligatorios; el SKU se genera automáticamente. En la vista de organización no se puede definir stock inicial."}
              </DialogDescription>
            </div>
            <Badge variant="secondary" className="shrink-0 text-xs">
              {validRows.length} / {rows.length} válidos
            </Badge>
          </div>
        </DialogHeader>

        <div
          ref={scrollRef}
          className="no-scrollbar -mx-6 flex min-h-0 flex-1 flex-col overflow-auto border-t px-6 pb-3"
        >
          <div className="flex min-w-[70rem] flex-col">
            {/* Cabecera de columnas */}
            <div
              className={cn(
                rowGrid,
                "sticky top-0 z-10 bg-popover px-1 py-1.5 text-xs font-medium text-muted-foreground"
              )}
            >
              {/* Celdas vacías en lugar de `sr-only`: `sr-only` es
                  `position: absolute` y saldría del flujo de la rejilla,
                  desalineando el resto de las columnas. */}
              <span aria-hidden="true" />
              <span>
                Nombre <span className="text-destructive">*</span>
              </span>
              <span>
                Unidad <span className="text-destructive">*</span>
              </span>
              <span>
                Categoría <span className="text-destructive">*</span>
              </span>
              <span>Ubicación</span>
              <span>Costo unitario</span>
              {isOrgView ? null : (
                <>
                  <span>Stock inicial</span>
                  <span>Stock mínimo</span>
                  <span>Stock máximo</span>
                </>
              )}
              <span aria-hidden="true" />
            </div>

            {rows.map((row, index) => (
              <div
                key={row.key}
                className={cn(
                  rowGrid,
                  "rounded-md px-1 py-1.5 transition-colors hover:bg-muted/40"
                )}
              >
                <span className="text-xs tabular-nums text-muted-foreground">
                  {index + 1}
                </span>

                <Input
                  value={row.name}
                  onChange={(event) =>
                    updateRow(row.key, { name: event.target.value })
                  }
                  placeholder="Leche entera"
                  maxLength={120}
                  aria-label={`Nombre del insumo ${index + 1}`}
                  className="h-8 text-sm"
                  disabled={pending}
                />

                <Select
                  value={row.displayUnit}
                  onValueChange={(value) =>
                    updateRow(row.key, { displayUnit: value as UnitCode })
                  }
                  items={UNIT_SELECT_ITEMS}
                  disabled={pending}
                >
                  <SelectTrigger
                    size="sm"
                    className="w-full"
                    aria-label={`Unidad del insumo ${index + 1}`}
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
                  items={categoryItems}
                  disabled={pending}
                >
                  <SelectTrigger
                    size="sm"
                    className="w-full"
                    aria-label={`Categoría del insumo ${index + 1}`}
                  >
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryItems.map((category) => (
                      <SelectItem key={category.value} value={category.value}>
                        {category.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={row.locationId}
                  onValueChange={(value) =>
                    updateRow(row.key, { locationId: value ?? "" })
                  }
                  items={locationItems}
                  disabled={pending}
                >
                  <SelectTrigger
                    size="sm"
                    className="w-full"
                    aria-label={`Ubicación del insumo ${index + 1}`}
                  >
                    <SelectValue placeholder="Sin ubicación" />
                  </SelectTrigger>
                  <SelectContent>
                    {locationItems.map((location) => (
                      <SelectItem key={location.value} value={location.value}>
                        {location.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <InputGroup className="h-8">
                  <InputGroupAddon align="inline-start">
                    <InputGroupText className="text-xs">$</InputGroupText>
                  </InputGroupAddon>
                  <InputGroupInput
                    type="number"
                    min="0"
                    placeholder="0"
                    value={row.unitCost}
                    onChange={(event) =>
                      updateRow(row.key, { unitCost: event.target.value })
                    }
                    aria-label={`Costo unitario del insumo ${index + 1}`}
                    className="h-full text-sm"
                    disabled={pending}
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupText className="text-xs">MXN</InputGroupText>
                  </InputGroupAddon>
                </InputGroup>

                {isOrgView ? null : (
                  <>
                    <InputGroup className="h-8">
                      <InputGroupInput
                        type="number"
                        min="0"
                        placeholder="0"
                        value={row.currentStock}
                        onChange={(event) =>
                          updateRow(row.key, {
                            currentStock: event.target.value,
                          })
                        }
                        aria-label={`Stock inicial del insumo ${index + 1}`}
                        className="h-full text-sm"
                        disabled={pending}
                      />
                      <InputGroupAddon align="inline-end">
                        <InputGroupText className="text-xs">
                          {unitLabel(row.displayUnit)}
                        </InputGroupText>
                      </InputGroupAddon>
                    </InputGroup>

                    <InputGroup className="h-8">
                      <InputGroupInput
                        type="number"
                        min="0"
                        placeholder="0"
                        value={row.minStock}
                        onChange={(event) =>
                          updateRow(row.key, { minStock: event.target.value })
                        }
                        aria-label={`Stock mínimo del insumo ${index + 1}`}
                        className="h-full text-sm"
                        disabled={pending}
                      />
                      <InputGroupAddon align="inline-end">
                        <InputGroupText className="text-xs">
                          {unitLabel(row.displayUnit)}
                        </InputGroupText>
                      </InputGroupAddon>
                    </InputGroup>

                    <InputGroup className="h-8">
                      <InputGroupInput
                        type="number"
                        min="0"
                        placeholder="0"
                        value={row.maxStock}
                        onChange={(event) =>
                          updateRow(row.key, { maxStock: event.target.value })
                        }
                        aria-label={`Stock máximo del insumo ${index + 1}`}
                        className="h-full text-sm"
                        disabled={pending}
                      />
                      <InputGroupAddon align="inline-end">
                        <InputGroupText className="text-xs">
                          {unitLabel(row.displayUnit)}
                        </InputGroupText>
                      </InputGroupAddon>
                    </InputGroup>
                  </>
                )}

                <div className="flex items-center justify-end gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Duplicar insumo ${index + 1}`}
                    title="Duplicar fila"
                    disabled={pending}
                    onClick={() => duplicateRow(row.key)}
                  >
                    <CopyIcon />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="text-destructive hover:bg-destructive/10"
                    aria-label={`Eliminar insumo ${index + 1}`}
                    title="Eliminar fila"
                    disabled={pending || rows.length === 1}
                    onClick={() => removeRow(row.key)}
                  >
                    <Trash2Icon />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {error ? <FieldError>{error}</FieldError> : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={addRow}
          >
            <PlusIcon />
            Añadir insumo
          </Button>
          <ClearFieldsButton
            onClick={handleClear}
            disabled={pending}
            className="sm:mr-auto"
          />
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={pending || validRows.length === 0}
            onClick={handleSubmit}
          >
            {pending ? (
              <Loader2Icon className="animate-spin" />
            ) : (
              <SaveIcon />
            )}
            Crear {validRows.length > 0 ? `${validRows.length} ` : ""}insumo
            {validRows.length !== 1 ? "s" : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
