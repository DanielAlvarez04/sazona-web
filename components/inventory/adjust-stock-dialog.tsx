"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { Loader2Icon, SaveIcon } from "lucide-react"

import { adjustStock } from "@/app/(app)/inventory/actions"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
  type Ingredient,
  type UnitCode,
} from "@/lib/catalog"

function newDedupeKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }

  return `adjust-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function AdjustStockDialog({
  open,
  onOpenChange,
  ingredient,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  ingredient: Ingredient
}) {
  const router = useRouter()
  const { pending, error, run } = useActionForm(() => {
    onOpenChange(false)
    router.refresh()
  })

  // La clave de idempotencia evita duplicar el ajuste si se reintenta el envío.
  // El diálogo se monta de nuevo en cada apertura, así que la clave es nueva.
  const [dedupeKey, setDedupeKey] = useState(newDedupeKey)
  const [unit, setUnit] = useState<UnitCode>(ingredient.baseUnit)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajustar stock de {ingredient.name}</DialogTitle>
          <DialogDescription>
            Usa cantidades positivas para entradas y negativas para salidas
            (mermas, correcciones). Todo ajuste queda en el kardex.
          </DialogDescription>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Stock actual:{" "}
          <span className="font-medium text-foreground">
            {formatQuantity(ingredient.currentStock)}{" "}
            {unitLabel(ingredient.baseUnit)}
          </span>
        </p>

        <form
          onSubmit={(event) => {
            event.preventDefault()
            const form = event.currentTarget
            const formData = new FormData(form)
            const quantity = String(formData.get("quantity") ?? "").trim()
            const reason = String(formData.get("reason") ?? "").trim()

            run(async () => {
              const result = await adjustStock({
                ingredientId: ingredient.id,
                quantity,
                unit,
                reason,
                dedupeKey,
              })

              if (result.ok) {
                form.reset()
                setUnit(ingredient.baseUnit)
                setDedupeKey(newDedupeKey())
              }

              return result
            })
          }}
        >
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="adjust-quantity">
                  Cantidad (+ entra / − sale)
                </FieldLabel>
                <Input
                  id="adjust-quantity"
                  name="quantity"
                  type="number"
                  step="0.0001"
                  required
                  placeholder="-250"
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="adjust-unit">Unidad</FieldLabel>
                <Select
                  value={unit}
                  onValueChange={(value) =>
                    setUnit((value ?? ingredient.baseUnit) as UnitCode)
                  }
                  items={UNIT_SELECT_ITEMS}
                >
                  <SelectTrigger
                    id="adjust-unit"
                    className="w-full"
                    aria-label="Unidad"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <UnitOptions />
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="adjust-reason">Motivo</FieldLabel>
              <Input
                id="adjust-reason"
                name="reason"
                required
                maxLength={200}
                placeholder="Merma por caducidad"
              />
            </Field>

            {error ? <FieldError>{error}</FieldError> : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? (
                  <Loader2Icon className="animate-spin" />
                ) : (
                  <SaveIcon />
                )}
                Registrar ajuste
              </Button>
            </DialogFooter>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
