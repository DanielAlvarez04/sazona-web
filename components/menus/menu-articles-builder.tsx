"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { cn } from "cn"
import { toast } from "sonner"
import {
  ChevronDownIcon,
  GripVerticalIcon,
  MinusIcon,
  PlusIcon,
  SearchIcon,
  SoupIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"

import type { MenuItemInput } from "@/app/(app)/menus/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ButtonGroup, ButtonGroupText } from "@/components/ui/button-group"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { formatMoney, type ArticleListItem } from "@/lib/catalog"

/** Clave local para el contenedor de artículos sin grupo. */
const UNGROUPED = "__none__"
/** Clave local para el bloque de combos (van primero en el catálogo). */
const COMBO_GROUP = "__combos__"
const CATALOG_PREFIX = "catalog:"
const ITEM_PREFIX = "item:"
const GROUP_PREFIX = "group:"
/** Ids de arrastre de los grupos (cabeceras), independientes de las cards. */
const GROUP_SORT_PREFIX = "group-sort:"

const CARD_COLUMN_RANGE = { min: 2, max: 4 }
const CARD_GAP = 8

export type GroupSortMode =
  | "manual"
  | "name-asc"
  | "name-desc"
  | "price-asc"
  | "price-desc"

const SORT_OPTIONS: Array<{ value: GroupSortMode; label: string }> = [
  { value: "manual", label: "Manual" },
  { value: "name-asc", label: "A–Z" },
  { value: "name-desc", label: "Z–A" },
  { value: "price-asc", label: "Menor precio" },
  { value: "price-desc", label: "Mayor precio" },
]

const collator = new Intl.Collator("es", { sensitivity: "base" })

function groupKey(group: string | null) {
  return group ?? UNGROUPED
}

function catalogDragId(itemId: string) {
  return `${CATALOG_PREFIX}${itemId}`
}

function itemDragId(itemId: string) {
  return `${ITEM_PREFIX}${itemId}`
}

function groupDropId(group: string | null) {
  return `${GROUP_PREFIX}${groupKey(group)}`
}

function groupSortId(name: string) {
  return `${GROUP_SORT_PREFIX}${name}`
}

/** Extrae el id del artículo de cualquier id de arrastre. */
function parseItemId(id: string) {
  if (id.startsWith(CATALOG_PREFIX)) return id.slice(CATALOG_PREFIX.length)
  if (id.startsWith(ITEM_PREFIX)) return id.slice(ITEM_PREFIX.length)
  return null
}

/**
 * Prioriza la card más cercana **dentro del grupo** bajo el puntero. Así `over`
 * siempre es una card (con índice válido) y la estrategia de `SortableContext`
 * anima de forma consistente; el contenedor solo se usa si el grupo está vacío
 * o si el puntero está fuera de todos los grupos.
 */
const collisionDetection: CollisionDetection = (args) => {
  // Reordenar grupos: solo se comparan las cabeceras de grupo.
  if (String(args.active.id).startsWith(GROUP_SORT_PREFIX)) {
    const groupSortables = args.droppableContainers.filter((container) =>
      String(container.id).startsWith(GROUP_SORT_PREFIX)
    )

    return closestCenter({ ...args, droppableContainers: groupSortables })
  }

  const groupContainers = args.droppableContainers.filter((container) =>
    String(container.id).startsWith(GROUP_PREFIX)
  )
  const itemContainers = args.droppableContainers.filter((container) =>
    String(container.id).startsWith(ITEM_PREFIX)
  )

  const detect = args.pointerCoordinates ? pointerWithin : rectIntersection
  const groupHits = detect({ ...args, droppableContainers: groupContainers })

  if (groupHits.length === 0) return []

  const hoveredKey = String(groupHits[0].id).slice(GROUP_PREFIX.length)
  const itemsInGroup = itemContainers.filter(
    (container) =>
      (container.data.current as { group?: string } | undefined)?.group ===
      hoveredKey
  )

  if (itemsInGroup.length > 0) {
    const closest = closestCenter({
      ...args,
      droppableContainers: itemsInGroup,
    })

    if (closest.length > 0) return closest
  }

  return groupHits
}

/**
 * Constructor del menú: a la izquierda el catálogo y a la derecha los grupos.
 *
 * Usa `@dnd-kit` (igual que las opciones de Catálogo) para que las tarjetas se
 * reordenen en vivo al arrastrar en lugar de esperar al `drop`. El orden de
 * `selected` es el que se guarda como `sortOrder`.
 */
export function MenuArticlesBuilder({
  articles,
  groups,
  selected,
  onGroupsChange,
  onSelectedChange,
  disabled = false,
}: {
  articles: ArticleListItem[]
  groups: string[]
  selected: MenuItemInput[]
  onGroupsChange: (groups: string[]) => void
  onSelectedChange: (items: MenuItemInput[]) => void
  disabled?: boolean
}) {
  const [search, setSearch] = React.useState("")
  const [cardColumns, setCardColumns] = React.useState(4)
  const [sortModes, setSortModes] = React.useState<
    Record<string, GroupSortMode>
  >({})
  const [openGroups, setOpenGroups] = React.useState<Record<string, boolean>>(
    {}
  )
  const [activeItemId, setActiveItemId] = React.useState<string | null>(null)
  const [activeDragId, setActiveDragId] = React.useState<string | null>(null)
  const [activeGroupSortId, setActiveGroupSortId] = React.useState<
    string | null
  >(null)
  const [overId, setOverId] = React.useState<string | null>(null)
  const [catalogWidth, setCatalogWidth] = React.useState(0)
  const beforeDrag = React.useRef<MenuItemInput[] | null>(null)
  const catalogRef = React.useRef<HTMLElement | null>(null)

  // Se mide la columna de artículos para replicar el tamaño de sus cards en el
  // constructor, sin importar el reparto 2fr/3fr ni el ancho del diálogo.
  React.useEffect(() => {
    const node = catalogRef.current
    if (!node) return

    const observer = new ResizeObserver((entries) => {
      setCatalogWidth(entries[0]?.contentRect.width ?? 0)
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const cardWidth =
    catalogWidth > 0
      ? Math.round((catalogWidth - (cardColumns - 1) * CARD_GAP) / cardColumns)
      : 140

  const byId = new Map(articles.map((article) => [article.id, article]))
  const selectedIds = new Set(selected.map((row) => row.itemId))

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const renumber = (rows: MenuItemInput[]) =>
    rows.map((row, index) => ({ ...row, sortOrder: index }))

  const itemsOf = (group: string | null) =>
    selected
      .filter((row) => (row.group ?? null) === group)
      .sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0))

  /**
   * Filas por contenedor con referencia estable mientras no cambie el menú.
   * Necesario para que `SortableContext` no reciba un array nuevo en cada
   * render: dnd-kit desactiva las transiciones cuando cambia `items`.
   */
  const rowsByGroup = React.useMemo(() => {
    const map = new Map<string, MenuItemInput[]>()
    const containers: Array<string | null> = [...groups, null]

    for (const container of containers) {
      map.set(
        groupKey(container),
        selected
          .filter((row) => (row.group ?? null) === container)
          .sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0))
      )
    }

    return map
  }, [selected, groups])

  function markManual(group: string | null) {
    setSortModes((current) => ({
      ...current,
      [groupKey(group)]: "manual",
    }))
  }

  function isGroupOpen(name: string) {
    return openGroups[name] ?? true
  }

  function setGroupOpen(name: string, open: boolean) {
    setOpenGroups((current) =>
      (current[name] ?? true) === open ? current : { ...current, [name]: open }
    )
  }

  const sameOrder = (left: MenuItemInput[], right: MenuItemInput[]) =>
    left.length === right.length &&
    left.every(
      (row, index) =>
        row.itemId === right[index].itemId &&
        (row.group ?? null) === (right[index].group ?? null)
    )

  /** Mueve (o agrega) un artículo a un grupo, antes de `beforeItemId` si se indica. */
  function moveItem(
    itemId: string,
    group: string | null,
    beforeItemId: string | null
  ) {
    if (disabled) return

    const article = byId.get(itemId)
    const current = selected.find((row) => row.itemId === itemId)

    if (!current && (!article || !article.isActive)) return

    const sourceGroup = current?.group ?? null
    const base = current
      ? selected.filter((row) => row.itemId !== itemId)
      : [...selected]
    const next: MenuItemInput[] = []

    for (const container of [...groups, null] as Array<string | null>) {
      const rows = base
        .filter((row) => (row.group ?? null) === container)
        .sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0))

      if (container === group) {
        const index = beforeItemId
          ? rows.findIndex((row) => row.itemId === beforeItemId)
          : rows.length
        rows.splice(index < 0 ? rows.length : index, 0, {
          itemId,
          group: container,
          sortOrder: 0,
        })
      }

      next.push(...rows)
    }

    if (sameOrder(next, selected)) return

    markManual(sourceGroup)
    markManual(group)
    onSelectedChange(renumber(next))
  }

  function toggleArticle(article: ArticleListItem) {
    if (disabled) return

    if (selectedIds.has(article.id)) {
      onSelectedChange(
        renumber(selected.filter((row) => row.itemId !== article.id))
      )
      return
    }

    if (!article.isActive) return

    onSelectedChange(
      renumber([...selected, { itemId: article.id, group: null }])
    )
  }

  function toggleCategory(
    categoryArticles: ArticleListItem[],
    selectAll: boolean
  ) {
    if (disabled) return

    const ids = new Set(
      categoryArticles
        .filter((article) => article.isActive || selectedIds.has(article.id))
        .map((article) => article.id)
    )

    if (!selectAll) {
      onSelectedChange(
        renumber(selected.filter((row) => !ids.has(row.itemId)))
      )
      return
    }

    const missing = categoryArticles
      .filter((article) => article.isActive && !selectedIds.has(article.id))
      .map((article) => ({ itemId: article.id, group: null }))

    if (missing.length === 0) return

    onSelectedChange(renumber([...selected, ...missing]))
  }

  function removeItem(itemId: string) {
    onSelectedChange(
      renumber(selected.filter((row) => row.itemId !== itemId))
    )
  }

  function handleDragStart(event: DragStartEvent) {
    const dragId = String(event.active.id)

    if (dragId.startsWith(GROUP_SORT_PREFIX)) {
      setActiveGroupSortId(dragId)
      setOverId(null)
      return
    }

    const itemId = parseItemId(dragId)
    if (!itemId) return

    beforeDrag.current = selected
    setActiveDragId(dragId)
    setActiveItemId(itemId)
    setOverId(null)
  }

  /** Grupo y posición que representa el objetivo actual del arrastre. */
  function resolveTarget(overId: string, activeItemIdToResolve: string) {
    if (overId.startsWith(GROUP_PREFIX)) {
      const key = overId.slice(GROUP_PREFIX.length)
      return {
        group: key === UNGROUPED ? null : key,
        beforeItemId: null as string | null,
      }
    }

    const overItemId = parseItemId(overId)
    if (!overItemId || overItemId === activeItemIdToResolve) return null

    const target = selected.find((row) => row.itemId === overItemId)
    if (!target) return null

    return { group: target.group ?? null, beforeItemId: overItemId }
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event
    if (!over) return

    const activeId = String(active.id)
    if (activeId.startsWith(GROUP_SORT_PREFIX)) return

    const nextOverId = String(over.id)
    setOverId((current) => (current === nextOverId ? current : nextOverId))

    const itemId = parseItemId(activeId)
    if (!itemId) return

    const target = resolveTarget(String(over.id), itemId)
    if (!target) return

    // Al pasar sobre un grupo colapsado se expande para poder soltar ahí.
    if (target.group && !isGroupOpen(target.group)) {
      setGroupOpen(target.group, true)
    }

    // El reordenamiento en vivo es exclusivo del constructor: lo que viene del
    // catálogo se agrega/mueve una sola vez al soltar.
    if (!activeId.startsWith(ITEM_PREFIX)) return

    // Dentro del mismo grupo el preview lo hace `SortableContext`; solo se
    // mueve el estado al cambiar de contenedor (menos re-renders y sin saltos).
    const current = selected.find((row) => row.itemId === itemId)
    if (!current || (current.group ?? null) === target.group) return

    moveItem(itemId, target.group, target.beforeItemId)
  }

  function handleDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id)

    if (activeId.startsWith(GROUP_SORT_PREFIX)) {
      setActiveGroupSortId(null)

      if (!event.over) return

      const from = groups.findIndex((group) => groupSortId(group) === activeId)
      const to = groups.findIndex(
        (group) => groupSortId(group) === String(event.over!.id)
      )

      if (from < 0 || to < 0 || from === to) return

      const next = [...groups]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      onGroupsChange(next)
      return
    }

    const itemId = parseItemId(activeId)
    const snapshot = beforeDrag.current

    setActiveItemId(null)
    setActiveDragId(null)
    setOverId(null)
    beforeDrag.current = null

    if (!itemId) return

    if (!event.over) {
      // Soltado fuera de los grupos: se restaura la posición original.
      if (snapshot) onSelectedChange(renumber(snapshot))
      return
    }

    const target = resolveTarget(String(event.over.id), itemId)
    if (!target) return

    const origin = snapshot?.find((row) => row.itemId === itemId)
    const fromCatalog = activeId.startsWith(CATALOG_PREFIX)

    // Si viene del mismo grupo (y no del catálogo), se aplica el orden final
    // con semántica de `arrayMove`; el resto conserva la posición del preview.
    if (!fromCatalog && origin && (origin.group ?? null) === target.group) {
      if (target.beforeItemId) {
        reorderWithin(itemId, target.group, target.beforeItemId)
      } else {
        moveToEnd(itemId, target.group)
      }
      return
    }

    moveItem(itemId, target.group, target.beforeItemId)
  }

  /** Reemplaza el orden de las filas de un contenedor sin tocar los demás. */
  function applyContainerRows(group: string | null, rows: MenuItemInput[]) {
    const queue = [...rows]
    const next = selected.map((row) =>
      (row.group ?? null) === group ? queue.shift()! : row
    )

    markManual(group)
    onSelectedChange(renumber(next))
  }

  function reorderWithin(
    itemId: string,
    group: string | null,
    overItemId: string
  ) {
    const rows = itemsOf(group)
    const from = rows.findIndex((row) => row.itemId === itemId)
    const to = rows.findIndex((row) => row.itemId === overItemId)

    if (from < 0 || to < 0 || from === to) return

    applyContainerRows(group, arrayMove(rows, from, to))
  }

  function moveToEnd(itemId: string, group: string | null) {
    const rows = itemsOf(group)
    const from = rows.findIndex((row) => row.itemId === itemId)

    if (from < 0 || from === rows.length - 1) return

    const reordered = [...rows]
    const [moved] = reordered.splice(from, 1)
    reordered.push(moved)
    applyContainerRows(group, reordered)
  }

  function handleDragCancel() {
    const snapshot = beforeDrag.current

    setActiveItemId(null)
    setActiveDragId(null)
    setActiveGroupSortId(null)
    setOverId(null)
    beforeDrag.current = null

    if (snapshot) onSelectedChange(renumber(snapshot))
  }

  function sortGroup(group: string | null, mode: GroupSortMode) {
    setSortModes((current) => ({ ...current, [groupKey(group)]: mode }))

    if (mode === "manual") return

    const rows = itemsOf(group)
    const compare = (left: MenuItemInput, right: MenuItemInput) => {
      const a = byId.get(left.itemId)
      const b = byId.get(right.itemId)
      if (!a || !b) return 0

      switch (mode) {
        case "name-asc":
          return collator.compare(a.name, b.name)
        case "name-desc":
          return collator.compare(b.name, a.name)
        case "price-asc":
          return Number(a.price) - Number(b.price)
        case "price-desc":
          return Number(b.price) - Number(a.price)
      }
    }

    const queue = [...rows].sort(compare)
    const next = selected.map((row) =>
      (row.group ?? null) === group ? queue.shift()! : row
    )

    onSelectedChange(renumber(next))
  }

  function addGroup() {
    let index = groups.length + 1
    while (groups.includes(`Grupo ${index}`)) index += 1
    onGroupsChange([...groups, `Grupo ${index}`])
  }

  function renameGroup(previous: string, next: string): boolean {
    const name = next.trim()

    if (!name || name === previous) return false
    if (groups.some((group) => group === name)) {
      toast.error("Ya existe un grupo con ese nombre")
      return false
    }

    onGroupsChange(groups.map((group) => (group === previous ? name : group)))
    onSelectedChange(
      selected.map((row) =>
        row.group === previous ? { ...row, group: name } : row
      )
    )
    setSortModes((current) => {
      const updated = { ...current }
      if (updated[previous]) {
        updated[name] = updated[previous]
        delete updated[previous]
      }
      return updated
    })
    setOpenGroups((current) => {
      if (!(previous in current)) return current
      const updated = { ...current }
      updated[name] = updated[previous]
      delete updated[previous]
      return updated
    })

    return true
  }

  function removeGroup(name: string) {
    onGroupsChange(groups.filter((group) => group !== name))
    onSelectedChange(
      renumber(
        selected.map((row) =>
          row.group === name ? { ...row, group: null } : row
        )
      )
    )
    setSortModes((current) => {
      const updated = { ...current }
      delete updated[name]
      return updated
    })
    setOpenGroups((current) => {
      if (!(name in current)) return current
      const updated = { ...current }
      delete updated[name]
      return updated
    })
  }

  const categories = React.useMemo(() => {
    const term = search.trim().toLowerCase()
    const map = new Map<
      string,
      { id: string; name: string; articles: ArticleListItem[] }
    >()

    for (const article of articles) {
      if (term && !article.name.toLowerCase().includes(term)) continue

      const id = article.isCombo
        ? COMBO_GROUP
        : (article.category?.id ?? UNGROUPED)
      const name = article.isCombo
        ? "Combos"
        : (article.category?.name ?? "Sin categoría")
      const bucket = map.get(id) ?? { id, name, articles: [] }
      bucket.articles.push(article)
      map.set(id, bucket)
    }

    return [...map.values()]
      .map((category) => ({
        ...category,
        articles: category.articles.sort(
          (left, right) =>
            Number(right.isActive) - Number(left.isActive) ||
            collator.compare(left.name, right.name)
        ),
      }))
      .sort((left, right) => {
        if (left.id === COMBO_GROUP) return -1
        if (right.id === COMBO_GROUP) return 1
        if (left.id === UNGROUPED) return 1
        if (right.id === UNGROUPED) return -1
        return collator.compare(left.name, right.name)
      })
  }, [articles, search])

  const activeArticle = activeItemId ? (byId.get(activeItemId) ?? null) : null

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="grid items-stretch gap-6 lg:grid-cols-[minmax(0,2fr)_1px_minmax(0,3fr)]">
        {/* Catálogo */}
        <section
          ref={catalogRef}
          className="flex min-w-0 flex-col gap-3"
        >
          <div
            data-slot="header-articulos"
            className="sticky top-0 z-20 flex flex-col gap-2 bg-popover/95 py-2 backdrop-blur"
          >
            <div className="flex items-baseline justify-between gap-2">
              <Label className="text-sm font-medium">Artículos</Label>
              <span className="text-xs text-muted-foreground tabular-nums">
                {selected.length} en el menú
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <ButtonGroup aria-label="Tamaño de las tarjetas">
                <ButtonGroupText className="h-8 px-2 text-xs">
                  Tamaño
                </ButtonGroupText>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  aria-label="Tarjetas más pequeñas"
                  title="Tarjetas más pequeñas"
                  disabled={cardColumns >= CARD_COLUMN_RANGE.max}
                  onClick={() =>
                    setCardColumns((current) =>
                      Math.min(CARD_COLUMN_RANGE.max, current + 1)
                    )
                  }
                >
                  <MinusIcon className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  aria-label="Tarjetas más grandes"
                  title="Tarjetas más grandes"
                  disabled={cardColumns <= CARD_COLUMN_RANGE.min}
                  onClick={() =>
                    setCardColumns((current) =>
                      Math.max(CARD_COLUMN_RANGE.min, current - 1)
                    )
                  }
                >
                  <PlusIcon className="size-4" />
                </Button>
              </ButtonGroup>

              <div className="relative min-w-40 flex-1">
                <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por nombre"
                  aria-label="Buscar artículos por nombre"
                  className="h-8 pl-8"
                />
              </div>
            </div>
          </div>

          <div data-slot="cards-articulos" className="flex flex-col gap-4">
            {categories.length === 0 ? (
              <p className="rounded-lg border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">
                No hay artículos que coincidan con la búsqueda.
              </p>
            ) : (
              categories.map((category, index) => {
                const selectable = category.articles.filter(
                  (article) => article.isActive || selectedIds.has(article.id)
                )
                const allSelected =
                  selectable.length > 0 &&
                  selectable.every((article) => selectedIds.has(article.id))
                const someSelected =
                  !allSelected &&
                  selectable.some((article) => selectedIds.has(article.id))

                return (
                  <React.Fragment key={category.id}>
                    {index > 0 ? <Separator /> : null}
                    <div className="flex flex-col gap-2">
                      <label className="flex items-center gap-2 text-sm font-medium">
                        <Checkbox
                          checked={allSelected}
                          indeterminate={someSelected}
                          disabled={disabled || selectable.length === 0}
                          onCheckedChange={(value) =>
                            toggleCategory(category.articles, Boolean(value))
                          }
                          aria-label={`Seleccionar todos los artículos de ${category.name}`}
                        />
                        <span className="truncate">{category.name}</span>
                        <span className="text-xs font-normal text-muted-foreground tabular-nums">
                          {category.articles.length}
                        </span>
                      </label>

                      <div
                        className="grid gap-2"
                        style={{
                          gridTemplateColumns: `repeat(${cardColumns}, minmax(0, 1fr))`,
                        }}
                      >
                        {category.articles.map((article) => (
                          <CatalogCard
                            key={article.id}
                            article={article}
                            selected={selectedIds.has(article.id)}
                            disabled={
                              disabled ||
                              (!article.isActive &&
                                !selectedIds.has(article.id))
                            }
                            onToggle={() => toggleArticle(article)}
                          />
                        ))}
                      </div>
                    </div>
                  </React.Fragment>
                )
              })
            )}
          </div>
        </section>

        <Separator orientation="vertical" className="hidden lg:block" />
        <Separator className="lg:hidden" />

        {/* Constructor */}
        <section className="flex min-w-0 flex-col gap-3">
          <div>
            <Label className="text-sm font-medium">Constructor</Label>
            <p className="text-xs text-muted-foreground">
              Arrastra artículos a los grupos para armar el menú.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <SortableContext
              items={groups.map((group) => groupSortId(group))}
              strategy={verticalListSortingStrategy}
            >
              {groups.map((group, index) => (
                <GroupSection
                  key={group}
                  group={group}
                  title={group}
                  index={index}
                  rows={rowsByGroup.get(groupKey(group)) ?? []}
                  byId={byId}
                  cardWidth={cardWidth}
                  mode={sortModes[groupKey(group)] ?? "manual"}
                  disabled={disabled}
                  overId={overId}
                  activeDragId={activeDragId}
                  activeGroupSortId={activeGroupSortId}
                  open={isGroupOpen(group)}
                  onOpenChange={(open) => setGroupOpen(group, open)}
                  onSort={(next) => sortGroup(group, next)}
                  onRename={(next) => renameGroup(group, next)}
                  onRemove={() => removeGroup(group)}
                  onRemoveItem={removeItem}
                />
              ))}
            </SortableContext>

            <div className="relative flex items-center justify-center">
              <Separator className="absolute inset-x-0 top-1/2 -translate-y-1/2" />
              <Button
                type="button"
                variant="secondary"
                className="relative z-10 w-max bg-secondary text-foreground! hover:bg-secondary/80 hover:text-foreground!"
                disabled={disabled}
                onClick={addGroup}
              >
                <PlusIcon />
                Nuevo grupo
              </Button>
            </div>

            <UngroupedSection
              rows={rowsByGroup.get(groupKey(null)) ?? []}
              byId={byId}
              cardWidth={cardWidth}
              mode={sortModes[groupKey(null)] ?? "manual"}
              disabled={disabled}
              overId={overId}
              activeDragId={activeDragId}
              onSort={(next) => sortGroup(null, next)}
              onRemoveItem={removeItem}
            />
          </div>
        </section>
      </div>

      {/*
       * El overlay es el clon que sigue al cursor. En Artículos la card
       * original se queda quieta; en el Constructor el original se oculta y
       * este clon hace de ghost. Va al body porque el diálogo usa `transform`,
       * que desancla los elementos `fixed`.
       */}
      {activeArticle && typeof document !== "undefined"
        ? createPortal(
            <DragOverlay
              dropAnimation={null}
              zIndex={100}
              style={{ pointerEvents: "none" }}
            >
              <div style={{ width: cardWidth, pointerEvents: "none" }}>
                <ArticleCardVisual article={activeArticle} />
              </div>
            </DragOverlay>,
            document.body
          )
        : null}
    </DndContext>
  )
}

/** Card del catálogo: clic para agregar/quitar, arrastrar para asignar grupo. */
function CatalogCard({
  article,
  selected,
  disabled,
  onToggle,
}: {
  article: ArticleListItem
  selected: boolean
  disabled: boolean
  onToggle: () => void
}) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: catalogDragId(article.id),
    disabled,
  })

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onToggle}
      className={cn(
        disabled ? "cursor-default" : "cursor-grab active:cursor-grabbing"
      )}
    >
      <ArticleCardVisual article={article} selected={selected} />
    </div>
  )
}

/** Card dentro de un grupo: se reordena en vivo y se quita con la ✕. */
function SortableMenuCard({
  article,
  disabled,
  groupId,
  active = false,
  highlighted = false,
  onRemove,
}: {
  article: ArticleListItem
  disabled: boolean
  /** Clave del grupo, para que la detección de colisiones filtre sus cards. */
  groupId: string
  /** La card se está arrastrando: se oculta y el `DragOverlay` hace de ghost. */
  active?: boolean
  highlighted?: boolean
  onRemove: () => void
}) {
  const sortableData = React.useMemo(() => ({ group: groupId }), [groupId])
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({
      id: itemDragId(article.id),
      disabled,
      data: sortableData,
    })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "touch-none rounded-xl transition-shadow",
        highlighted && "ring-2 ring-ring/60",
        active && "opacity-0"
      )}
    >
      <div
        {...attributes}
        {...listeners}
        className={cn(!disabled && "cursor-grab active:cursor-grabbing")}
      >
        <ArticleCardVisual
          article={article}
          onRemove={onRemove}
          disabled={disabled}
        />
      </div>
    </div>
  )
}

/** Imagen, precio y nombre; opcionalmente la ✕ para quitarla del menú. */
function ArticleCardVisual({
  article,
  selected = false,
  disabled = false,
  onRemove,
}: {
  article: ArticleListItem
  selected?: boolean
  disabled?: boolean
  onRemove?: () => void
}) {
  const [failedSrc, setFailedSrc] = React.useState<string | null>(null)
  const showFallback = !article.imageUrl || failedSrc === article.imageUrl

  return (
    <div
      className={cn(
        "relative aspect-square w-full overflow-hidden rounded-xl border bg-muted text-left select-none",
        selected && "ring-2 ring-primary",
        !article.isActive && "opacity-80"
      )}
    >
      <div className="absolute inset-0 bg-muted">
        {showFallback ? (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            <SoupIcon className="size-8" aria-hidden />
            <span className="sr-only">Sin imagen</span>
          </div>
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={article.imageUrl ?? undefined}
            alt={article.name}
            draggable={false}
            className={cn(
              "size-full object-cover",
              !article.isActive && "grayscale"
            )}
            onError={() => setFailedSrc(article.imageUrl ?? null)}
          />
        )}
      </div>

      {/* Mismo degradado que las tarjetas de Catálogo. */}
      <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/85 via-black/30 to-black/10" />

      <div className="relative flex size-full flex-col p-1.5 text-white">
        {onRemove ? (
          <Button
            type="button"
            variant="destructive"
            size="icon-xs"
            aria-label={`Quitar ${article.name} del menú`}
            title="Quitar del menú"
            disabled={disabled}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation()
              onRemove()
            }}
            className="ml-auto bg-destructive text-white shadow-sm hover:bg-destructive/90 dark:bg-destructive dark:text-white dark:hover:bg-destructive/90"
          >
            <XIcon />
          </Button>
        ) : null}

        <div className="mt-auto flex min-w-0 flex-col gap-0.5">
          <span className="text-sm leading-none font-normal text-white tabular-nums drop-shadow-sm">
            {formatMoney(article.price)}
          </span>
          <p
            className="line-clamp-2 text-pretty text-[13px] leading-tight font-semibold text-white drop-shadow-sm"
            title={article.name}
          >
            {article.name}
          </p>
        </div>
      </div>
    </div>
  )
}

/** Nombre editable con guardado automático al salir o con Enter. */
function GroupNameInput({
  value,
  disabled,
  onCommit,
}: {
  value: string
  disabled: boolean
  onCommit: (next: string) => boolean
}) {
  const [draft, setDraft] = React.useState(value)

  function commit() {
    const next = draft.trim()

    if (!next || next === value) {
      setDraft(value)
      return
    }

    if (!onCommit(next)) setDraft(value)
  }

  return (
    <Input
      value={draft}
      disabled={disabled}
      maxLength={40}
      aria-label="Nombre del grupo"
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault()
          event.currentTarget.blur()
        }
        if (event.key === "Escape") {
          setDraft(value)
          event.currentTarget.blur()
        }
      }}
      className="h-8 w-48 border-transparent bg-transparent px-1.5 text-sm font-medium shadow-none hover:border-input focus-visible:border-input"
    />
  )
}

/** Tarjetas de un grupo (o de «Sin grupo»), con su `SortableContext`. */
function GroupCards({
  group,
  rows,
  byId,
  cardWidth,
  disabled,
  overId,
  activeDragId,
  onRemoveItem,
}: {
  group: string | null
  rows: MenuItemInput[]
  byId: Map<string, ArticleListItem>
  cardWidth: number
  disabled: boolean
  overId: string | null
  activeDragId: string | null
  onRemoveItem: (itemId: string) => void
}) {
  // Referencia estable para que dnd-kit conserve las transiciones.
  const itemIds = React.useMemo(
    () => rows.map((row) => itemDragId(row.itemId)),
    [rows]
  )

  return (
    <div
      className="grid min-h-16 gap-2 border-t p-2"
      style={{ gridTemplateColumns: `repeat(auto-fill, ${cardWidth}px)` }}
    >
      <SortableContext items={itemIds} strategy={rectSortingStrategy}>
        {rows.length === 0 ? (
          <p className="col-span-full px-1 py-2 text-xs text-muted-foreground">
            Arrastra artículos aquí.
          </p>
        ) : (
          rows.map((row) => {
            const article = byId.get(row.itemId)
            if (!article) return null

            return (
              <SortableMenuCard
                key={row.itemId}
                article={article}
                disabled={disabled}
                groupId={groupKey(group)}
                active={activeDragId === itemDragId(row.itemId)}
                highlighted={overId === itemDragId(row.itemId)}
                onRemove={() => onRemoveItem(row.itemId)}
              />
            )
          })
        )}
      </SortableContext>
    </div>
  )
}

/** Select de ordenamiento compartido por grupos y «Sin grupo». */
function GroupSortSelect({
  mode,
  title,
  onSort,
}: {
  mode: GroupSortMode
  title: string
  onSort: (mode: GroupSortMode) => void
}) {
  return (
    <Select
      value={mode}
      onValueChange={(next) => onSort((next as GroupSortMode) ?? "manual")}
      items={SORT_OPTIONS}
    >
      <SelectTrigger
        size="sm"
        className="h-8 w-36 shrink-0"
        aria-label={`Orden de ${title}`}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SORT_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/**
 * Grupo real del constructor: colapsable, numerado y arrastrable para
 * reordenar los grupos, con nombre editable, orden y botón de eliminar.
 */
function GroupSection({
  group,
  title,
  index,
  rows,
  byId,
  cardWidth,
  mode,
  disabled,
  overId,
  activeDragId,
  activeGroupSortId,
  open,
  onOpenChange,
  onSort,
  onRename,
  onRemove,
  onRemoveItem,
}: {
  group: string
  title: string
  index: number
  rows: MenuItemInput[]
  byId: Map<string, ArticleListItem>
  cardWidth: number
  mode: GroupSortMode
  disabled: boolean
  overId: string | null
  activeDragId: string | null
  activeGroupSortId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSort: (mode: GroupSortMode) => void
  onRename: (next: string) => boolean
  onRemove: () => void
  onRemoveItem: (itemId: string) => void
}) {
  const sortable = useSortable({
    id: groupSortId(title),
    disabled,
    data: { type: "group" },
  })
  const droppable = useDroppable({ id: groupDropId(group) })

  const setNodeRef = (node: HTMLElement | null) => {
    sortable.setNodeRef(node)
    droppable.setNodeRef(node)
  }

  const highlighted =
    droppable.isOver ||
    overId === groupDropId(group) ||
    rows.some((row) => itemDragId(row.itemId) === overId)

  return (
    <Collapsible
      ref={setNodeRef}
      open={open}
      onOpenChange={onOpenChange}
      style={{
        transform: CSS.Transform.toString(sortable.transform),
        transition: sortable.transition,
      }}
      className={cn(
        "overflow-hidden rounded-lg border transition-colors",
        highlighted && "border-primary bg-primary/5",
        sortable.isDragging && "relative z-10 opacity-70",
        activeGroupSortId === groupSortId(title) && "border-primary"
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
            aria-label={`Reordenar ${title}`}
            className="shrink-0 cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
            disabled={disabled}
            {...sortable.attributes}
            {...sortable.listeners}
          >
            <GripVerticalIcon />
          </Button>
        </div>

        <GroupNameInput value={title} disabled={disabled} onCommit={onRename} />

        <Badge
          variant="outline"
          aria-label={`${rows.length} artículos`}
          className="shrink-0 border-chart-4/50 bg-chart-4/10 text-chart-4 tabular-nums dark:border-chart-4/40 dark:bg-chart-4/15 dark:text-chart-4"
        >
          {rows.length}
        </Badge>

        <CollapsibleTrigger
          type="button"
          className="flex min-w-0 flex-1 items-center justify-end rounded-md p-1 text-muted-foreground"
          aria-label={`${open ? "Contraer" : "Expandir"} ${title}`}
        >
          <ChevronDownIcon
            className={cn(
              "size-4 shrink-0 transition-transform",
              open && "rotate-180"
            )}
          />
        </CollapsibleTrigger>

        <div className="flex shrink-0 items-center gap-1.5">
          <GroupSortSelect mode={mode} title={title} onSort={onSort} />

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Eliminar ${title}`}
            disabled={disabled}
            onClick={onRemove}
          >
            <Trash2Icon />
          </Button>
        </div>
      </div>

      <CollapsibleContent>
        <GroupCards
          group={group}
          rows={rows}
          byId={byId}
          cardWidth={cardWidth}
          disabled={disabled}
          overId={overId}
          activeDragId={activeDragId}
          onRemoveItem={onRemoveItem}
        />
      </CollapsibleContent>
    </Collapsible>
  )
}

/** Zona de «Sin grupo»: siempre visible, sin numeración ni colapso. */
function UngroupedSection({
  rows,
  byId,
  cardWidth,
  mode,
  disabled,
  overId,
  activeDragId,
  onSort,
  onRemoveItem,
}: {
  rows: MenuItemInput[]
  byId: Map<string, ArticleListItem>
  cardWidth: number
  mode: GroupSortMode
  disabled: boolean
  overId: string | null
  activeDragId: string | null
  onSort: (mode: GroupSortMode) => void
  onRemoveItem: (itemId: string) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: groupDropId(null) })
  const highlighted =
    isOver ||
    overId === groupDropId(null) ||
    rows.some((row) => itemDragId(row.itemId) === overId)

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-xl border border-dashed transition-colors",
        highlighted && "border-primary bg-primary/5"
      )}
    >
      <div className="flex items-center gap-1.5 px-2 py-1.5">
        <span className="min-w-0 flex-1 truncate px-1.5 text-sm font-medium text-muted-foreground">
          Sin grupo
        </span>
        <GroupSortSelect mode={mode} title="Sin grupo" onSort={onSort} />
      </div>

      <GroupCards
        group={null}
        rows={rows}
        byId={byId}
        cardWidth={cardWidth}
        disabled={disabled}
        overId={overId}
        activeDragId={activeDragId}
        onRemoveItem={onRemoveItem}
      />
    </div>
  )
}
