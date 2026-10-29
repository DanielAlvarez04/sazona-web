"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { Loader2Icon, PlayIcon } from "lucide-react"
import { toast } from "sonner"

import { produceRecipe } from "@/app/(app)/catalog/actions"
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useActionForm } from "@/hooks/use-action-form"
import {
  UNIT_LABELS,
  convertUnitValue,
  formatQuantity,
  type Recipe,
  type UnitCode,
} from "@/lib/catalog"

const PRODUCTION_UNITS: UnitCode[] = ["KG", "G", "L", "ML", "UNIT"]

export function ProduceDialog({
  open,
  onOpenChange,
  recipe,
  branchName,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  recipe: Recipe
  branchName: string | null
}) {
  const router = useRouter()
  const form = useActionForm(() => {
    toast.success("Lote registrado")
    router.refresh()
    onOpenChange(false)
  })

  const ingredient = recipe.producesIngredient
  const displayUnit = ingredient?.displayUnit ?? "UNIT"
  const defaultQuantity =
    recipe.yieldQuantity && recipe.yieldUnit
      ? convertUnitValue(
          Number(recipe.yieldQuantity),
          recipe.yieldUnit,
          displayUnit
        )
      : null

  const [quantity, setQuantity] = useState(
    defaultQuantity === null ? "" : String(defaultQuantity)
  )
  const [unit, setUnit] = useState<UnitCode>(displayUnit)

  function submit() {
    if (!branchName) {
      form.setError("Selecciona una sucursal para producir el insumo")
      return
    }

    const value = Number(quantity.replace(",", "."))

    if (!Number.isFinite(value) || value <= 0) {
      form.setError("Indica una cantidad válida")
      return
    }

    form.run(() => produceRecipe(recipe.id, { quantity: value, unit }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Producir lote</DialogTitle>
          <DialogDescription>
            Se sumará stock de{" "}
            <span className="font-medium">{ingredient?.name}</span> en{" "}
            {branchName ?? "la sucursal activa"} y se registrará en el kardex.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="produce-quantity">Cantidad</FieldLabel>
              <Input
                id="produce-quantity"
                type="number"
                min="0.0001"
                step="any"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                placeholder="Ej. 2"
              />
            </Field>
            <Field>
              <FieldLabel>Unidad</FieldLabel>
              <Select
                value={unit}
                onValueChange={(value) => setUnit((value ?? displayUnit) as UnitCode)}
                items={PRODUCTION_UNITS.map((code) => ({
                  value: code,
                  label: UNIT_LABELS[code],
                }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Unidad" />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCTION_UNITS.map((code) => (
                    <SelectItem key={code} value={code}>
                      {UNIT_LABELS[code]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          {recipe.yieldQuantity ? (
            <p className="text-xs text-muted-foreground">
              Rendimiento configurado:{" "}
              {formatQuantity(recipe.yieldQuantity)}{" "}
              {recipe.yieldUnit ? (UNIT_LABELS[recipe.yieldUnit] ?? recipe.yieldUnit) : ""}{" "}
              por lote.
            </p>
          ) : null}

          {form.error ? <FieldError>{form.error}</FieldError> : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={form.pending}
          >
            Cancelar
          </Button>
          <Button type="button" onClick={submit} disabled={form.pending}>
            {form.pending ? (
              <Loader2Icon className="animate-spin" />
            ) : (
              <PlayIcon />
            )}
            Producir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
