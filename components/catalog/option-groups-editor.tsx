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
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  ChevronDownIcon,
  GripVerticalIcon,
  Loader2Icon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react"
import { toast } from "sonner"

import { createOptionGroup } from "@/app/(app)/catalog/actions"
import { InfoHint } from "@/components/info-hint"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import type {
  ArticleInput,
  OptionGroupAssignmentInput,
} from "@/app/(app)/catalog/actions"
import type {
  ItemOptionGroup,
  OptionEffect,
  OptionGroup,
  OptionGroupPreset,
  OptionSelection,
} from "@/lib/catalog"
import { isNoPriceOptionGroup } from "@/lib/catalog"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn } from "cn"

export interface OptionGroupDraftValue {
  valueId: string
  name: string
  kitchenLabel: string | null
  priceDelta: string
  /** Disponible para el mesero al tomar la comanda. */
  isActive: boolean
  isDefault: boolean
  effects: OptionEffect[]
}

export interface OptionGroupDraft {
  groupId: string
  groupName: string
  isRequired: boolean
  selection: OptionSelection
  minSelect: number
  maxSelect: number | null
  values: OptionGroupDraftValue[]
}

/** Convierte los grupos que llegan de la API al estado editable del diálogo. */
export function optionGroupDrafts(
  groups: ItemOptionGroup[] | undefined
): OptionGroupDraft[] {
  return (groups ?? []).map((group) => ({
    groupId: group.groupId,
    groupName: group.group.name,
    isRequired: group.isRequired,
    selection: group.selection,
    minSelect: group.minSelect,
    maxSelect: group.maxSelect,
    values: group.values
      .filter((value) => value.value.isActive)
      .map((value) => ({
        valueId: value.valueId,
        name: value.value.name,
        kitchenLabel: value.value.kitchenLabel,
        priceDelta:
          Number(value.priceDelta) === 0
            ? ""
            : String(Number(value.priceDelta)),
        isActive: value.isActive,
        isDefault: value.isDefault,
        effects: value.effects ?? [],
      })),
  }))
}

/** Convierte el estado editable al payload que acepta la API. */
export function optionGroupPayload(
  drafts: OptionGroupDraft[]
): NonNullable<ArticleInput["optionGroups"]> {
  return drafts.map<OptionGroupAssignmentInput>((group) => {
    const values = group.values.map((value) => ({
      valueId: value.valueId,
      priceDelta: isNoPriceOptionGroup(group.groupName)
        ? 0
        : Number(value.priceDelta) || 0,
      isActive: value.isActive,
      isDefault: value.isDefault,
      effects: value.effects.map((effect) => ({
        action: effect.action,
        ...(effect.recipeIngredientId
          ? { recipeIngredientId: effect.recipeIngredientId }
          : {}),
        ...(effect.ingredientId ? { ingredientId: effect.ingredientId } : {}),
        ...(effect.quantity ? { quantity: Number(effect.quantity) } : {}),
      })),
    }))

    // El POS necesita una opción preseleccionada en los grupos de una sola
    // elección. Se prefiere la primera disponible; el checkbox no la expone.
    if (group.selection === "SINGLE" && values.length > 0) {
      const preferred = values.findIndex((value) => value.isActive)
      const defaultIndex = preferred >= 0 ? preferred : 0
      values.forEach((value, index) => {
        value.isDefault = index === defaultIndex
      })
    }

    return {
      groupId: group.groupId,
      isRequired: group.isRequired,
      selection: group.selection,
      minSelect: group.isRequired ? Math.max(1, group.minSelect) : 0,
      maxSelect:
        group.selection === "SINGLE"
          ? 1
          : (group.maxSelect ?? Math.max(1, group.values.length)),
      values,
    }
  })
}

/** Compara dos configuraciones de opciones sin importar el orden de claves. */
export function optionGroupsSignature(drafts: OptionGroupDraft[]): string {
  return JSON.stringify(optionGroupPayload(drafts))
}

function libraryToDraft(
  group: OptionGroup,
  selection?: OptionSelection
): OptionGroupDraft {
  const values = group.values
    .filter((value) => value.isActive)
    .map((value, index) => ({
      valueId: value.id,
      name: value.name,
      kitchenLabel: value.kitchenLabel,
      priceDelta: "",
      isActive: true,
      isDefault: (selection ?? "SINGLE") === "SINGLE" && index === 0,
      effects: [] as OptionEffect[],
    }))

  return {
    groupId: group.id,
    groupName: group.name,
    isRequired: false,
    selection: selection ?? "SINGLE",
    minSelect: 0,
    maxSelect: (selection ?? "SINGLE") === "SINGLE" ? 1 : values.length,
    values,
  }
}

function presetSelection(preset: OptionGroupPreset): OptionSelection {
  const name = preset.name.toLowerCase()
  return name === "extras" || name === "sin" ? "MULTIPLE" : "SINGLE"
}

export function OptionGroupsEditor({
  library,
  presets,
  value,
  onChange,
  disabled,
  hideHeader = false,
  suggestionsOnly = false,
  onGroupAdded,
}: {
  /** Biblioteca de grupos de la organización. */
  library: OptionGroup[]
  presets: OptionGroupPreset[]
  value: OptionGroupDraft[]
  onChange: (next: OptionGroupDraft[]) => void
  disabled?: boolean
  /** El contenedor ya muestra el título (diálogo de artículo). */
  hideHeader?: boolean
  /** Solo muestra la fila de sugerencias (opciones aún apagadas). */
  suggestionsOnly?: boolean
  /** Se dispara al añadir un grupo, para encender el switch de opciones. */
  onGroupAdded?: () => void
}) {
  const [selectedGroupId, setSelectedGroupId] = React.useState("")
  const [creating, setCreating] = React.useState(false)
  const [newName, setNewName] = React.useState("")
  const [newValues, setNewValues] = React.useState("")
  const [pending, setPending] = React.useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const used = new Set(value.map((group) => group.groupId))
  const available = library.filter(
    (group) =>
      group.isActive &&
      !used.has(group.id) &&
      group.values.some((value) => value.isActive)
  )
  // Una sugerencia deja de mostrarse en cuanto el grupo ya está asignado al
  // artículo. Si existe en la biblioteca, el botón lo reutiliza.
  const suggestedPresets = presets.filter(
    (preset) => !value.some((group) => group.groupName === preset.name)
  )

  function updateGroup(groupId: string, changes: Partial<OptionGroupDraft>) {
    onChange(
      value.map((group) =>
        group.groupId === groupId ? { ...group, ...changes } : group
      )
    )
  }

  function updateValue(
    groupId: string,
    valueId: string,
    changes: Partial<OptionGroupDraftValue>
  ) {
    onChange(
      value.map((group) =>
        group.groupId === groupId
          ? {
              ...group,
              values: group.values.map((item) =>
                item.valueId === valueId ? { ...item, ...changes } : item
              ),
            }
          : group
      )
    )
  }

  function addGroup(group: OptionGroup, selection?: OptionSelection) {
    onChange([...value, libraryToDraft(group, selection)])
    setSelectedGroupId("")
    onGroupAdded?.()
  }

  async function handleCreatePreset(preset: OptionGroupPreset) {
    // Si el grupo ya existe en la biblioteca (por otra pestaña o un uso
    // anterior), se reutiliza en vez de intentar crear un duplicado.
    const existing = library.find((group) => group.name === preset.name)

    if (existing) {
      if (!existing.isActive) {
        toast.error(`El grupo «${preset.name}» está desactivado`)
        return
      }

      if (!existing.values.some((value) => value.isActive)) {
        toast.error(`El grupo «${preset.name}» no tiene opciones activas`)
        return
      }

      addGroup(existing, presetSelection(preset))
      toast.success(`Grupo «${preset.name}» añadido`)
      return
    }

    setPending(preset.name)

    const result = await createOptionGroup({
      name: preset.name,
      description: preset.description,
      values: preset.values,
    })

    setPending(null)

    if (!result.ok || !result.data) {
      toast.error(result.message ?? "No se pudo crear el grupo")
      return
    }

    addGroup(result.data, presetSelection(preset))
    toast.success(`Grupo «${preset.name}» creado`)
  }

  async function handleCreateCustom() {
    const name = newName.trim()
    const values = newValues
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)

    if (!name) {
      toast.error("Escribe el nombre del grupo")
      return
    }

    if (values.length === 0) {
      toast.error("Añade al menos una opción")
      return
    }

    setPending("custom")

    const result = await createOptionGroup({
      name,
      values: values.map((item) => ({ name: item })),
    })

    setPending(null)

    if (!result.ok || !result.data) {
      toast.error(result.message ?? "No se pudo crear el grupo")
      return
    }

    addGroup(result.data)
    setNewName("")
    setNewValues("")
    setCreating(false)
    toast.success(`Grupo «${name}» creado`)
  }

  function handleGroupDragEnd(event: DragEndEvent) {
    const { active, over } = event

    if (!over || active.id === over.id) return

    const from = value.findIndex((group) => group.groupId === active.id)
    const to = value.findIndex((group) => group.groupId === over.id)

    if (from < 0 || to < 0) return

    const next = [...value]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    onChange(next)
  }

  return (
    <div className="flex flex-col gap-3">
      {hideHeader ? null : (
        <div className="flex flex-col gap-1">
          <Label className="text-sm font-medium">Opciones del artículo</Label>
          <p className="text-xs text-muted-foreground">
            Grupos como salsa, proteína, leche o extras. Marca las opciones
            disponibles en la comanda; activa «Múltiples opciones» para permitir
            elegir varias.
          </p>
        </div>
      )}

      {suggestedPresets.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Sugeridos:</span>
          {suggestedPresets.map((preset) => (
            <Button
              key={preset.name}
              type="button"
              variant="secondary"
              size="sm"
              disabled={disabled || pending !== null}
              onClick={() => handleCreatePreset(preset)}
            >
              {pending === preset.name ? (
                <Loader2Icon className="animate-spin" />
              ) : null}
              {preset.name}
            </Button>
          ))}
        </div>
      ) : null}

      {suggestionsOnly ? null : (
        <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis]}
        onDragEnd={handleGroupDragEnd}
      >
        <SortableContext
          items={value.map((group) => group.groupId)}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex flex-col gap-3">
            {value.map((group, index) => (
              <SortableGroupCard
                key={group.groupId}
                group={group}
                index={index}
                disabled={disabled}
                onUpdate={(changes) => updateGroup(group.groupId, changes)}
                onUpdateValue={(valueId, changes) =>
                  updateValue(group.groupId, valueId, changes)
                }
                onRemove={() =>
                  onChange(
                    value.filter(
                      (candidate) => candidate.groupId !== group.groupId
                    )
                  )
                }
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <div className="flex flex-col gap-2 rounded-lg border border-dashed p-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex min-w-52 flex-1 flex-col gap-1">
            <Label className="text-xs">Añadir grupo de la biblioteca</Label>
            <Select
              value={selectedGroupId || "none"}
              disabled={disabled || pending !== null || available.length === 0}
              onValueChange={(next) =>
                setSelectedGroupId(next === "none" ? "" : (next ?? ""))
              }
              items={[
                {
                  value: "none",
                  label:
                    available.length === 0
                      ? "No hay grupos disponibles"
                      : "Elige un grupo",
                },
                ...available.map((group) => ({
                  value: group.id,
                  label: group.name,
                })),
              ]}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Elige un grupo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  {available.length === 0
                    ? "No hay grupos disponibles"
                    : "Elige un grupo"}
                </SelectItem>
                {available.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={disabled || !selectedGroupId || pending !== null}
            onClick={() => {
              const group = available.find(
                (candidate) => candidate.id === selectedGroupId
              )
              if (group) addGroup(group)
            }}
          >
            <PlusIcon />
            Añadir
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={disabled || pending !== null}
            onClick={() => setCreating((current) => !current)}
          >
            Crear grupo
          </Button>
        </div>

        {creating ? (
          <div className="flex flex-col gap-2 border-t pt-2">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Nombre del grupo</Label>
                <Input
                  value={newName}
                  maxLength={80}
                  placeholder="Ej. Nivel de picante"
                  onChange={(event) => setNewName(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Opciones (separadas por coma)</Label>
                <Input
                  value={newValues}
                  placeholder="Suave, Medio, Picante"
                  onChange={(event) => setNewValues(event.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setCreating(false)}
                disabled={pending !== null}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleCreateCustom}
                disabled={pending !== null}
              >
                {pending === "custom" ? (
                  <Loader2Icon className="animate-spin" />
                ) : (
                  <PlusIcon />
                )}
                Crear y añadir
              </Button>
            </div>
          </div>
        ) : null}
      </div>
        </>
      )}
    </div>
  )
}

function SortableGroupCard({
  group,
  index,
  disabled,
  onUpdate,
  onUpdateValue,
  onRemove,
}: {
  group: OptionGroupDraft
  index: number
  disabled?: boolean
  onUpdate: (changes: Partial<OptionGroupDraft>) => void
  onUpdateValue: (
    valueId: string,
    changes: Partial<OptionGroupDraftValue>
  ) => void
  onRemove: () => void
}) {
  const [open, setOpen] = React.useState(false)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: group.groupId, disabled })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const allActive =
    group.values.length > 0 &&
    group.values.every((item) => item.isActive)
  const anyActive = group.values.some((item) => item.isActive)

  function handleValueDragEnd(event: DragEndEvent) {
    const { active, over } = event

    if (!over || active.id === over.id) return

    const from = group.values.findIndex(
      (item) => item.valueId === active.id
    )
    const to = group.values.findIndex((item) => item.valueId === over.id)

    if (from < 0 || to < 0) return

    const next = [...group.values]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    onUpdate({ values: next })
  }

  return (
    <Collapsible
      ref={setNodeRef}
      style={style}
      open={open}
      onOpenChange={setOpen}
      className={cn(
        "overflow-hidden rounded-lg border",
        isDragging && "relative z-10 opacity-70"
      )}
    >
      <div className="flex flex-wrap items-center gap-1.5 bg-muted/50 p-2">
        <div className="flex shrink-0 items-center">
          <span className="w-3 text-right text-[10px] text-muted-foreground tabular-nums">
            {index + 1}
          </span>

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Reordenar ${group.groupName}`}
            className="cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
            disabled={disabled}
            {...attributes}
            {...listeners}
          >
            <GripVerticalIcon />
          </Button>
        </div>

        <CollapsibleTrigger
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-1 text-left"
          aria-label={`${open ? "Contraer" : "Expandir"} ${group.groupName}`}
        >
          <ChevronDownIcon
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180"
            )}
          />
          <span className="truncate text-sm font-medium">{group.groupName}</span>
          <Badge variant="outline" className="bg-background">
            {group.selection === "SINGLE" ? "Una opción" : "Múltiples opciones"}
          </Badge>
        </CollapsibleTrigger>

        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Obligatorio
          <Switch
            checked={group.isRequired}
            disabled={disabled}
            onCheckedChange={(checked) =>
              onUpdate({
                isRequired: checked,
                ...(checked && group.minSelect < 1 ? { minSelect: 1 } : {}),
              })
            }
          />
        </label>

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Quitar ${group.groupName}`}
          disabled={disabled}
          onClick={onRemove}
        >
          <Trash2Icon />
        </Button>
      </div>

      <CollapsibleContent>
        <div className="flex flex-col gap-3 border-t p-2">
          <div className="grid items-center gap-2 sm:min-h-14 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-xs">
                <Checkbox
                  checked={allActive}
                  indeterminate={anyActive && !allActive}
                  disabled={disabled || group.values.length === 0}
                  onCheckedChange={(checked) =>
                    onUpdate({
                      values: group.values.map((item) => ({
                        ...item,
                        isActive: Boolean(checked),
                      })),
                    })
                  }
                  aria-label="Disponible en comanda"
                />
                <span>Disponible en comanda</span>
                <InfoHint text="Selecciona cuáles opciones del grupo se mostrarán en la comanda." />
              </div>

              <div className="flex items-center gap-2 text-xs">
                <Switch
                  id={`selection-${group.groupId}`}
                  checked={group.selection === "MULTIPLE"}
                  disabled={disabled}
                  aria-label="Múltiples opciones"
                  onCheckedChange={(checked) => {
                    const selection: OptionSelection = checked
                      ? "MULTIPLE"
                      : "SINGLE"
                    const firstActive = group.values.findIndex(
                      (item) => item.isActive
                    )
                    const defaultIndex = firstActive >= 0 ? firstActive : 0

                    onUpdate({
                      selection,
                      maxSelect: checked
                        ? Math.max(1, group.values.length)
                        : 1,
                      ...(checked
                        ? {}
                        : {
                            values: group.values.map((item, valueIndex) => ({
                              ...item,
                              isDefault: valueIndex === defaultIndex,
                            })),
                          }),
                    })
                  }}
                />
                <span>Múltiples opciones</span>
                <InfoHint text="Permite seleccionar más de una opción en la comanda." />
              </div>
            </div>

            {group.selection === "MULTIPLE" ? (
              <div className="flex items-end gap-2">
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Mínimo</Label>
                  <Input
                    type="number"
                    min={0}
                    max={group.values.length}
                    value={group.isRequired ? Math.max(1, group.minSelect) : 0}
                    disabled
                    className="w-20"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Máximo</Label>
                  <Input
                    type="number"
                    min={1}
                    max={group.values.length}
                    value={group.maxSelect ?? group.values.length}
                    disabled={disabled}
                    className="w-20"
                    onChange={(event) => {
                      const next = Number(event.target.value)
                      onUpdate({
                        maxSelect: Number.isFinite(next)
                          ? Math.min(
                              group.values.length,
                              Math.max(1, Math.trunc(next))
                            )
                          : group.values.length,
                      })
                    }}
                  />
                </div>
              </div>
            ) : null}
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleValueDragEnd}
          >
            <SortableContext
              items={group.values.map((item) => item.valueId)}
              strategy={rectSortingStrategy}
            >
              <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
                {group.values.map((item, index) => (
                  <SortableOptionValue
                    key={item.valueId}
                    group={group}
                    item={item}
                    index={index}
                    disabled={disabled}
                    onUpdateValue={(changes) =>
                      onUpdateValue(item.valueId, changes)
                    }
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

function SortableOptionValue({
  group,
  item,
  index,
  disabled,
  onUpdateValue,
}: {
  group: OptionGroupDraft
  item: OptionGroupDraftValue
  index: number
  disabled?: boolean
  onUpdateValue: (changes: Partial<OptionGroupDraftValue>) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.valueId, disabled })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  // En "Sin ..." la opción quita un ingrediente, no suma un cargo.
  const noPrice = isNoPriceOptionGroup(group.groupName)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex min-h-8 min-w-0 items-center gap-1.5 rounded-md border border-border px-2 py-0.5",
        isDragging && "relative z-10 opacity-70"
      )}
    >
      <div className="flex shrink-0 items-center">
        <span className="w-3 text-right text-[10px] text-muted-foreground tabular-nums">
          {index + 1}
        </span>

        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={`Reordenar ${item.name}`}
          className="shrink-0 cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
          disabled={disabled}
          {...attributes}
          {...listeners}
        >
          <GripVerticalIcon />
        </Button>
      </div>

      <Checkbox
        checked={item.isActive}
        disabled={disabled}
        onCheckedChange={(checked) =>
          onUpdateValue({ isActive: Boolean(checked) })
        }
        aria-label={`Mostrar ${item.name} en la comanda`}
      />

      <span className="min-w-0 flex-1 truncate text-sm" title={item.name}>
        {item.name}
      </span>

      {noPrice ? null : (
        <div className="flex h-7 w-28 shrink-0 items-center gap-1 border-l pl-2">
          <span className="text-xs text-muted-foreground">
            <span className="font-bold">+</span>$
          </span>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={item.priceDelta}
            placeholder="0"
            disabled={disabled}
            className="h-7 min-w-0 flex-1 border-0 bg-transparent px-0 text-right text-sm shadow-none ring-0 focus-visible:border-0 focus-visible:ring-0 dark:bg-transparent"
            aria-label={`Cargo de ${item.name}`}
            onChange={(event) =>
              onUpdateValue({ priceDelta: event.target.value })
            }
          />
          <span className="text-xs text-muted-foreground">MXN</span>
        </div>
      )}
    </div>
  )
}
