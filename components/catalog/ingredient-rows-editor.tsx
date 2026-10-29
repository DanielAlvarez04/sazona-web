"use client"

import { PlusIcon, Trash2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  unitLabel,
  unitsOfDimension,
  type Ingredient,
  type UnitCode,
} from "@/lib/catalog"

export interface AlternativeRowState {
  key: string
  ingredientId: string
  quantity: string
  unit: string
}

export interface IngredientRowState {
  key: string
  ingredientId: string
  label: string
  quantity: string
  unit: string
  isOptional: boolean
  alternatives: AlternativeRowState[]
}

let counter = 0

export function nextIngredientKey(prefix = "row") {
  counter += 1
  return `${prefix}-${counter}`
}

export function emptyIngredientRow(): IngredientRowState {
  return {
    key: nextIngredientKey(),
    ingredientId: "",
    label: "",
    quantity: "",
    unit: "",
    isOptional: false,
    alternatives: [],
  }
}

export function IngredientRowsEditor({
  rows,
  ingredients,
  onChange,
  disabled = false,
}: {
  rows: IngredientRowState[]
  ingredients: Ingredient[]
  onChange: (rows: IngredientRowState[]) => void
  disabled?: boolean
}) {
  function update(key: string, changes: Partial<IngredientRowState>) {
    onChange(
      rows.map((row) => (row.key === key ? { ...row, ...changes } : row))
    )
  }

  function updateAlternative(
    rowKey: string,
    alternativeKey: string,
    changes: Partial<AlternativeRowState>
  ) {
    onChange(
      rows.map((row) =>
        row.key === rowKey
          ? {
              ...row,
              alternatives: row.alternatives.map((alternative) =>
                alternative.key === alternativeKey
                  ? { ...alternative, ...changes }
                  : alternative
              ),
            }
          : row
      )
    )
  }

  function addAlternative(row: IngredientRowState) {
    const used = new Set([
      row.ingredientId,
      ...row.alternatives.map((alternative) => alternative.ingredientId),
    ])
    const defaultIngredient = ingredients.find(
      (ingredient) => ingredient.id === row.ingredientId
    )
    const candidate = ingredients.find(
      (ingredient) =>
        !used.has(ingredient.id) &&
        (!defaultIngredient ||
          dimensionOf(ingredient) === dimensionOf(defaultIngredient))
    )

    update(row.key, {
      alternatives: [
        ...row.alternatives,
        {
          key: nextIngredientKey("alt"),
          ingredientId: candidate?.id ?? "",
          quantity: row.quantity,
          unit: candidate?.displayUnit ?? "",
        },
      ],
    })
  }

  return (
    <div className="flex flex-col gap-3">
      {rows.length === 0 ? (
        <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          Sin ingredientes. Añade al menos uno para que la receta descuente
          inventario.
        </p>
      ) : null}

      {rows.map((row) => {
        const ingredient = ingredients.find(
          (candidate) => candidate.id === row.ingredientId
        )
        const units = ingredient ? unitsOfDimension(ingredient.baseUnit) : []

        return (
          <div
            key={row.key}
            className="flex flex-col gap-2 rounded-md border p-3"
          >
            <div className="grid gap-2 sm:grid-cols-[minmax(0,2fr)_6rem_6rem_auto]">
              <Select
                aria-label="Ingrediente de la receta"
                value={row.ingredientId || "none"}
                disabled={disabled}
                onValueChange={(value) => {
                  const nextId = value === "none" ? "" : (value ?? "")
                  const next = ingredients.find(
                    (candidate) => candidate.id === nextId
                  )
                  update(row.key, {
                    ingredientId: nextId,
                    unit: next?.displayUnit ?? "",
                  })
                }}
                items={[
                  { value: "none", label: "Elige un insumo" },
                  ...ingredients.map((candidate) => ({
                    value: candidate.id,
                    label: `${candidate.name} (${unitLabel(candidate.displayUnit)})`,
                  })),
                ]}
              >
                <SelectTrigger className="w-full" aria-label="Ingrediente">
                  <SelectValue placeholder="Elige un insumo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Elige un insumo</SelectItem>
                  {ingredients.map((candidate) => (
                    <SelectItem key={candidate.id} value={candidate.id}>
                      {candidate.name} ({unitLabel(candidate.displayUnit)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                aria-label="Cantidad"
                type="number"
                min="0.0001"
                step="any"
                placeholder="Cantidad"
                value={row.quantity}
                disabled={disabled}
                onChange={(event) =>
                  update(row.key, { quantity: event.target.value })
                }
              />

              <Select
                aria-label="Unidad"
                value={row.unit || "none"}
                disabled={disabled || !ingredient}
                onValueChange={(value) =>
                  update(row.key, { unit: value === "none" ? "" : (value ?? "") })
                }
                items={[
                  { value: "none", label: "Unidad" },
                  ...units.map((unit) => ({
                    value: unit.code,
                    label: unit.symbol,
                  })),
                ]}
              >
                <SelectTrigger className="w-full" aria-label="Unidad">
                  <SelectValue placeholder="Unidad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unidad</SelectItem>
                  {units.map((unit) => (
                    <SelectItem key={unit.code} value={unit.code}>
                      {unit.symbol}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {disabled ? null : (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Quitar ingrediente"
                  onClick={() =>
                    onChange(rows.filter((candidate) => candidate.key !== row.key))
                  }
                >
                  <Trash2Icon />
                </Button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Checkbox
                  checked={row.isOptional}
                  disabled={disabled}
                  onCheckedChange={(checked) =>
                    update(row.key, { isOptional: checked === true })
                  }
                />
                Opcional
              </label>

              <Input
                aria-label="Etiqueta del ingrediente"
                className="h-8 max-w-56"
                placeholder="Etiqueta del slot (ej. Leche)"
                value={row.label}
                disabled={disabled}
                onChange={(event) =>
                  update(row.key, { label: event.target.value })
                }
              />

              {disabled ? null : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => addAlternative(row)}
                >
                  <PlusIcon />
                  Añadir alternativa
                </Button>
              )}
            </div>

            {row.alternatives.length > 0 ? (
              <div className="flex flex-col gap-2 border-l-2 border-dashed pl-3">
                <p className="text-xs font-medium text-muted-foreground">
                  Alternativas (el default es el ingrediente de arriba)
                </p>
                {row.alternatives.map((alternative) => {
                  const alternativeIngredient = ingredients.find(
                    (candidate) => candidate.id === alternative.ingredientId
                  )
                  const alternativeUnits = alternativeIngredient
                    ? unitsOfDimension(alternativeIngredient.baseUnit)
                    : []
                  const used = new Set([
                    row.ingredientId,
                    ...row.alternatives
                      .filter((candidate) => candidate.key !== alternative.key)
                      .map((candidate) => candidate.ingredientId),
                  ])

                  return (
                    <div
                      key={alternative.key}
                      className="grid gap-2 sm:grid-cols-[minmax(0,2fr)_6rem_6rem_auto]"
                    >
                      <Select
                        aria-label="Insumo alternativo"
                        value={alternative.ingredientId || "none"}
                        disabled={disabled}
                        onValueChange={(value) => {
                          const nextId =
                            value === "none" ? "" : (value ?? "")
                          const next = ingredients.find(
                            (candidate) => candidate.id === nextId
                          )
                          updateAlternative(row.key, alternative.key, {
                            ingredientId: nextId,
                            unit: next?.displayUnit ?? "",
                          })
                        }}
                        items={[
                          { value: "none", label: "Elige un insumo" },
                          ...ingredients
                            .filter(
                              (candidate) =>
                                !used.has(candidate.id) &&
                                (!ingredient ||
                                  dimensionOf(candidate) ===
                                    dimensionOf(ingredient))
                            )
                            .map((candidate) => ({
                              value: candidate.id,
                              label: `${candidate.name} (${unitLabel(candidate.displayUnit)})`,
                            })),
                        ]}
                      >
                        <SelectTrigger
                          className="w-full"
                          aria-label="Insumo alternativo"
                        >
                          <SelectValue placeholder="Elige un insumo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Elige un insumo</SelectItem>
                          {ingredients
                            .filter(
                              (candidate) =>
                                !used.has(candidate.id) &&
                                (!ingredient ||
                                  dimensionOf(candidate) ===
                                    dimensionOf(ingredient))
                            )
                            .map((candidate) => (
                              <SelectItem
                                key={candidate.id}
                                value={candidate.id}
                              >
                                {candidate.name} (
                                {unitLabel(candidate.displayUnit)})
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>

                      <Input
                        aria-label="Cantidad de la alternativa"
                        type="number"
                        min="0.0001"
                        step="any"
                        value={alternative.quantity}
                        disabled={disabled}
                        onChange={(event) =>
                          updateAlternative(row.key, alternative.key, {
                            quantity: event.target.value,
                          })
                        }
                      />

                      <Select
                        aria-label="Unidad de la alternativa"
                        value={alternative.unit || "none"}
                        disabled={disabled || !alternativeIngredient}
                        onValueChange={(value) =>
                          updateAlternative(row.key, alternative.key, {
                            unit: value === "none" ? "" : (value ?? ""),
                          })
                        }
                        items={[
                          { value: "none", label: "Unidad" },
                          ...alternativeUnits.map((unit) => ({
                            value: unit.code,
                            label: unit.symbol,
                          })),
                        ]}
                      >
                        <SelectTrigger
                          className="w-full"
                          aria-label="Unidad de la alternativa"
                        >
                          <SelectValue placeholder="Unidad" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Unidad</SelectItem>
                          {alternativeUnits.map((unit) => (
                            <SelectItem key={unit.code} value={unit.code}>
                              {unit.symbol}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {disabled ? null : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Quitar alternativa"
                          onClick={() =>
                            update(row.key, {
                              alternatives: row.alternatives.filter(
                                (candidate) =>
                                  candidate.key !== alternative.key
                              ),
                            })
                          }
                        >
                          <Trash2Icon />
                        </Button>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : null}
          </div>
        )
      })}

      {disabled ? null : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit"
          onClick={() => onChange([...rows, emptyIngredientRow()])}
        >
          <PlusIcon />
          Añadir ingrediente
        </Button>
      )}
    </div>
  )
}

function dimensionOf(ingredient: Ingredient) {
  return ingredient.baseUnit === "UNIT"
    ? "COUNT"
    : ingredient.baseUnit === "ML"
      ? "VOLUME"
      : "MASS"
}

export function toUnitCode(value: string): UnitCode | undefined {
  return value ? (value as UnitCode) : undefined
}
