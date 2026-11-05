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
  CheckIcon,
  ChevronDownIcon,
  BlenderIcon,
  GripVerticalIcon,
  Loader2Icon,
  PlusIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"
import { toast } from "sonner"

import {
  createOptionGroup,
  createOptionValue,
} from "@/app/(app)/catalog/actions"
import { InfoHint } from "@/components/info-hint"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { OptionValueEffects } from "@/components/catalog/option-value-effects"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
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
import {
  isNoPriceOptionGroup,
  type Ingredient,
} from "@/lib/catalog"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn } from "cn"

export interface OptionGroupDraftValue {
  /** Clave estable para React y el drag & drop. */
  key: string
  /** Valor de la biblioteca; null en opciones propias del artículo. */
  valueId: string | null
  /** Nombre de la opción propia; null si viene de la biblioteca. */
  customName: string | null
  name: string
  kitchenLabel: string | null
  priceDelta: string
  /** Multiplicador de consumo (tamaños); "1" por defecto. */
  scaleFactor: string
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
      .filter((value) => !value.value || value.value.isActive)
      .map((value) => ({
        key: value.id,
        valueId: value.valueId,
        customName: value.customName,
        name: value.customName ?? value.value?.name ?? "",
        kitchenLabel: value.customName
          ? null
          : (value.value?.kitchenLabel ?? null),
        priceDelta:
          Number(value.priceDelta) === 0
            ? ""
            : String(Number(value.priceDelta)),
        scaleFactor: String(Number(value.scaleFactor) || 1),
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
      ...(value.valueId
        ? { valueId: value.valueId }
        : { customName: value.customName ?? value.name }),
      priceDelta: isNoPriceOptionGroup(group.groupName)
        ? 0
        : Number(value.priceDelta) || 0,
      scaleFactor: Number(value.scaleFactor) || 1,
      isActive: value.isActive,
      isDefault: value.isDefault,
      effects: value.effects
        .filter(
          (effect) =>
            effect.action !== "ADD" ||
            (effect.ingredientId && Number(effect.quantity) > 0)
        )
        .map((effect) => ({
          action: effect.action,
          ...(effect.recipeIngredientId
            ? { recipeIngredientId: effect.recipeIngredientId }
            : {}),
          ...(effect.replacesIngredientId
            ? { replacesIngredientId: effect.replacesIngredientId }
            : {}),
          ...(effect.ingredientId ? { ingredientId: effect.ingredientId } : {}),
          ...(effect.quantity
            ? {
                quantity:
                  Number(effect.quantity) * (effect.multiplier ?? 1),
              }
            : {}),
          ...(effect.unit ? { unit: effect.unit } : {}),
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
  const nextSelection = selection ?? "SINGLE"
  const values = group.values
    .filter((value) => value.isActive)
    .map((value, index) => ({
      key: value.id,
      valueId: value.id,
      customName: null,
      name: value.name,
      kitchenLabel: value.kitchenLabel,
      priceDelta: "",
      scaleFactor: "1",
      isActive: true,
      isDefault: nextSelection === "SINGLE" && index === 0,
      effects: [] as OptionEffect[],
    }))

  return {
    groupId: group.id,
    groupName: group.name,
    isRequired: false,
    selection: nextSelection,
    minSelect: 0,
    maxSelect: nextSelection === "SINGLE" ? 1 : values.length,
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
  ingredients,
  effectsEnabled = false,
}: {
  /** Biblioteca de grupos de la organización. */
  library: OptionGroup[]
  presets: OptionGroupPreset[]
  value: OptionGroupDraft[]
  onChange: React.Dispatch<React.SetStateAction<OptionGroupDraft[]>>
  disabled?: boolean
  /** El contenedor ya muestra el título (diálogo de artículo). */
  hideHeader?: boolean
  /** Inventario para buscar el insumo de un efecto. */
  ingredients?: Ingredient[]
  /** Solo se pueden configurar efectos si la receta está activa. */
  effectsEnabled?: boolean
}) {
  // Operación en curso contra la API (crear grupo u opción).
  const [pending, setPending] = React.useState<string | null>(null)
  // Grupos creados en esta sesión. El prop `library` viene del servidor y no
  // se refresca hasta guardar, así que se combinan para no duplicar ni perder
  // los grupos/opciones recién creados.
  const [createdGroups, setCreatedGroups] = React.useState<OptionGroup[]>([])

  const knownGroups = React.useMemo(() => {
    if (createdGroups.length === 0) return library

    const byId = new Map(library.map((group) => [group.id, group]))
    for (const group of createdGroups) {
      if (!byId.has(group.id)) byId.set(group.id, group)
    }

    return [...byId.values()]
  }, [library, createdGroups])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const usedIds = new Set(value.map((group) => group.groupId))
  const usedNames = new Set(
    value.map((group) => group.groupName.trim().toLowerCase())
  )

  type Suggestion =
    | {
        kind: "library"
        key: string
        name: string
        usage: number
        active: boolean
        group: OptionGroup
      }
    | {
        kind: "preset"
        key: string
        name: string
        usage: number
        active: boolean
        preset: OptionGroupPreset
      }

  // La fila muestra todos los grupos disponibles sin excepción: los de la
  // biblioteca (activos o no, con o sin opciones) y todas las plantillas core.
  // Los que ya están en el artículo se marcan como activos, no se ocultan.
  const librarySuggestions: Suggestion[] = knownGroups.map((group) => ({
    kind: "library" as const,
    key: `library:${group.id}`,
    name: group.name,
    usage: group._count?.itemGroups ?? 0,
    active: usedIds.has(group.id),
    group,
  }))

  const libraryNames = new Set(
    knownGroups.map((group) => group.name.trim().toLowerCase())
  )

  const presetSuggestions: Suggestion[] = presets
    .filter(
      (preset) => !libraryNames.has(preset.name.trim().toLowerCase())
    )
    .map((preset) => ({
      kind: "preset" as const,
      key: `preset:${preset.name}`,
      name: preset.name,
      usage: 0,
      active: false,
      preset,
    }))

  const suggestions = [...librarySuggestions, ...presetSuggestions].sort(
    (left, right) =>
      right.usage - left.usage ||
      left.name.localeCompare(right.name, "es")
  )

  function updateGroup(groupId: string, changes: Partial<OptionGroupDraft>) {
    onChange((current) =>
      current.map((group) =>
        group.groupId === groupId ? { ...group, ...changes } : group
      )
    )
  }

  function updateValue(
    groupId: string,
    valueKey: string,
    changes: Partial<OptionGroupDraftValue>
  ) {
    onChange((current) =>
      current.map((group) =>
        group.groupId === groupId
          ? {
              ...group,
              values: group.values.map((item) =>
                item.key === valueKey ? { ...item, ...changes } : item
              ),
            }
          : group
      )
    )
  }

  function addGroup(group: OptionGroup, selection?: OptionSelection) {
    if (usedIds.has(group.id)) {
      toast.info(`El grupo «${group.name}» ya está en el artículo`)
      return
    }

    onChange((current) => [...current, libraryToDraft(group, selection)])
  }

  /** Añade o quita el grupo del chip; las plantillas se crean si faltan. */
  function handleSuggestionClick(suggestion: Suggestion) {
    if (suggestion.active && suggestion.kind === "library") {
      onChange((current) =>
        current.filter((group) => group.groupId !== suggestion.group.id)
      )
      toast.success(`Grupo «${suggestion.name}» eliminado`)
      return
    }

    if (suggestion.kind === "preset") {
      void handleCreatePreset(suggestion.preset)
      return
    }

    if (!suggestion.group.isActive) {
      toast.error(`El grupo «${suggestion.group.name}» está desactivado`)
      return
    }

    addGroup(suggestion.group)
  }

  /**
   * Añade una plantilla core al artículo.
   *
   * Si el grupo ya existe en la biblioteca se reutiliza; si no, se crea en la
   * biblioteca en ese momento (con sus valores) y queda disponible para otros
   * artículos.
   */
  async function handleCreatePreset(preset: OptionGroupPreset) {
    // Si el grupo ya existe en la biblioteca (por otra pestaña o un uso
    // anterior), se reutiliza en vez de intentar crear un duplicado.
    const existing = knownGroups.find(
      (group) =>
        group.name.trim().toLowerCase() === preset.name.trim().toLowerCase()
    )

    if (existing) {
      if (!existing.isActive) {
        toast.error(`El grupo «${preset.name}» está desactivado`)
        return
      }

      addGroup(existing, presetSelection(preset))
      toast.success(`Grupo «${preset.name}» añadido`)
      return
    }

    if (usedNames.has(preset.name.trim().toLowerCase())) {
      toast.info("Ese grupo ya está en el artículo")
      return
    }

    setPending(`preset:${preset.name}`)

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

    const created = result.data
    setCreatedGroups((current) => [...current, created])
    addGroup(created, presetSelection(preset))
    toast.success(`Grupo «${preset.name}» guardado`)
  }

  /** Crea el grupo en la biblioteca en cuanto se confirma (puede ir vacío). */
  async function handleCreateNewGroup(rawName: string): Promise<boolean> {
    const name = rawName.trim()

    if (!name) {
      toast.error("Escribe el nombre del grupo")
      return false
    }

    if (usedNames.has(name.toLowerCase())) {
      toast.error("Ese grupo ya está en el artículo")
      return false
    }

    const existing = knownGroups.find(
      (group) => group.name.trim().toLowerCase() === name.toLowerCase()
    )

    if (existing) {
      if (!existing.isActive) {
        toast.error(`El grupo «${existing.name}» está desactivado`)
        return false
      }

      addGroup(existing)
      toast.success(`Grupo «${existing.name}» añadido`)
      return true
    }

    setPending("group")

    const result = await createOptionGroup({ name })

    setPending(null)

    if (!result.ok || !result.data) {
      toast.error(result.message ?? "No se pudo crear el grupo")
      return false
    }

    const created = result.data
    setCreatedGroups((current) => [...current, created])
    addGroup(created)
    toast.success(`Grupo «${name}» guardado en la biblioteca`)
    return true
  }

  /**
   * Añade una opción a un grupo y la guarda en la biblioteca al instante.
   *
   * La opción queda en el grupo del negocio, no en la plantilla core: las
   * plantillas viven en código y no se modifican desde aquí.
   */
  async function addOptionValue(
    groupId: string,
    rawName: string
  ): Promise<boolean> {
    const name = rawName.trim()
    const group = value.find((candidate) => candidate.groupId === groupId)

    if (!group || !name) return false

    if (name.length > 80) {
      toast.error("El nombre de la opción no puede superar 80 caracteres")
      return false
    }

    const libraryGroup = knownGroups.find(
      (candidate) => candidate.id === group.groupId
    )
    const existingNames = new Set([
      ...group.values.map((option) => option.name.trim().toLowerCase()),
      ...(libraryGroup?.values.map((option) =>
        option.name.trim().toLowerCase()
      ) ?? []),
    ])

    if (existingNames.has(name.toLowerCase())) {
      toast.error(`La opción «${name}» ya existe en «${group.groupName}»`)
      return false
    }

    setPending(`value:${groupId}`)

    const result = await createOptionValue(groupId, { name })

    setPending(null)

    if (!result.ok || !result.data) {
      toast.error(result.message ?? "No se pudo crear la opción")
      return false
    }

    const created = result.data

    // Mantiene sincronizada la copia local del grupo con la opción nueva.
    setCreatedGroups((current) =>
      current.map((candidate) =>
        candidate.id === groupId
          ? { ...candidate, values: [...candidate.values, created] }
          : candidate
      )
    )

    onChange((current) =>
      current.map((candidate) => {
        if (candidate.groupId !== groupId) return candidate

        // El POS necesita una opción por defecto en los grupos de una sola
        // elección; la primera que se añade ocupa ese lugar.
        const firstDefault =
          candidate.selection === "SINGLE" &&
          !candidate.values.some((option) => option.isDefault)

        return {
          ...candidate,
          values: [
            ...candidate.values,
            {
              key: created.id,
              valueId: created.id,
              customName: null,
              name: created.name,
              kitchenLabel: created.kitchenLabel,
              priceDelta: "",
              scaleFactor: "1",
              isActive: true,
              isDefault: firstDefault,
              effects: [],
            },
          ],
        }
      })
    )

    toast.success(`Opción «${created.name}» guardada en la biblioteca`)
    return true
  }

  function removeValue(groupId: string, valueKey: string) {
    onChange((current) =>
      current.map((group) => {
        if (group.groupId !== groupId) return group

        const nextValues = group.values.filter(
          (item) => item.key !== valueKey
        )

        // En selección única se mantiene una opción por defecto coherente.
        let defaultAssigned = false
        const normalized =
          group.selection === "SINGLE"
            ? nextValues.map((item) => {
                const isDefault = !defaultAssigned && item.isActive
                if (isDefault) defaultAssigned = true
                return { ...item, isDefault }
              })
            : nextValues

        return { ...group, values: normalized }
      })
    )
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

      {suggestions.length > 0 ? (
        <fieldset className="min-w-0 rounded-lg border border-dashed px-2 pt-1 pb-2">
          <legend className="px-1 text-[10px] font-medium text-muted-foreground">
            Grupos de opciones
          </legend>
          <div className="flex flex-wrap items-center gap-1">
            {suggestions.map((suggestion) => {
              const inactive =
                suggestion.kind === "library" &&
                !suggestion.group.isActive

              return (
                <Button
                  key={suggestion.key}
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={disabled || pending !== null}
                  aria-pressed={suggestion.active}
                  aria-label={
                    suggestion.active
                      ? `Quitar grupo ${suggestion.name}`
                      : `Añadir grupo ${suggestion.name}`
                  }
                  className={cn(
                    "h-6 gap-1 rounded-full px-2 text-[11px] shadow-none",
                    suggestion.active
                      ? "border-chart-2/60 bg-chart-2/10 text-chart-2 hover:bg-chart-2/20 hover:text-chart-2 dark:border-chart-2/50 dark:bg-chart-2/15 dark:hover:bg-chart-2/25"
                      : "border-muted-foreground/30 text-muted-foreground hover:bg-muted hover:text-foreground",
                    inactive && "opacity-60"
                  )}
                  onClick={() => handleSuggestionClick(suggestion)}
                >
                  {suggestion.name}
                </Button>
              )
            })}
          </div>
        </fieldset>
      ) : null}

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
                ingredients={ingredients}
                effectsEnabled={effectsEnabled}
                onUpdate={(changes) => updateGroup(group.groupId, changes)}
                onUpdateValue={(valueKey, changes) =>
                  updateValue(group.groupId, valueKey, changes)
                }
                onAddValue={(name) => addOptionValue(group.groupId, name)}
                onRemoveValue={(valueKey) =>
                  removeValue(group.groupId, valueKey)
                }
                onRemove={() =>
                  onChange((current) =>
                    current.filter(
                      (candidate) => candidate.groupId !== group.groupId
                    )
                  )
                }
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <div className="rounded-lg border border-dashed p-3">
        <NewGroupPlaceholder
          position={value.length + 1}
          disabled={disabled}
          onCreate={handleCreateNewGroup}
        />
      </div>
    </div>
  )
}

function NewGroupPlaceholder({
  position,
  disabled,
  onCreate,
}: {
  position: number
  disabled?: boolean
  onCreate: (name: string) => Promise<boolean>
}) {
  const [name, setName] = React.useState("")
  const [saving, setSaving] = React.useState(false)

  async function submit() {
    if (!name.trim() || saving) return

    setSaving(true)
    const created = await onCreate(name)
    setSaving(false)

    if (created) setName("")
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className="w-3 shrink-0 text-right text-[10px] text-muted-foreground tabular-nums">
        {position}
      </span>

      <Input
        value={name}
        maxLength={80}
        disabled={disabled || saving}
        placeholder="Nuevo grupo"
        className="h-8 min-w-0 flex-1 bg-background"
        aria-label="Nombre del nuevo grupo"
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault()
            submit()
          }
        }}
      />

      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={disabled || saving || !name.trim()}
        onClick={submit}
      >
        {saving ? <Loader2Icon className="animate-spin" /> : <PlusIcon />}
        Crear
      </Button>
    </div>
  )
}

function OptionValueComposer({
  group,
  disabled,
  onAdd,
}: {
  group: OptionGroupDraft
  disabled?: boolean
  onAdd: (name: string) => Promise<boolean>
}) {
  const [adding, setAdding] = React.useState(false)
  const [name, setName] = React.useState("")
  const [saving, setSaving] = React.useState(false)

  async function submit() {
    if (!name.trim() || saving) return

    setSaving(true)
    const created = await onAdd(name)
    setSaving(false)

    if (created) setName("")
  }

  if (!adding) {
    return (
      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          className="h-8 flex-1 justify-start border-dashed text-xs text-muted-foreground shadow-none"
          onClick={() => setAdding(true)}
        >
          <PlusIcon />
          Añadir opción
        </Button>
        <InfoHint text="Se guarda en la biblioteca del negocio al confirmar, sin esperar a guardar el artículo. La plantilla core no cambia." />
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5 rounded-md border border-dashed px-2 py-1">
      <PlusIcon className="size-3.5 shrink-0 text-muted-foreground" />
      <Input
        autoFocus
        value={name}
        maxLength={80}
        disabled={disabled || saving}
        placeholder="Nombre de la opción"
        className="h-7 min-w-0 flex-1 border-0 bg-transparent px-0 text-sm shadow-none ring-0 focus-visible:border-0 focus-visible:ring-0 dark:bg-transparent"
        aria-label={`Nueva opción para ${group.groupName}`}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault()
            submit()
          }
          if (event.key === "Escape") {
            event.preventDefault()
            setAdding(false)
            setName("")
          }
        }}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        disabled={disabled || saving || !name.trim()}
        aria-label="Añadir opción"
        onClick={submit}
      >
        {saving ? <Loader2Icon className="animate-spin" /> : <CheckIcon />}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        disabled={disabled || saving}
        aria-label="Cerrar"
        onClick={() => {
          setAdding(false)
          setName("")
        }}
      >
        <XIcon />
      </Button>
    </div>
  )
}

function SortableGroupCard({
  group,
  index,
  disabled,
  ingredients,
  effectsEnabled,
  onUpdate,
  onUpdateValue,
  onAddValue,
  onRemoveValue,
  onRemove,
}: {
  group: OptionGroupDraft
  index: number
  disabled?: boolean
  ingredients?: Ingredient[]
  effectsEnabled?: boolean
  onUpdate: (changes: Partial<OptionGroupDraft>) => void
  onUpdateValue: (
    valueKey: string,
    changes: Partial<OptionGroupDraftValue>
  ) => void
  onAddValue: (name: string) => Promise<boolean>
  onRemoveValue: (valueKey: string) => void
  onRemove: () => void
}) {
  // Un grupo sin opciones (recién creado) se abre para añadirlas.
  const [open, setOpen] = React.useState(group.values.length === 0)
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

    const from = group.values.findIndex((item) => item.key === active.id)
    const to = group.values.findIndex((item) => item.key === over.id)

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
                    max={Math.max(1, group.values.length)}
                    value={Math.max(1, group.maxSelect ?? group.values.length)}
                    disabled={disabled}
                    className="w-20"
                    onChange={(event) => {
                      const next = Number(event.target.value)
                      onUpdate({
                        maxSelect: Number.isFinite(next)
                          ? Math.max(
                              1,
                              Math.min(
                                group.values.length,
                                Math.max(1, Math.trunc(next))
                              )
                            )
                          : Math.max(1, group.values.length),
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
              items={group.values.map((item) => item.key)}
              strategy={rectSortingStrategy}
            >
              <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
                {group.values.map((item, index) => (
                  <SortableOptionValue
                    key={item.key}
                    group={group}
                    item={item}
                    index={index}
                    disabled={disabled}
                    ingredients={ingredients}
                    effectsEnabled={effectsEnabled}
                    onUpdateValue={(changes) =>
                      onUpdateValue(item.key, changes)
                    }
                    onRemove={() => onRemoveValue(item.key)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          <OptionValueComposer
            group={group}
            disabled={disabled}
            onAdd={onAddValue}
          />
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
  onRemove,
  ingredients,
  effectsEnabled,
}: {
  group: OptionGroupDraft
  item: OptionGroupDraftValue
  index: number
  disabled?: boolean
  onUpdateValue: (changes: Partial<OptionGroupDraftValue>) => void
  onRemove: () => void
  ingredients?: Ingredient[]
  effectsEnabled?: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.key, disabled })

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
        "flex flex-col gap-1",
        isDragging && "relative z-10 opacity-70"
      )}
    >
      <div className="flex min-h-8 min-w-0 items-center gap-1.5 rounded-md border border-border px-2 py-0.5">
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

      {ingredients && effectsEnabled ? (
        <Popover>
          <PopoverTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label="Efectos de receta"
                disabled={disabled}
                className={cn(
                  "shrink-0",
                  item.effects.length > 0
                    ? "text-chart-2"
                    : "text-muted-foreground"
                )}
              />
            }
          >
            <BlenderIcon />
            {item.effects.length > 0 ? (
              <span className="text-[10px]">{item.effects.length}</span>
            ) : null}
          </PopoverTrigger>
          <PopoverContent
            align="end"
            className="w-[40rem] max-w-[calc(100vw-2rem)] p-3"
          >
            <OptionValueEffects
              effects={item.effects}
              priceDelta={item.priceDelta}
              ingredients={ingredients}
              disabled={disabled}
              onChange={(effects) => onUpdateValue({ effects })}
            />
          </PopoverContent>
        </Popover>
      ) : null}

      {item.valueId ? null : (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={`Quitar ${item.name}`}
          disabled={disabled}
          className="shrink-0 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
        >
          <Trash2Icon />
        </Button>
      )}
      </div>
    </div>
  )
}
