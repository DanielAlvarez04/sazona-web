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
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { cn } from "cn"

export interface PresentationRow {
  key: string
  name: string
  /** Precio propio; vacío = usa el de la presentación principal. */
  price: string
  isPrimary: boolean
  /** El nombre sigue al del artículo hasta que se edita a mano. */
  linkedName: boolean
}

let presentationCounter = 0

export function nextPresentationKey() {
  presentationCounter += 1
  return `presentation-${presentationCounter}`
}

export function createPresentationRow(
  overrides: Partial<PresentationRow> = {}
): PresentationRow {
  return {
    key: nextPresentationKey(),
    name: "",
    price: "",
    isPrimary: false,
    linkedName: false,
    ...overrides,
  }
}

/**
 * Filas iniciales al encender el switch: la del artículo (principal) y una
 * adicional vacía, que al guardar toma el nombre y el precio sugeridos.
 */
export function defaultPresentationRows(articleName: string): PresentationRow[] {
  return [
    createPresentationRow({
      name: articleName,
      isPrimary: true,
      linkedName: true,
    }),
    createPresentationRow(),
  ]
}

export function PresentationRows({
  rows,
  onChange,
  articleName,
  articlePrice,
  onArticlePriceChange,
  disabled = false,
}: {
  rows: PresentationRow[]
  onChange: (rows: PresentationRow[]) => void
  articleName: string
  /** Precio del artículo, que es el de la presentación principal. */
  articlePrice: string
  onArticlePriceChange: (value: string) => void
  disabled?: boolean
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

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

  function markPrimary(key: string) {
    const target = rows.find((row) => row.key === key)

    // El precio escrito en la fila pasa a ser el del artículo: al marcarla
    // como principal no se pierde lo que el usuario ya había capturado.
    if (target && !target.isPrimary && target.price.trim()) {
      onArticlePriceChange(target.price.trim())
    }

    onChange(
      rows.map((row) =>
        row.key === key
          ? { ...row, isPrimary: true, price: "" }
          : { ...row, isPrimary: false }
      )
    )
  }

  function remove(key: string) {
    const next = rows.filter((row) => row.key !== key)

    if (next.length > 0 && !next.some((row) => row.isPrimary)) {
      next[0] = { ...next[0], isPrimary: true }
    }

    onChange(next)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="hidden grid-cols-[auto_auto_minmax(0,1fr)_9rem_auto] gap-2 px-1 text-xs font-medium text-muted-foreground sm:grid">
        <span className="w-5" aria-hidden />
        <span className="w-4" aria-hidden />
        <span>Presentación</span>
        <span>Precio</span>
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
          <RadioGroup
            value={rows.find((row) => row.isPrimary)?.key ?? ""}
            onValueChange={(value) => {
              if (typeof value === "string" && value) markPrimary(value)
            }}
            disabled={disabled}
            aria-label="Presentación principal"
            className="flex flex-col gap-2"
          >
            {rows.map((row, index) => (
              <SortablePresentationRow
                key={row.key}
                row={row}
                index={index}
                rows={rows}
                articleName={articleName}
                articlePrice={articlePrice}
                onArticlePriceChange={onArticlePriceChange}
                onChange={onChange}
                onRemove={remove}
                disabled={disabled}
              />
            ))}
          </RadioGroup>
        </SortableContext>
      </DndContext>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => onChange([...rows, createPresentationRow()])}
        >
          <PlusIcon />
          Añadir presentación
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Arrastra con el asa para cambiar el orden: así se mostrarán en el menú.
        La marcada es la presentación principal.
      </p>
    </div>
  )
}

function SortablePresentationRow({
  row,
  index,
  rows,
  articleName,
  articlePrice,
  onArticlePriceChange,
  onChange,
  onRemove,
  disabled,
}: {
  row: PresentationRow
  index: number
  rows: PresentationRow[]
  articleName: string
  articlePrice: string
  onArticlePriceChange: (value: string) => void
  onChange: (rows: PresentationRow[]) => void
  onRemove: (key: string) => void
  disabled: boolean
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

  function update(changes: Partial<PresentationRow>) {
    onChange(
      rows.map((candidate) =>
        candidate.key === row.key ? { ...candidate, ...changes } : candidate
      )
    )
  }

  const suggestedName = `${articleName.trim() || "Artículo"} #${index + 1}`
  const suggestedPrice = articlePrice.trim() || "0.00"

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "grid grid-cols-[auto_auto_minmax(0,1fr)_9rem_auto] items-center gap-2 rounded-md",
        isDragging && "relative z-10 opacity-70"
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Reordenar ${row.name.trim() || suggestedName}`}
        className="cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
        disabled={disabled}
        {...attributes}
        {...listeners}
      >
        <GripVerticalIcon />
      </Button>

      <RadioGroupItem
        value={row.key}
        aria-label={`Marcar ${row.name.trim() || suggestedName} como principal`}
        disabled={disabled}
      />

      <Input
        aria-label="Nombre de la presentación"
        value={row.name}
        maxLength={80}
        placeholder={suggestedName}
        disabled={disabled}
        onChange={(event) =>
          update({ name: event.target.value, linkedName: false })
        }
      />

      <InputGroup>
        <InputGroupAddon align="inline-start">
          <InputGroupText>$</InputGroupText>
        </InputGroupAddon>
        <InputGroupInput
          aria-label="Precio de la presentación"
          type="number"
          min="0"
          step="0.01"
          value={row.isPrimary ? articlePrice : row.price}
          placeholder={suggestedPrice}
          disabled={disabled}
          onChange={(event) =>
            row.isPrimary
              ? onArticlePriceChange(event.target.value)
              : update({ price: event.target.value })
          }
        />
        <InputGroupAddon align="inline-end">
          <InputGroupText>MXN</InputGroupText>
        </InputGroupAddon>
      </InputGroup>

      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Quitar presentación"
        disabled={disabled || rows.length <= 1}
        onClick={() => onRemove(row.key)}
      >
        <Trash2Icon />
      </Button>
    </div>
  )
}
