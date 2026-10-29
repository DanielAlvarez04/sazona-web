"use client"

import { useState } from "react"
import { Loader2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
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

import { unitLabel, type Ingredient } from "@/lib/catalog"

const ADD_MOTIVES = [
  "Restock",
  "Conteo físico",
  "Entrada no registrada",
  "Otro motivo",
]

const SUBTRACT_MOTIVES = [
  "Conteo físico",
  "Caducidad o vencimiento",
  "Deterioro o descomposición",
  "Merma de preparación",
  "Desperdicio operativo",
  "Daño o rotura",
  "Salida no registrada",
  "Otro motivo",
]

export type AdjustmentType = "add" | "subtract"

interface AdjustStockDialogProps {
  ingredient: Ingredient | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (quantity: string, reason: string) => void
  pending: boolean
  type: AdjustmentType
}

export function AdjustStockDialog({
  ingredient,
  open,
  onOpenChange,
  onSubmit,
  pending,
  type,
}: AdjustStockDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {ingredient ? (
          <AdjustStockForm
            // Remontar el formulario al abrir (o al cambiar de producto/tipo)
            // deja el diálogo siempre limpio, sin arrastrar valores previos.
            key={`${ingredient.id}-${type}-${open ? "open" : "closed"}`}
            ingredient={ingredient}
            onSubmit={onSubmit}
            pending={pending}
            type={type}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function AdjustStockForm({
  ingredient,
  onSubmit,
  pending,
  type,
}: {
  ingredient: Ingredient
  onSubmit: (quantity: string, reason: string) => void
  pending: boolean
  type: AdjustmentType
}) {
  const [quantity, setQuantity] = useState("")
  const [reason, setReason] = useState("")
  const unit = unitLabel(ingredient.displayUnit)
  const motives = type === "add" ? ADD_MOTIVES : SUBTRACT_MOTIVES

  // La cantidad siempre es positiva: el signo lo pone el tipo de ajuste.
  const amount = Number(quantity.replace(",", "."))
  const validAmount = Number.isFinite(amount) && amount > 0

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {type === "add"
            ? `Añadir stock a ${ingredient.name}`
            : `Restar stock a ${ingredient.name}`}
        </DialogTitle>
        <DialogDescription>
          {type === "add"
            ? `Escribe cuánto vas a añadir. El número se sumará al stock actual (en ${unit}).`
            : `Escribe cuánto vas a restar. El número se restará al stock actual (en ${unit}).`}
        </DialogDescription>
      </DialogHeader>

      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          if (!validAmount || !reason) return
          onSubmit(
            type === "subtract"
              ? `-${quantity.replace(",", ".").trim()}`
              : quantity.replace(",", ".").trim(),
            reason
          )
        }}
      >
        <Field>
          <FieldLabel htmlFor="adjust-quantity">
            Cantidad <span className="text-destructive">*</span>
          </FieldLabel>
          <InputGroup>
            <InputGroupInput
              id="adjust-quantity"
              type="number"
              min="0"
              inputMode="decimal"
              value={quantity}
              onChange={(event) =>
                // Sin signos: aquí solo se escriben cantidades positivas.
                setQuantity(event.target.value.replace(/^[+-]+/, ""))
              }
              placeholder="Ej: 10"
              disabled={pending}
              required
            />
            <InputGroupAddon align="inline-end">
              <InputGroupText>{unit}</InputGroupText>
            </InputGroupAddon>
          </InputGroup>
        </Field>

        <Field>
          <FieldLabel htmlFor="adjust-reason">
            Motivo <span className="text-destructive">*</span>
          </FieldLabel>
          <Select
            value={reason}
            onValueChange={(value) => setReason((value as string) ?? "")}
            disabled={pending}
            items={motives.map((motive) => ({ value: motive, label: motive }))}
          >
            <SelectTrigger
              id="adjust-reason"
              className="w-full"
              aria-label="Motivo del ajuste"
            >
              <SelectValue placeholder="Selecciona un motivo" />
            </SelectTrigger>
            <SelectContent>
              {motives.map((motive) => (
                <SelectItem key={motive} value={motive}>
                  {motive}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <DialogFooter>
          <Button type="submit" disabled={pending || !validAmount || !reason}>
            {pending ? <Loader2Icon className="animate-spin" /> : null}
            {type === "add" ? "Añadir stock" : "Restar stock"}
          </Button>
        </DialogFooter>
      </form>
    </>
  )
}
