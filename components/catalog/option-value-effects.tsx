"use client"

import { PlusIcon, Trash2Icon } from "lucide-react"

import { IngredientCombobox } from "@/components/catalog/recipe-rows"
import { Button } from "@/components/ui/button"
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
import {
  convertUnitValue,
  formatMoney,
  priceWithoutTax,
  unitsOfDimension,
  type Ingredient,
  type OptionEffect,
  type UnitCode,
} from "@/lib/catalog"

/**
 * Efectos de consumo de una opción.
 *
 * Por ahora la app solo edita el efecto ADD: los efectos REPLACE/REMOVE que ya
 * existan se conservan tal cual, pero no se muestran aquí.
 */
export function OptionValueEffects({
  effects,
  priceDelta,
  ingredients,
  taxRate = "0",
  disabled,
  onChange,
}: {
  effects: OptionEffect[]
  priceDelta: string
  ingredients?: Ingredient[]
  /** Tasa de IVA aplicable al precio de la opción (fracción). */
  taxRate?: string
  disabled?: boolean
  onChange: (effects: OptionEffect[]) => void
}) {
  const addEffects = effects.filter((effect) => effect.action === "ADD")
  const otherEffects = effects.filter((effect) => effect.action !== "ADD")

  function commit(next: OptionEffect[]) {
    onChange([...otherEffects, ...next])
  }

  function update(index: number, changes: Partial<OptionEffect>) {
    commit(
      addEffects.map((effect, current) =>
        current === index ? { ...effect, ...changes } : effect
      )
    )
  }

  function add() {
    commit([
      ...addEffects,
      {
        action: "ADD",
        recipeIngredientId: null,
        replacesIngredientId: null,
        ingredientId: null,
        quantity: null,
      },
    ])
  }

  function remove(index: number) {
    commit(addEffects.filter((_, current) => current !== index))
  }

  const effectCost = addEffects.reduce((total, effect) => {
    const ingredient = ingredients?.find(
      (candidate) => candidate.id === effect.ingredientId
    )

    if (!ingredient?.unitCost || !effect.quantity) return total

    const unit = (effect.unit ?? ingredient.displayUnit) as UnitCode
    const displayQuantity = effect.unit
      ? Number(effect.quantity)
      : (convertUnitValue(
          Number(effect.quantity),
          ingredient.baseUnit,
          ingredient.displayUnit
        ) ?? Number(effect.quantity))
    const multiplied = displayQuantity * (effect.multiplier ?? 1)
    const canonical =
      convertUnitValue(multiplied, unit, ingredient.baseUnit) ?? multiplied

    return total + canonical * Number(ingredient.unitCost)
  }, 0)

  const delta = Number(priceDelta) || 0
  const netDelta = priceWithoutTax(delta, taxRate) ?? delta

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium">
          Consumo al elegir esta opción
        </span>
        <span className="text-xs text-muted-foreground">Solo agrega</span>
      </div>

      {addEffects.map((effect, index) => {
        const ingredient = ingredients?.find(
          (candidate) => candidate.id === effect.ingredientId
        )
        const units = ingredient ? unitsOfDimension(ingredient.baseUnit) : []
        const displayQuantity =
          effect.quantity && ingredient
            ? effect.unit
              ? Number(effect.quantity)
              : (convertUnitValue(
                  Number(effect.quantity),
                  ingredient.baseUnit,
                  ingredient.displayUnit
                ) ?? Number(effect.quantity))
            : effect.quantity

        return (
          <div key={index} className="flex flex-wrap items-center gap-1.5">
            <InputGroup className="w-36 shrink-0">
              <InputGroupAddon align="inline-start">
                <InputGroupText className="text-[10px]">
                  Agregar
                </InputGroupText>
              </InputGroupAddon>
              <InputGroupInput
                type="number"
                min="1"
                step="1"
                value={effect.multiplier ?? ""}
                placeholder="1"
                disabled={disabled}
                className="text-center"
                aria-label="Multiplicador del efecto"
                onChange={(event) => {
                  const value = event.target.value
                  update(index, {
                    multiplier: value
                      ? Math.max(1, Math.trunc(Number(value)))
                      : undefined,
                  })
                }}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupText className="text-[10px]">
                  x receta
                </InputGroupText>
              </InputGroupAddon>
            </InputGroup>

            <div className="min-w-40 flex-1">
              <IngredientCombobox
                value={effect.ingredientId ?? ""}
                ingredients={ingredients ?? []}
                disabled={Boolean(disabled)}
                onChange={(ingredientId) => {
                  const next = ingredients?.find(
                    (candidate) => candidate.id === ingredientId
                  )
                  update(index, {
                    ingredientId: ingredientId || null,
                    unit: next?.displayUnit,
                  })
                }}
              />
            </div>

            <Input
              type="number"
              min="0"
              step="0.0001"
              value={displayQuantity ?? ""}
              placeholder="Cantidad"
              disabled={disabled}
              className="h-9 w-24"
              aria-label="Cantidad a agregar"
              onChange={(event) =>
                update(index, {
                  quantity: event.target.value || null,
                  unit: effect.unit ?? ingredient?.displayUnit,
                })
              }
            />

            <Select
              value={effect.unit ?? ingredient?.displayUnit ?? "UNIT"}
              onValueChange={(value) => {
                const currentUnit =
                  effect.unit ?? ingredient?.displayUnit ?? "UNIT"
                const converted =
                  ingredient && displayQuantity !== null
                    ? convertUnitValue(
                        Number(displayQuantity),
                        currentUnit,
                        value as UnitCode
                      )
                    : null

                update(index, {
                  unit: value as UnitCode,
                  quantity:
                    converted !== null ? String(converted) : effect.quantity,
                })
              }}
              items={units.map((unit) => ({
                value: unit.code,
                label: unit.symbol,
              }))}
            >
              <SelectTrigger
                size="sm"
                className="w-20"
                aria-label="Unidad del efecto"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {units.map((unit) => (
                  <SelectItem key={unit.code} value={unit.code}>
                    {unit.symbol}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Quitar efecto"
              disabled={disabled}
              className="text-muted-foreground hover:text-destructive"
              onClick={() => remove(index)}
            >
              <Trash2Icon />
            </Button>
          </div>
        )
      })}

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={add}
      >
        <PlusIcon />
        Agregar otro insumo
      </Button>

      <div className="flex items-center justify-between border-t pt-2 text-xs text-muted-foreground">
        <span>
          Costo insumos {effectCost > 0 ? formatMoney(effectCost) : "—"}
        </span>
        <span>Margen {formatMoney(netDelta - effectCost)}</span>
      </div>
    </div>
  )
}
