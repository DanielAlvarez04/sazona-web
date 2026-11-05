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
import {
  GripVerticalIcon,
  ImageIcon,
  PlusIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { scrollAncestorToBottom } from "@/lib/scroll"
import { PRESENTATION_PRESETS } from "@/lib/catalog"
import { IMAGE_ACCEPT, validateImageFile } from "@/lib/uploads"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { cn } from "cn"

export type PresentationMode = "size" | "variant"

export interface PresentationRow {
  key: string
  name: string
  /** Precio propio; vacío = usa el de la presentación principal. */
  price: string
  /** Multiplicador de consumo de la receta (tamaño). */
  recipeFactor: string
  /** Factor sugerido cuando el campo se deja vacío. */
  recipeFactorPlaceholder?: string
  isPrimary: boolean
  /** El nombre sigue al del artículo hasta que se edita a mano. */
  linkedName: boolean
  /** Id de la presentación ya guardada; ausente en borradores nuevos. */
  variantId?: string
  /** Imagen propia ya guardada (null = usa la imagen base del artículo). */
  imageKey: string | null
  imageUrl: string | null
  /** Archivo elegido en esta sesión; se sube al guardar. */
  imageFile: File | null
  /** Preview local del archivo pendiente. */
  imagePreviewUrl: string | null
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
    recipeFactor: "1",
    isPrimary: false,
    linkedName: false,
    imageKey: null,
    imageUrl: null,
    imageFile: null,
    imagePreviewUrl: null,
    ...overrides,
  }
}

/** Filas del modo Tamaño: Chico / Regular / Grande. */
export function sizePresentationRows(): PresentationRow[] {
  return PRESENTATION_PRESETS.map((preset) =>
    createPresentationRow({
      name: preset.name,
      recipeFactor: "",
      recipeFactorPlaceholder: preset.recipeFactor,
      isPrimary: preset.name === "Regular",
    })
  )
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
  mode,
  onModeChange,
  showRecipeFactor,
  fallbackImageUrl,
  disabled = false,
}: {
  rows: PresentationRow[]
  onChange: (rows: PresentationRow[]) => void
  articleName: string
  /** Precio del artículo, que es el de la presentación principal. */
  articlePrice: string
  onArticlePriceChange: (value: string) => void
  mode: PresentationMode
  onModeChange: (mode: PresentationMode) => void
  /** El switch de receta está activo: muestra el factor editable. */
  showRecipeFactor: boolean
  /** Imagen base del artículo, usada cuando la presentación no tiene una. */
  fallbackImageUrl: string | null
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
  /** Filas actuales para liberar las previews al desmontar el diálogo. */
  const rowsRef = React.useRef(rows)

  React.useEffect(() => {
    rowsRef.current = rows
  }, [rows])

  React.useEffect(() => {
    return () => {
      for (const row of rowsRef.current) {
        if (row.imagePreviewUrl) URL.revokeObjectURL(row.imagePreviewUrl)
      }
    }
  }, [])

  // El diálogo tiene scroll propio: al añadir una fila se baja hasta el final
  // del contenedor para que la fila nueva y el footer queden siempre visibles,
  // sin que el usuario tenga que hacer scroll a mano.
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
    const target = rows.find((row) => row.key === key)

    if (target?.imagePreviewUrl) {
      URL.revokeObjectURL(target.imagePreviewUrl)
    }

    const next = rows.filter((row) => row.key !== key)

    if (next.length > 0 && !next.some((row) => row.isPrimary)) {
      next[0] = { ...next[0], isPrimary: true }
    }

    onChange(next)
  }

  const showFactor = mode === "size" && showRecipeFactor

  return (
    <div className="flex flex-col gap-2">
      <fieldset className="min-w-0 rounded-lg border border-dashed px-2 pt-1 pb-2">
        <legend className="px-1 text-[10px] font-medium text-muted-foreground">
          Tipo de presentación
        </legend>
        <div className="flex flex-wrap items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-pressed={mode === "variant"}
            disabled={disabled}
            className={cn(
              "h-6 gap-1 rounded-full px-2 text-[11px] shadow-none",
              mode === "variant"
                ? "border-chart-2/60 bg-chart-2/10 text-chart-2 hover:bg-chart-2/20 hover:text-chart-2 dark:border-chart-2/50 dark:bg-chart-2/15 dark:hover:bg-chart-2/25"
                : "border-muted-foreground/30 text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
            onClick={() => onModeChange("variant")}
          >
            Variante
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-pressed={mode === "size"}
            disabled={disabled}
            className={cn(
              "h-6 gap-1 rounded-full px-2 text-[11px] shadow-none",
              mode === "size"
                ? "border-chart-2/60 bg-chart-2/10 text-chart-2 hover:bg-chart-2/20 hover:text-chart-2 dark:border-chart-2/50 dark:bg-chart-2/15 dark:hover:bg-chart-2/25"
                : "border-muted-foreground/30 text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
            onClick={() => onModeChange("size")}
          >
            Tamaño
          </Button>
        </div>
      </fieldset>

      <div
        className={cn(
          "hidden gap-2 px-1 text-xs font-medium text-muted-foreground sm:grid",
          showFactor
            ? "grid-cols-[auto_auto_minmax(0,1fr)_5.5rem_9rem_auto]"
            : "grid-cols-[auto_auto_minmax(0,1fr)_9rem_auto]"
        )}
      >
        <span className="w-5" aria-hidden />
        <span className="w-4" aria-hidden />
        <span>Presentación</span>
        {showFactor ? <span>Factor</span> : null}
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
                showFactor={showFactor}
                fallbackImageUrl={fallbackImageUrl}
                disabled={disabled}
              />
            ))}
          </RadioGroup>
        </SortableContext>
      </DndContext>

      <div ref={addRowRef} className="flex flex-wrap items-center gap-2">
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
        La marcada es la presentación principal. La imagen de cada presentación
        es opcional: si no tiene, se usa la imagen del artículo. Si cambias o
        quitas la imagen del artículo, la principal conserva la anterior.
      </p>
    </div>
  )
}

/** Miniatura de la imagen propia de una presentación. */
function PresentationImageButton({
  row,
  fallbackUrl,
  disabled,
  onSelect,
  onRemove,
}: {
  row: PresentationRow
  fallbackUrl: string | null
  disabled: boolean
  onSelect: (file: File) => void
  onRemove: () => void
}) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const ownUrl = row.imagePreviewUrl ?? row.imageUrl
  const src = ownUrl ?? fallbackUrl
  const inherited = !ownUrl && Boolean(fallbackUrl)
  const hasOwn = Boolean(ownUrl)
  const label = row.name.trim() || "esta presentación"

  function handleFile(file: File | null | undefined) {
    if (!file || disabled) return

    const problem = validateImageFile(file)
    if (problem) {
      toast.error(problem)
      return
    }

    onSelect(file)
  }

  return (
    <div className="relative size-9 shrink-0">
      <button
        type="button"
        disabled={disabled}
        aria-label={`${hasOwn ? "Reemplazar" : "Agregar"} imagen de ${label}`}
        title={`${hasOwn ? "Reemplazar" : "Agregar"} imagen de ${label}`}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "relative flex size-9 items-center justify-center overflow-hidden rounded-md border bg-muted transition-colors hover:border-primary/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
          inherited && "border-dashed",
          disabled && "cursor-not-allowed opacity-60"
        )}
      >
        {src ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={src}
            alt=""
            className={cn(
              "size-full object-cover",
              inherited && "opacity-70"
            )}
          />
        ) : (
          <ImageIcon className="size-4 text-muted-foreground" />
        )}
        {inherited ? (
          <span className="absolute inset-x-0 bottom-0 bg-background/85 text-center text-[8px] font-medium text-muted-foreground">
            Base
          </span>
        ) : null}
      </button>

      {hasOwn ? (
        <button
          type="button"
          disabled={disabled}
          aria-label={`Quitar imagen de ${label}`}
          title={`Quitar imagen de ${label}`}
          onClick={onRemove}
          className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm hover:text-destructive focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
        >
          <XIcon className="size-2.5" />
        </button>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept={IMAGE_ACCEPT}
        className="sr-only"
        disabled={disabled}
        onChange={(event) => {
          handleFile(event.target.files?.[0])
          event.target.value = ""
        }}
      />
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
  showFactor,
  fallbackImageUrl,
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
  showFactor: boolean
  fallbackImageUrl: string | null
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

  function selectImage(file: File) {
    if (row.imagePreviewUrl) URL.revokeObjectURL(row.imagePreviewUrl)

    update({
      imageFile: file,
      imagePreviewUrl: URL.createObjectURL(file),
    })
  }

  function removeImage() {
    if (row.imagePreviewUrl) URL.revokeObjectURL(row.imagePreviewUrl)

    update({
      imageFile: null,
      imagePreviewUrl: null,
      imageKey: null,
      imageUrl: null,
    })
  }

  const suggestedName = `${articleName.trim() || "Artículo"} #${index + 1}`
  const suggestedPrice = articlePrice.trim() || "0.00"

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "grid items-center gap-2 rounded-md",
        showFactor
          ? "grid-cols-[auto_auto_minmax(0,1fr)_5.5rem_9rem_auto]"
          : "grid-cols-[auto_auto_minmax(0,1fr)_9rem_auto]",
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

      <div className="flex min-w-0 items-center gap-1.5">
        <PresentationImageButton
          row={row}
          fallbackUrl={fallbackImageUrl}
          disabled={disabled}
          onSelect={selectImage}
          onRemove={removeImage}
        />
        <Input
          aria-label="Nombre de la presentación"
          value={row.name}
          maxLength={80}
          placeholder={suggestedName}
          disabled={disabled}
          className="min-w-0"
          onChange={(event) =>
            update({ name: event.target.value, linkedName: false })
          }
        />
      </div>

      {showFactor ? (
        <Input
          aria-label={`Factor de ${row.name.trim() || suggestedName}`}
          type="number"
          min="0.1"
          step="0.01"
          value={row.recipeFactor}
          placeholder={row.recipeFactorPlaceholder ?? "1"}
          disabled={disabled}
          title="Multiplicador de consumo de la receta"
          onChange={(event) => update({ recipeFactor: event.target.value })}
        />
      ) : null}

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
