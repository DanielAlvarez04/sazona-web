"use client"

import { useState } from "react"
import { Loader2Icon, PlusIcon, Trash2Icon } from "lucide-react"

import {
  createEquivalence,
  deleteEquivalence,
  getEquivalences,
} from "@/app/(app)/inventory/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { UnitOptions } from "@/components/ui/unit-options"
import { useActionForm } from "@/hooks/use-action-form"
import {
  formatQuantity,
  UNIT_SELECT_ITEMS,
  unitLabel,
  type Equivalence,
  type Ingredient,
  type UnitCode,
} from "@/lib/catalog"

export function EquivalencesDialog({
  open,
  onOpenChange,
  ingredient,
  initialItems,
  canManage,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  ingredient: Ingredient
  initialItems: Equivalence[]
  canManage: boolean
}) {
  const [items, setItems] = useState<Equivalence[]>(initialItems)
  const [refreshError, setRefreshError] = useState<string | null>(null)
  const [fromUnit, setFromUnit] = useState<UnitCode>("ML")
  const [toUnit, setToUnit] = useState<UnitCode>(ingredient.baseUnit)

  async function refresh() {
    const result = await getEquivalences(ingredient.id)

    if (result.ok) {
      setItems(result.data ?? [])
      setRefreshError(null)
    } else {
      setRefreshError(
        result.message ?? "No se pudieron cargar las equivalencias"
      )
    }
  }

  const addForm = useActionForm(() => void refresh())
  const removeForm = useActionForm(() => void refresh())

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Equivalencias de {ingredient.name}</DialogTitle>
          <DialogDescription>
            Solo hacen falta entre dimensiones distintas (por ejemplo, una taza
            de harina en gramos). Las conversiones dentro de la misma dimensión
            ya son fijas.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Este ingrediente no tiene equivalencias configuradas.
              </p>
            ) : (
              items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start justify-between gap-2 rounded-md border p-3"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">
                        1 {unitLabel(item.fromUnit)} ={" "}
                        {formatQuantity(item.factor)} {unitLabel(item.toUnit)}
                      </Badge>
                    </div>
                    {item.note ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.note}
                      </p>
                    ) : null}
                  </div>

                  {canManage ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Eliminar equivalencia"
                      disabled={removeForm.pending}
                      onClick={() =>
                        removeForm.run(() =>
                          deleteEquivalence(ingredient.id, item.id)
                        )
                      }
                    >
                      {removeForm.pending ? (
                        <Loader2Icon className="animate-spin" />
                      ) : (
                        <Trash2Icon />
                      )}
                    </Button>
                  ) : null}
                </div>
              ))
            )}

            {refreshError ? <FieldError>{refreshError}</FieldError> : null}
            {removeForm.error ? (
              <FieldError>{removeForm.error}</FieldError>
            ) : null}
          </div>

          {canManage ? (
            <form
              className="flex flex-col gap-3 rounded-md border border-dashed p-3"
              onSubmit={(event) => {
                event.preventDefault()
                const form = event.currentTarget
                const formData = new FormData(form)
                const factor = Number(
                  String(formData.get("factor") ?? "").replace(",", ".")
                )
                const note = String(formData.get("note") ?? "").trim()

                addForm.run(async () => {
                  const result = await createEquivalence(ingredient.id, {
                    fromUnit,
                    toUnit,
                    factor,
                    ...(note ? { note } : {}),
                  })

                  if (result.ok) {
                    form.reset()
                    setFromUnit("ML")
                    setToUnit(ingredient.baseUnit)
                  }
                  return result
                })
              }}
            >
              <p className="text-sm font-medium">Nueva equivalencia</p>

              <div className="grid gap-2 sm:grid-cols-3">
                <Field>
                  <FieldLabel htmlFor="equivalence-from">Desde</FieldLabel>
                  <Select
                    value={fromUnit}
                    onValueChange={(value) =>
                      setFromUnit((value ?? "ML") as UnitCode)
                    }
                    items={UNIT_SELECT_ITEMS}
                  >
                    <SelectTrigger
                      id="equivalence-from"
                      className="w-full"
                      aria-label="Desde"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <UnitOptions />
                    </SelectContent>
                  </Select>
                </Field>

                <Field>
                  <FieldLabel htmlFor="equivalence-to">Hacia</FieldLabel>
                  <Select
                    value={toUnit}
                    onValueChange={(value) =>
                      setToUnit((value ?? ingredient.baseUnit) as UnitCode)
                    }
                    items={UNIT_SELECT_ITEMS}
                  >
                    <SelectTrigger
                      id="equivalence-to"
                      className="w-full"
                      aria-label="Hacia"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <UnitOptions />
                    </SelectContent>
                  </Select>
                </Field>

                <Field>
                  <FieldLabel htmlFor="equivalence-factor">Factor</FieldLabel>
                  <Input
                    id="equivalence-factor"
                    name="factor"
                    type="number"
                    min="0.0001"
                    step="0.0001"
                    required
                    placeholder="1.2"
                  />
                </Field>
              </div>

              <Field>
                <FieldLabel htmlFor="equivalence-note">
                  Nota (opcional)
                </FieldLabel>
                <Input
                  id="equivalence-note"
                  name="note"
                  maxLength={200}
                  placeholder="1 ml de harina = 1.2 g"
                />
              </Field>

              {addForm.error ? <FieldError>{addForm.error}</FieldError> : null}

              <div className="flex justify-end">
                <Button type="submit" size="sm" disabled={addForm.pending}>
                  {addForm.pending ? (
                    <Loader2Icon className="animate-spin" />
                  ) : (
                    <PlusIcon />
                  )}
                  Añadir equivalencia
                </Button>
              </div>
            </form>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
