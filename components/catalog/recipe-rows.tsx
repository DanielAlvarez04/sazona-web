"use client"

import * as React from "react"
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import { restrictToVerticalAxis } from "@dnd-kit/modifiers"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVerticalIcon, PlusIcon, Trash2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  ComboboxSeparator,
} from "@/components/ui/combobox"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  unitsOfDimension,
  type Ingredient,
  type Recipe,
} from "@/lib/catalog"
import { scrollAncestorToBottom } from "@/lib/scroll"
import { cn } from "cn"

export interface RecipeRowAlternative {
  key: string
  ingredientId: string
  quantity: string
  unit: string
}

export interface RecipeRow {
  key: string
  ingredientId: string
  quantity: string
  unit: string
  /**
   * Campos heredados del editor anterior. La fila compacta no los edita, pero
   * se conservan al guardar para no perder etiquetas, opcionales ni
   * alternativas ya configuradas.
   */
  label: string
  isOptional: boolean
  alternatives: RecipeRowAlternative[]
}

let counter = 0

export function nextRecipeRowKey(prefix = "recipe") {
  counter += 1
  return `${prefix}-${counter}`
}

export function emptyRecipeRow(): RecipeRow {
  return {
    key: nextRecipeRowKey(),
    ingredientId: "",
    quantity: "",
    unit: "",
    label: "",
    isOptional: false,
    alternatives: [],
  }
}

/** Filas iniciales al editar una receta existente. */
export function recipeRowsFrom(recipe: Recipe): RecipeRow[] {
  return recipe.ingredients.map((line) => ({
    key: nextRecipeRowKey("edit"),
    ingredientId: line.ingredient.id,
    quantity: line.quantity,
    unit: line.ingredient.displayUnit,
    label: line.label ?? "",
    isOptional: line.isOptional,
    alternatives: line.options.map((option) => ({
      key: nextRecipeRowKey("edit-alt"),
      ingredientId: option.ingredient.id,
      quantity: option.quantity,
      unit: option.ingredient.displayUnit,
    })),
  }))
}

export function RecipeRows({
  rows,
  ingredients,
  onChange,
  disabled = false,
}: {
  rows: RecipeRow[]
  ingredients: Ingredient[]
  onChange: (rows: RecipeRow[]) => void
  disabled?: boolean
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  /** Contenedor del botón de añadir; desde ahí se busca el scroll del diálogo. */
  const addRowRef = React.useRef<HTMLDivElement>(null)
  /** Nº de filas del render anterior, para detectar cuándo se añadió una. */
  const previousRowCount = React.useRef(rows.length)

  React.useEffect(() => {
    const added = rows.length > previousRowCount.current
    previousRowCount.current = rows.length

    if (added) scrollAncestorToBottom(addRowRef.current)
  }, [rows.length])

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event

    if (!over || active.id === over.id) return

    const from = rows.findIndex((row) => row.key === active.id)
    const to = rows.findIndex((row) => row.key === over.id)

    if (from < 0 || to < 0) return

    const next = [...rows]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    onChange(next)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="hidden grid-cols-[auto_minmax(0,1fr)_6rem_6rem_auto] gap-2 px-1 text-xs font-medium text-muted-foreground sm:grid">
        <span className="w-5" aria-hidden />
        <span>Insumo</span>
        <span>Cantidad</span>
        <span>Unidad</span>
        <span className="sr-only">Acciones</span>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis]}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={rows.map((row) => row.key)}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex flex-col gap-2">
            {rows.map((row, index) => (
              <SortableRecipeRow
                key={row.key}
                row={row}
                index={index}
                rows={rows}
                ingredients={ingredients}
                onChange={onChange}
                disabled={disabled}
                canRemove={rows.length > 1}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <div ref={addRowRef} className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => onChange([...rows, emptyRecipeRow()])}
        >
          <PlusIcon />
          Añadir insumo
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Arrastra con el asa para cambiar el orden. La cantidad se descuenta del
        inventario al vender el artículo.
      </p>
    </div>
  )
}

function SortableRecipeRow({
  row,
  index,
  rows,
  ingredients,
  onChange,
  disabled,
  canRemove,
}: {
  row: RecipeRow
  index: number
  rows: RecipeRow[]
  ingredients: Ingredient[]
  onChange: (rows: RecipeRow[]) => void
  disabled: boolean
  /** La última fila no se puede borrar: la receta siempre conserva una. */
  canRemove: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: row.key, disabled })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const ingredient = ingredients.find(
    (candidate) => candidate.id === row.ingredientId
  )
  const units = ingredient ? unitsOfDimension(ingredient.baseUnit) : []

  function update(changes: Partial<RecipeRow>) {
    onChange(
      rows.map((candidate) =>
        candidate.key === row.key ? { ...candidate, ...changes } : candidate
      )
    )
  }

  function changeIngredient(ingredientId: string) {
    const next = ingredients.find((candidate) => candidate.id === ingredientId)

    // Cambiar de insumo invalida etiquetas y alternativas del anterior.
    update({
      ingredientId,
      unit: next?.displayUnit ?? "",
      alternatives: [],
    })
  }

  const rowName =
    ingredient?.name ?? `Fila ${index + 1}`

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "grid grid-cols-[auto_minmax(0,1fr)_6rem_6rem_auto] items-center gap-2 rounded-md",
        isDragging && "relative z-10 opacity-70"
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Reordenar ${rowName}`}
        className="cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
        disabled={disabled}
        {...attributes}
        {...listeners}
      >
        <GripVerticalIcon />
      </Button>

      <IngredientCombobox
        value={row.ingredientId}
        ingredients={ingredients}
        onChange={changeIngredient}
        disabled={disabled}
      />

      <Input
        aria-label="Cantidad"
        type="number"
        min="0.0001"
        step="any"
        placeholder="Cantidad"
        value={row.quantity}
        disabled={disabled || !ingredient}
        onChange={(event) => update({ quantity: event.target.value })}
      />

      <Select
        aria-label="Unidad"
        value={row.unit || "none"}
        disabled={disabled || !ingredient}
        onValueChange={(value) =>
          update({ unit: value === "none" ? "" : (value ?? "") })
        }
        items={[
          { value: "none", label: "Unidad" },
          ...units.map((unit) => ({ value: unit.code, label: unit.symbol })),
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

      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Quitar insumo"
        disabled={disabled || !canRemove}
        title={canRemove ? "Quitar insumo" : "La receta debe tener al menos un insumo"}
        onClick={() =>
          onChange(rows.filter((candidate) => candidate.key !== row.key))
        }
      >
        <Trash2Icon />
      </Button>
    </div>
  )
}

interface IngredientOption {
  value: string
  label: string
}

interface IngredientGroup {
  /** Nombre de la categoría; es también la etiqueta del grupo. */
  value: string
  items: IngredientOption[]
}

/**
 * Insumos agrupados por categoría. Categorías e insumos se ordenan
 * alfabéticamente; los insumos sin categoría van en «Sin categoría».
 */
function groupIngredients(ingredients: Ingredient[]): IngredientGroup[] {
  const groups = new Map<string, IngredientOption[]>()

  for (const ingredient of ingredients) {
    const category = ingredient.category?.name.trim() || "Sin categoría"
    const items = groups.get(category) ?? []

    items.push({ value: ingredient.id, label: ingredient.name })
    groups.set(category, items)
  }

  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right, "es"))
    .map(([category, items]) => ({
      value: category,
      items: items.sort((left, right) =>
        left.label.localeCompare(right.label, "es")
      ),
    }))
}

function IngredientCombobox({
  value,
  ingredients,
  onChange,
  disabled,
}: {
  value: string
  ingredients: Ingredient[]
  onChange: (ingredientId: string) => void
  disabled: boolean
}) {
  const groups = React.useMemo(
    () => groupIngredients(ingredients),
    [ingredients]
  )

  const selected =
    groups
      .flatMap((group) => group.items)
      .find((item) => item.value === value) ?? null

  return (
    <Combobox
      items={groups}
      value={selected}
      onValueChange={(next) => onChange(next?.value ?? "")}
      isItemEqualToValue={(item, current) => item.value === current.value}
      disabled={disabled}
    >
      <ComboboxInput
        aria-label="Insumo de la receta"
        placeholder="Buscar insumo…"
        disabled={disabled}
        showClear={Boolean(value)}
        className="w-full"
      />
      <ComboboxContent>
        <ComboboxEmpty>Sin insumos</ComboboxEmpty>
        <ComboboxList>
          {(group: IngredientGroup, index: number) => (
            <React.Fragment key={group.value}>
              {index > 0 ? <ComboboxSeparator /> : null}
              <ComboboxGroup items={group.items}>
                <ComboboxLabel>{group.value}</ComboboxLabel>
                <ComboboxCollection>
                  {(item: IngredientOption) => (
                    <ComboboxItem key={item.value} value={item}>
                      {item.label}
                    </ComboboxItem>
                  )}
                </ComboboxCollection>
              </ComboboxGroup>
            </React.Fragment>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
