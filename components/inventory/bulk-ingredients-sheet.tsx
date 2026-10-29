"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Loader2Icon, PlusIcon, SaveIcon, Trash2Icon, GripVerticalIcon, CopyIcon, CheckIcon } from "lucide-react"
import { toast } from "sonner"

import { createIngredientsBulk } from "@/app/(app)/inventory/actions"
import { Button } from "@/components/ui/button"
import { FieldError } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { UnitOptions } from "@/components/ui/unit-options"
import {
  UNIT_SELECT_ITEMS,
  type UnitCode,
  type IngredientCategory,
  type IngredientLocation,
} from "@/lib/catalog"
import { cn } from "cn"

interface BulkRow {
  key: string
  name: string
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

interface RowState {
  hasError: boolean
  errorMessage?: string
}

export function BulkIngredientsSheet({
  open,
  onOpenChange,
  categories = [],
  locations = [],
  branchName = null,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories?: IngredientCategory[]
  locations?: IngredientLocation[]
  /** Sucursal donde se registra el stock inicial; `null` = organización. */
  branchName?: string | null
}) {
  const router = useRouter()
  const [rows, setRows] = useState<BulkRow[]>([emptyRow()])
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rowErrors, setRowErrors] = useState<Record<string, RowState>>({})
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  const named = rows.filter((row) => row.name.trim().length > 0)
  const validRows = rows.filter((row) => row.name.trim().length > 0 && row.categoryId && row.baseUnit)

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
      row.baseUnit !== "UNIT"
    )
  }

  function updateRow(key: string, patch: Partial<BulkRow>) {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row))
    )
    // Clear error for this row when user edits
    setRowErrors((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  function duplicateRow(key: string) {
    setRows((current) => {
      const index = current.findIndex((r) => r.key === key)
      if (index === -1) return current
      const row = current[index]
      const newRow: BulkRow = {
        ...row,
        key: `row-${++rowCounter}`,
        name: "",
      }
      return [...current.slice(0, index + 1), newRow, ...current.slice(index + 1)]
    })
  }

  function removeRow(key: string) {
    setRows((current) =>
      current.length === 1
        ? current
        : current.filter((item) => item.key !== key)
    )
    setRowErrors((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  function reorderRows(fromIndex: number, toIndex: number) {
    setRows((current) => {
      if (
        fromIndex === toIndex ||
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= current.length ||
        toIndex >= current.length
      ) {
        return current
      }
      const newRows = [...current]
      const [removed] = newRows.splice(fromIndex, 1)
      newRows.splice(toIndex, 0, removed)
      return newRows
    })
  }

  function reset() {
    setRows([emptyRow()])
    setError(null)
    setRowErrors({})
  }

  async function handleSubmit() {
    setError(null)

    if (named.length === 0) {
      setError("Escribe al menos un insumo.")
      return
    }

    const missingName = rows.find((row) => hasData(row) && !row.name.trim())
    if (missingName) {
      const position = rows.indexOf(missingName) + 1
      setError(`Escribe el nombre del insumo en la fila ${position}.`)
      return
    }

    const missingUnit = named.find((row) => !row.baseUnit)
    if (missingUnit) {
      setError(
        `Selecciona una unidad base para "${missingUnit.name.trim()}".`
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
          categoryId: row.categoryId,
          locationId: row.locationId || undefined,
          unitCost: row.unitCost ? parseQuantity(row.unitCost) : undefined,
          maxStock: row.maxStock ? parseQuantity(row.maxStock) : undefined,
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
          ? "Insumo creado"
          : `${named.length} insumos creados`
      )
      reset()
      onOpenChange(false)
      router.refresh()
    } finally {
      setPending(false)
    }
  }

  return (
    <TooltipProvider>
      <Sheet
        open={open}
        onOpenChange={(next) => {
          if (!next) reset()
          onOpenChange(next)
        }}
      >
        <SheetContent
          side="bottom"
          className="data-[side=bottom]:sm:max-h-[90vh] w-full max-w-5xl"
          showCloseButton={!pending}
        >
          <SheetHeader className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div>
                <SheetTitle>Añadir varios insumos</SheetTitle>
                <SheetDescription className="text-sm">
                  Cada insumo se guarda con su stock inicial como movimiento de
                  ajuste
                  {branchName ? ` en ${branchName}` : ""}. El nombre, la unidad base y
                  la categoría son obligatorios; el SKU se genera automáticamente.
                  Deja las cantidades vacías si aún no tienes stock.
                </SheetDescription>
              </div>
              <Badge variant="secondary" className="text-xs">
                {validRows.length} / {rows.length} válidos
              </Badge>
            </div>
          </SheetHeader>

          <Separator />

          <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 pb-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-sm">
                  <TableRow>
                    <TableHead className="w-10 text-left text-xs font-medium text-muted-foreground">
                      <span className="sr-only">Orden</span>
                    </TableHead>
                    <TableHead className="min-w-0 text-left text-xs font-medium text-muted-foreground">
                      Nombre <span className="text-destructive">*</span>
                    </TableHead>
                    <TableHead className="w-24 text-left text-xs font-medium text-muted-foreground">
                      Unidad <span className="text-destructive">*</span>
                    </TableHead>
                    <TableHead className="w-36 text-left text-xs font-medium whitespace-nowrap text-muted-foreground">
                      Categoría <span className="text-destructive">*</span>
                    </TableHead>
                    <TableHead className="w-32 text-left text-xs font-medium whitespace-nowrap text-muted-foreground">Ubicación</TableHead>
                    <TableHead className="w-24 text-right text-xs font-medium text-muted-foreground">Costo unit.</TableHead>
                    <TableHead className="w-20 text-right text-xs font-medium text-muted-foreground">Máx.</TableHead>
                    <TableHead className="w-24 text-right text-xs font-medium text-muted-foreground">Stock inicial</TableHead>
                    <TableHead className="w-24 text-right text-xs font-medium text-muted-foreground">Stock mínimo</TableHead>
                    <TableHead className="w-20 text-right text-xs font-medium text-muted-foreground">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, index) => (
                    <React.Fragment key={row.key}>
                      <TableRow
                        data-dragging={dragIndex === index}
                        className={cn(
                          "transition-colors hover:bg-accent/30 data-[dragging=true]:bg-accent/60",
                          rowErrors[row.key]?.hasError && "bg-destructive/10"
                        )}
                        onDragOver={(event) => {
                          if (dragIndex === null) return
                          event.preventDefault()
                          reorderRows(dragIndex, index)
                          setDragIndex(index)
                        }}
                        onDrop={(event) => {
                          event.preventDefault()
                          setDragIndex(null)
                        }}
                      >
                        <TableCell className="w-10 py-2 pr-2 text-center text-muted-foreground">
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  className="h-6 w-6 cursor-grab p-0 opacity-50 active:cursor-grabbing hover:opacity-100"
                                  aria-label="Arrastrar para reordenar"
                                  disabled={pending || rows.length === 1}
                                  draggable={!pending && rows.length > 1}
                                  onDragStart={(event) => {
                                    setDragIndex(index)
                                    event.dataTransfer.effectAllowed = "move"
                                  }}
                                  onDragEnd={() => setDragIndex(null)}
                                />
                              }
                            >
                              <GripVerticalIcon className="h-4 w-4" />
                            </TooltipTrigger>
                            <TooltipContent>Arrastrar para reordenar</TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell className="min-w-0 py-2 pr-2">
                          <Input
                            value={row.name}
                            onChange={(event) =>
                              updateRow(row.key, { name: event.target.value })
                            }
                            placeholder={`Insumo ${index + 1}`}
                            maxLength={120}
                            aria-label={`Nombre del insumo ${index + 1}`}
                            className={cn(
                              "w-full",
                              rowErrors[row.key]?.hasError && "border-destructive focus-visible:border-destructive"
                            )}
                          />
                          {rowErrors[row.key]?.hasError && (
                            <p className="mt-1 text-xs text-destructive">{rowErrors[row.key].errorMessage}</p>
                          )}
                        </TableCell>
                        <TableCell className="w-24 min-w-0 py-2 pr-2">
                          <Select
                            value={row.baseUnit}
                            onValueChange={(value) =>
                              updateRow(row.key, { baseUnit: value as UnitCode })
                            }
                            items={UNIT_SELECT_ITEMS}
                          >
                            <SelectTrigger
                              aria-label={`Unidad del insumo ${index + 1}`}
                              className="w-full"
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent side="top" align="end">
                              <UnitOptions />
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="w-36 min-w-0 py-2 pr-2">
                          <Select
                            value={row.categoryId}
                            onValueChange={(value) =>
                              updateRow(row.key, { categoryId: value ?? "" })
                            }
                            items={categories.map((c) => ({
                              value: c.id,
                              label: c.name,
                            }))}
                          >
                            <SelectTrigger aria-label={`Categoría del insumo ${index + 1}`} className="w-full">
                              <SelectValue placeholder="Categoría *" />
                            </SelectTrigger>
                            <SelectContent side="top" align="end">
                              {categories.map((c) => (
                                <SelectItem key={c.id} value={c.id}>
                                  {c.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="w-32 min-w-0 py-2 pr-2">
                          <Select
                            value={row.locationId}
                            onValueChange={(value) =>
                              updateRow(row.key, { locationId: value ?? "" })
                            }
                            items={[
                              { value: "", label: "Sin ubicación" },
                              ...locations.map((l) => ({ value: l.id, label: l.name })),
                            ]}
                          >
                            <SelectTrigger aria-label={`Ubicación del insumo ${index + 1}`} className="w-full">
                              <SelectValue placeholder="Ubicación" />
                            </SelectTrigger>
                            <SelectContent side="top" align="end">
                              <SelectItem value="">Sin ubicación</SelectItem>
                              {locations.map((l) => (
                                <SelectItem key={l.id} value={l.id}>
                                  {l.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="w-24 py-2 pr-2">
                          <Input
                            value={row.unitCost}
                            onChange={(event) =>
                              updateRow(row.key, { unitCost: event.target.value })
                            }
                            type="number"
                            min="0"
                            placeholder="0"
                            inputMode="decimal"
                            aria-label={`Costo unitario del insumo ${index + 1}`}
                            className="w-full text-right"
                          />
                        </TableCell>
                        <TableCell className="w-20 py-2 pr-2">
                          <Input
                            value={row.maxStock}
                            onChange={(event) =>
                              updateRow(row.key, { maxStock: event.target.value })
                            }
                            type="number"
                            min="0"
                            inputMode="decimal"
                            placeholder="0"
                            aria-label={`Stock máximo del insumo ${index + 1}`}
                            className="w-full text-right"
                          />
                        </TableCell>
                        <TableCell className="w-24 py-2 pr-2">
                          <Input
                            value={row.currentStock}
                            onChange={(event) =>
                              updateRow(row.key, { currentStock: event.target.value })
                            }
                            type="number"
                            min="0"
                            inputMode="decimal"
                            placeholder="0"
                            aria-label={`Stock inicial del insumo ${index + 1}`}
                            className="w-full text-right font-medium"
                          />
                        </TableCell>
                        <TableCell className="w-24 py-2 pr-2">
                          <Input
                            value={row.minStock}
                            onChange={(event) =>
                              updateRow(row.key, { minStock: event.target.value })
                            }
                            type="number"
                            min="0"
                            inputMode="decimal"
                            placeholder="0"
                            aria-label={`Stock mínimo del insumo ${index + 1}`}
                            className="w-full text-right"
                          />
                        </TableCell>
                        <TableCell className="w-20 py-2 pr-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Tooltip>
                              <TooltipTrigger
                                render={
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-sm"
                                    className="h-6 w-6"
                                    aria-label={`Duplicar insumo ${index + 1}`}
                                    disabled={pending || !row.name}
                                    onClick={() => duplicateRow(row.key)}
                                  />
                                }
                              >
                                <CopyIcon className="h-4 w-4" />
                              </TooltipTrigger>
                              <TooltipContent>Duplicar fila</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger
                                render={
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-sm"
                                    className="h-6 w-6 text-destructive hover:bg-destructive/10"
                                    aria-label={`Eliminar insumo ${index + 1}`}
                                    disabled={pending || rows.length === 1}
                                    onClick={() => removeRow(row.key)}
                                  />
                                }
                              >
                                <Trash2Icon className="h-4 w-4" />
                              </TooltipTrigger>
                              <TooltipContent>Eliminar fila</TooltipContent>
                            </Tooltip>
                          </div>
                        </TableCell>
                      </TableRow>
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>

            {rows.length > 0 && (
              <div className="flex items-center justify-between pt-2 border-t border-border/50">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckIcon className="h-4 w-4 text-green-500" />
                  <span>{validRows.length} insumo{validRows.length !== 1 ? "s" : ""} listo{validRows.length !== 1 ? "s" : ""} para crear</span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => setRows((current) => [...current, emptyRow()])}
                >
                  <PlusIcon className="mr-2 h-4 w-4" />
                  Añadir fila
                </Button>
              </div>
            )}

            {error ? <FieldError>{error}</FieldError> : null}
          </div>

          <SheetFooter className="flex-row justify-end gap-2 border-t p-4">
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
                <Loader2Icon className="animate-spin mr-2 h-4 w-4" />
              ) : (
                <SaveIcon className="mr-2 h-4 w-4" />
              )}
              Crear {validRows.length > 0 ? `${validRows.length} ` : ""}insumo{validRows.length !== 1 ? "s" : ""}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </TooltipProvider>
  )
}