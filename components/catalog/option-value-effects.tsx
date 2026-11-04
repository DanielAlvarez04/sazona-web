"use client"

import { PlusIcon, Trash2Icon } from "lucide-react"

import { IngredientCombobox } from "@/components/catalog/recipe-rows"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  unitsOfDimension,
  type Ingredient,
  type OptionEffect,
  type UnitCode,
} from "@/lib/catalog"

/**
 * Editor compacto de consumo de una opción.
 *
 * Los efectos se guardan por artículo: el mismo valor de la biblioteca puede
 * consumir cantidades distintas en dos platillos.
 */
export function OptionValueEffects({
  effects,
  scaleFactor,
  priceDelta,
  ingredients,
  slotOptions,
  disabled,
  onChange,
}: {
  effects: OptionEffect[]
  scaleFactor: string
  priceDelta: string
  ingredients?: Ingredient[]
  slotOptions: Array<{ ingredientId: string; name: string }>
  disabled?: boolean
  onChange: (effects: OptionEffect[], scaleFactor: string) => void
}) {
  function update(index: number, changes: Partial<OptionEffect>) {
    onChange(
      effects.map((effect, current) =>
        current === index ? { ...effect, ...changes } : effect
      ),
      scaleFactor
    )
  }

  function add() {
    onChange(
      [
        ...effects,
        {
          action: "ADD",
          recipeIngredientId: null,
          replacesIngredientId: null,
          ingredientId: null,
          quantity: null,
        },
      ],
      scaleFactor
    )
  }

  function remove(index: number) {
    onChange(
      effects.filter((_, current) => current !== index),
      scaleFactor
    )
  }

  const effectCost = effects.reduce((total, effect) => {
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
    const canonical =
      convertUnitValue(displayQuantity, unit, ingredient.baseUnit) ??
      displayQuantity

    return total + canonical * Number(ingredient.unitCost)
  }, 0)

  const delta = Number(priceDelta) || 0
  const margin = delta - effectCost

  return (
    <div className="flex flex-col gap-2 rounded-md border border-dashed p-2">
      <div className="flex flex-wrap items-center gap-2">
        <Label className="text-xs">Factor de escala</Label>
        <Input
          type="number"
          min="0.1"
          step="0.01"
          value={scaleFactor}
          disabled={disabled}
          className="h-7 w-16"
          aria-label="Factor de escala"
          onChange={(event) => onChange(effects, event.target.value)}
        />
        <span className="text-xs text-muted-foreground">× receta</span>
        <span className="ml-auto text-xs text-muted-foreground">
          {Number(scaleFactor) === 1
            ? `Costo insumos ${
                effectCost > 0 ? formatMoney(effectCost) : "—"
              } · Margen ${formatMoney(margin)}`
            : `Escala ×${scaleFactor} la receta completa`}
        </span>
      </div>

      {effects.map((effect, index) => {
        const ingredient = ingredients?.find(
          (candidate) => candidate.id === effect.ingredientId
        )
        const units = ingredient ? unitsOfDimension(ingredient.baseUnit) : []
        const action = effect.action
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
            <Select
              value={action}
              onValueChange={(value) =>
                update(index, {
                  action: value as OptionEffect["action"],
                  recipeIngredientId: null,
                  replacesIngredientId: null,
                  ingredientId:
                    value === "REMOVE" ? null : effect.ingredientId,
                  quantity: value === "REMOVE" ? null : effect.quantity,
                  unit: value === "REMOVE" ? undefined : effect.unit,
                })
              }
              items={[
                { value: "ADD", label: "Agregar" },
                { value: "REPLACE", label: "Reemplazar" },
                { value: "REMOVE", label: "Quitar" },
              ]}
            >
              <SelectTrigger
                size="sm"
                className="w-28"
                aria-label="Acción del efecto"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ADD">Agregar</SelectItem>
                <SelectItem value="REPLACE">Reemplazar</SelectItem>
                <SelectItem value="REMOVE">Quitar</SelectItem>
              </SelectContent>
            </Select>

            {action !== "ADD" ? (
              <Select
                value={
                  action === "REMOVE"
                    ? (effect.ingredientId ?? "")
                    : (effect.replacesIngredientId ?? "")
                }
                onValueChange={(value) =>
                  update(
                    index,
                    action === "REMOVE"
                      ? { ingredientId: value || null }
                      : { replacesIngredientId: value || null }
                  )
                }
                items={slotOptions.map((slot) => ({
                  value: slot.ingredientId,
                  label: slot.name,
                }))}
              >
                <SelectTrigger
                  size="sm"
                  className="w-32"
                  aria-label={
                    action === "REMOVE"
                      ? "Insumo a quitar"
                      : "Insumo original"
                  }
                >
                  <SelectValue
                    placeholder={action === "REMOVE" ? "Insumo" : "Original"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {slotOptions.map((slot) => (
                    <SelectItem
                      key={slot.ingredientId}
                      value={slot.ingredientId}
                    >
                      {slot.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}

            {action !== "REMOVE" ? (
              <>
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
                  disabled={disabled}
                  className="h-7 w-20"
                  aria-label="Cantidad del efecto"
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
                        converted !== null
                          ? String(converted)
                          : effect.quantity,
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
              </>
            ) : null}

            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
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
        Agregar efecto
      </Button>
    </div>
  )
}
