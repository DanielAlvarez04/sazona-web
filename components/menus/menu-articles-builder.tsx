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
  type DragMoveEvent,
  type DragOverEvent,
  type DragStartEvent,
  type Modifier,
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
  CheckIcon,
  GripVerticalIcon,
  GroupIcon,
  LayersIcon,
  PlusIcon,
  SearchIcon,
  SoupIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"

import type { MenuItemInput } from "@/app/(app)/menus/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { EntityImage } from "@/components/ui/entity-image"
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
import { jalapenoChipClass } from "@/lib/chips"
import { CARD_IMAGE_SIZES } from "@/lib/images"

import {
  MENU_WHEEL_DEAD_ZONE,
  MenuRadialGroups,
  buildMenuWheelLayout,
  menuWheelTargetAt,
  menuWheelTargetCenter,
} from "./menu-radial-groups"

/** Clave local para el contenedor de artículos sin grupo. */
const UNGROUPED = "__none__"
/** Clave local para el bloque de combos (van primero en el catálogo). */
const COMBO_GROUP = "__combos__"
const CATALOG_PREFIX = "catalog:"
const ITEM_PREFIX = "item:"
const GROUP_PREFIX = "group:"
/** Ids de arrastre de los grupos (cabeceras), independientes de las cards. */
const GROUP_SORT_PREFIX = "group-sort:"

/** Modo del layout: dos scrolls o el scroll único anterior. */
export type MenuBuilderLayout = "split-scroll" | "single-scroll"

/** Tamaño fijo de las cards del catálogo: 4 por fila. */
const CARD_COLUMNS = 4
const CARD_GAP = 8
/**
 * Duración del shake. Debe coincidir con `np-menu-card-shake` de globals.css.
 * Con el timestamp de selección se calcula un `animation-delay` negativo para
 * que todas las cards queden sincronizadas al mismo reloj.
 */
const SHAKE_DURATION_MS = 180

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
const baseCollisionDetection: CollisionDetection = (args) => {
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
  layout = "split-scroll",
}: {
  articles: ArticleListItem[]
  groups: string[]
  selected: MenuItemInput[]
  onGroupsChange: (groups: string[]) => void
  onSelectedChange: (items: MenuItemInput[]) => void
  disabled?: boolean
  layout?: MenuBuilderLayout
}) {
  const [search, setSearch] = React.useState("")
  const [sortModes, setSortModes] = React.useState<
    Record<string, GroupSortMode>
  >({})
  const [openGroups, setOpenGroups] = React.useState<Record<string, boolean>>(
    {}
  )
  /** Grupo al que se agregan los artículos al hacer clic. */
  const [destination, setDestination] = React.useState<string | null>(null)
  const [filter, setFilter] = React.useState<"all" | "unassigned" | "in-menu">(
    "unassigned"
  )
  /** Artículos marcados para asignar/mover, con el instante de selección. */
  const [pending, setPending] = React.useState<Record<string, number>>({})
  const [wheelOrigin, setWheelOrigin] = React.useState<{
    x: number
    y: number
  } | null>(null)
  /** `undefined` = sin destino, `null` = «Sin grupo». */
  const [wheelTarget, setWheelTarget] = React.useState<
    string | null | undefined
  >(undefined)
  const [activeItemId, setActiveItemId] = React.useState<string | null>(null)
  const [activeDragId, setActiveDragId] = React.useState<string | null>(null)
  const [wheelDragging, setWheelDragging] = React.useState(false)
  const [activeGroupSortId, setActiveGroupSortId] = React.useState<
    string | null
  >(null)
  const [overId, setOverId] = React.useState<string | null>(null)
  const [catalogWidth, setCatalogWidth] = React.useState(0)
  const beforeDrag = React.useRef<MenuItemInput[] | null>(null)
  const catalogRef = React.useRef<HTMLDivElement | null>(null)
  const ungroupedRef = React.useRef<HTMLDivElement | null>(null)
  /** Evita que el clic que sigue a un arrastre agregue/quita el artículo. */
  const suppressClick = React.useRef(false)
  const clickTimer = React.useRef<number | null>(null)
  /** El drag actual usa la rueda radial (solo pointer desde el catálogo). */
  const wheelActiveRef = React.useRef(false)
  /** Centro del chip o del botón de cancelar al que se ancla el overlay. */
  const snapCenterRef = React.useRef<{ x: number; y: number } | null>(null)

  /**
   * Con la rueda radial no se usan los droppables del constructor: el destino
   * se calcula por geometría. Así los grupos no se resaltan ni se auto-expanden
   * mientras el puntero pasa por encima.
   */
  const collisionDetection = React.useCallback<CollisionDetection>((args) => {
    if (
      String(args.active.id).startsWith(CATALOG_PREFIX) &&
      wheelActiveRef.current
    ) {
      return []
    }

    return baseCollisionDetection(args)
  }, [])
  /** Renombrado en curso del grupo destino (evita el parpadeo a «Sin grupo»). */
  const [pendingRename, setPendingRename] = React.useState<{
    from: string
    to: string
  } | null>(null)

  // Si el grupo destino se elimina, se vuelve a «Sin grupo».
  const activeDestination = React.useMemo(() => {
    if (destination === null) return null
    if (groups.includes(destination)) return destination
    if (!pendingRename) return null
    if (
      pendingRename.from === destination ||
      pendingRename.to === destination
    ) {
      return pendingRename.to
    }
    return null
  }, [destination, groups, pendingRename])

  React.useEffect(
    () => () => {
      if (clickTimer.current) window.clearTimeout(clickTimer.current)
      toast.dismiss("menu-builder-assign")
    },
    []
  )

  // Mantiene el cursor de agarre durante cualquier drag, aunque el puntero
  // pase por el overlay o por los chips.
  React.useEffect(() => {
    if (!activeDragId) return

    const root = document.documentElement
    root.classList.add("np-dragging")

    return () => root.classList.remove("np-dragging")
  }, [activeDragId])

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
      ? Math.round((catalogWidth - (CARD_COLUMNS - 1) * CARD_GAP) / CARD_COLUMNS)
      : 140

  /**
   * Modificador del DragOverlay: cuando hay un destino seleccionado, coloca el
   * stack en el centro de ese chip/cancelar. Al no depender del puntero, las
   * cards quedan fijas y no tiemblan mientras el mouse se mueve.
   */
  const snapModifier = React.useCallback<Modifier>(
    ({ activeNodeRect, transform }) => {
      const center = snapCenterRef.current

      if (!center || !activeNodeRect) return transform

      return {
        x: center.x - activeNodeRect.left - cardWidth / 2,
        y: center.y - activeNodeRect.top - cardWidth / 2,
        scaleX: transform.scaleX,
        scaleY: transform.scaleY,
      }
    },
    [cardWidth]
  )

  const byId = new Map(articles.map((article) => [article.id, article]))
  const selectedIds = new Set(selected.map((row) => row.itemId))
  const pendingIds = React.useMemo(() => Object.keys(pending), [pending])
  const pendingSet = React.useMemo(() => new Set(pendingIds), [pendingIds])
  const pendingCount = pendingIds.length
  const catalogDragActive = Boolean(
    activeDragId?.startsWith(CATALOG_PREFIX)
  )

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
    return openGroups[name] ?? false
  }

  function setGroupOpen(name: string, open: boolean) {
    setOpenGroups((current) =>
      (current[name] ?? false) === open ? current : { ...current, [name]: open }
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

  /** Toast de asignación en lote: restaura menú y selección pendiente. */
  function showAssignmentUndo(
    selectedSnapshot: MenuItemInput[],
    pendingSnapshot: Record<string, number>,
    message: string
  ) {
    toast(message, {
      id: "menu-builder-assign",
      duration: 5000,
      action: {
        label: "Deshacer",
        onClick: () => {
          onSelectedChange(renumber(selectedSnapshot))
          setPending(pendingSnapshot)
        },
      },
    })
  }

  /** Clic en una card: solo marca/desmarca la selección pendiente. */
  function togglePending(article: ArticleListItem) {
    if (disabled || suppressClick.current) return

    // Un artículo inactivo que aún no está en el menú no se puede agregar.
    if (!selectedIds.has(article.id) && !article.isActive) return

    setPending((current) => {
      if (current[article.id] !== undefined) {
        const next = { ...current }
        delete next[article.id]
        return next
      }

      return { ...current, [article.id]: Date.now() }
    })
  }

  function clearPending() {
    setPending({})
  }

  /**
   * Asigna todos los pendientes a un grupo.
   *
   * Los que no están en el menú se agregan; los que están en otro grupo se
   * mueven al final de ese grupo. Los que ya están en el destino no cambian
   * de posición.
   */
  function assignPendingTo(group: string | null) {
    if (disabled || pendingIds.length === 0) return
    if (group !== null && !groups.includes(group)) return

    const pendingSelection = new Set(pendingIds)
    const selectedSnapshot = selected
    const pendingSnapshot = pending
    const inMenu = new Set(selected.map((row) => row.itemId))
    const toMove = selected.filter(
      (row) =>
        pendingSelection.has(row.itemId) &&
        (row.group ?? null) !== group
    )
    const addIds = pendingIds.filter((id) => !inMenu.has(id))
    const moving = new Set(toMove.map((row) => row.itemId))
    const base = selected.filter((row) => !moving.has(row.itemId))

    if (toMove.length === 0 && addIds.length === 0) {
      setPending({})
      showAssignmentUndo(
        selectedSnapshot,
        pendingSnapshot,
        `Ya estaban en ${group ?? "Sin grupo"}`
      )
      return
    }

    const next: MenuItemInput[] = []

    for (const container of [...groups, null] as Array<string | null>) {
      next.push(...base.filter((row) => (row.group ?? null) === container))

      if (container === group) {
        next.push(...toMove.map((row) => ({ ...row, group })))
        next.push(...addIds.map((itemId) => ({ itemId, group })))
      }
    }

    const touched = new Set<string | null>([group])
    for (const row of toMove) touched.add(row.group ?? null)

    setSortModes((current) => {
      const updated = { ...current }
      for (const container of touched) {
        updated[groupKey(container)] = "manual"
      }
      return updated
    })

    onSelectedChange(renumber(next))
    setPending({})

    showAssignmentUndo(
      selectedSnapshot,
      pendingSnapshot,
      pendingIds.length === 1
        ? `Asignado a ${group ?? "Sin grupo"}`
        : `${pendingIds.length} asignados a ${group ?? "Sin grupo"}`
    )
  }

  function confirmAssignment() {
    assignPendingTo(activeDestination)
  }

  function toggleCategory(
    categoryArticles: ArticleListItem[],
    selectAll: boolean
  ) {
    if (disabled) return

    const selectable = categoryArticles.filter(
      (article) => article.isActive || selectedIds.has(article.id)
    )
    const ids = new Set(selectable.map((article) => article.id))

    setPending((current) => {
      if (!selectAll) {
        const next = { ...current }
        for (const id of ids) delete next[id]
        return next
      }

      const now = Date.now()
      const next = { ...current }
      for (const id of ids) {
        if (next[id] === undefined) next[id] = now
      }
      return next
    })
  }

  function removeItem(itemId: string) {
    const selectedSnapshot = selected
    const nextPending = { ...pending }
    delete nextPending[itemId]

    onSelectedChange(
      renumber(selected.filter((row) => row.itemId !== itemId))
    )
    setPending(nextPending)

    showAssignmentUndo(
      selectedSnapshot,
      nextPending,
      "Quitado del menú"
    )
  }

  function handleDragStart(event: DragStartEvent) {
    const dragId = String(event.active.id)

    if (dragId.startsWith(GROUP_SORT_PREFIX)) {
      setActiveGroupSortId(dragId)
      setOverId(null)
      setWheelOrigin(null)
      setWheelTarget(undefined)
      wheelActiveRef.current = false
      setWheelDragging(false)
      snapCenterRef.current = null
      return
    }

    const itemId = parseItemId(dragId)
    if (!itemId) return

    const isCatalog = dragId.startsWith(CATALOG_PREFIX)
    const activator = event.activatorEvent
    const pointerDrag =
      typeof PointerEvent !== "undefined" && activator instanceof PointerEvent
    const origin = pointerDrag
      ? { x: activator.clientX, y: activator.clientY }
      : null

    snapCenterRef.current = null

    // Arrastrar una card no seleccionada reemplaza la selección por esa card.
    if (isCatalog && pending[itemId] === undefined) {
      setPending({ [itemId]: Date.now() })
    }

    wheelActiveRef.current = isCatalog && pointerDrag
    setWheelDragging(wheelActiveRef.current)
    setWheelOrigin(wheelActiveRef.current ? origin : null)
    setWheelTarget(undefined)

    // El clic que sigue al pointerup no debe agregar/quitar la card.
    suppressClick.current = true
    if (clickTimer.current) {
      window.clearTimeout(clickTimer.current)
      clickTimer.current = null
    }

    beforeDrag.current = selected
    setActiveDragId(dragId)
    setActiveItemId(itemId)
    setOverId(null)
  }

  /** Actualiza el grupo resaltado y hace snap del stack al objetivo. */
  function handleDragMove(event: DragMoveEvent) {
    if (!wheelActiveRef.current || !wheelOrigin) return

    const layout = buildMenuWheelLayout(wheelOrigin, groups)
    if (!layout) return

    const point = {
      x: wheelOrigin.x + event.delta.x,
      y: wheelOrigin.y + event.delta.y,
    }

    // Hasta que el puntero no se aleje del punto de agarre se cancela.
    const next =
      Math.hypot(event.delta.x, event.delta.y) < MENU_WHEEL_DEAD_ZONE
        ? undefined
        : menuWheelTargetAt(layout, point)

    setWheelTarget((current) => (current === next ? current : next))
    snapCenterRef.current = menuWheelTargetCenter(layout, next)
  }

  /** Suelta el bloqueo de clic un instante después de terminar el arrastre. */
  function releaseClickSoon() {
    if (clickTimer.current) window.clearTimeout(clickTimer.current)
    clickTimer.current = window.setTimeout(() => {
      suppressClick.current = false
      clickTimer.current = null
    }, 200)
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
    // Con la rueda radial el destino no depende de los droppables del constructor.
    if (activeId.startsWith(CATALOG_PREFIX) && wheelActiveRef.current) return

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

    const isCatalog = activeId.startsWith(CATALOG_PREFIX)
    const usedWheel = isCatalog && wheelActiveRef.current
    const origin = wheelOrigin
    const snapshot = beforeDrag.current

    // Destino final calculado con la posición exacta del pointerup.
    let finalWheelTarget: string | null | undefined = usedWheel
      ? wheelTarget
      : undefined

    if (usedWheel && origin) {
      if (Math.hypot(event.delta.x, event.delta.y) < MENU_WHEEL_DEAD_ZONE) {
        finalWheelTarget = undefined
      } else {
        const layout = buildMenuWheelLayout(origin, groups)

        if (layout) {
          finalWheelTarget = menuWheelTargetAt(layout, {
            x: origin.x + event.delta.x,
            y: origin.y + event.delta.y,
          })
        }
      }
    }

    releaseClickSoon()
    setActiveItemId(null)
    setActiveDragId(null)
    setOverId(null)
    setWheelOrigin(null)
    setWheelTarget(undefined)
    wheelActiveRef.current = false
    setWheelDragging(false)
    snapCenterRef.current = null
    beforeDrag.current = null

    const itemId = parseItemId(activeId)
    if (!itemId) return

    if (usedWheel) {
      if (finalWheelTarget !== undefined) {
        setDestination(finalWheelTarget)
        assignPendingTo(finalWheelTarget)
      }

      return
    }

    if (!event.over) {
      // Soltado fuera de los grupos: se restaura la posición original.
      if (!isCatalog && snapshot) onSelectedChange(renumber(snapshot))
      return
    }

    const target = resolveTarget(String(event.over.id), itemId)
    if (!target) return

    if (isCatalog) {
      // Teclado (sin rueda): el grupo bajo el foco es el destino del lote.
      setDestination(target.group)
      assignPendingTo(target.group)
      return
    }

    const current = snapshot?.find((row) => row.itemId === itemId)

    // Si viene del mismo grupo, se aplica el orden final con `arrayMove`.
    if (current && (current.group ?? null) === target.group) {
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

    releaseClickSoon()
    setActiveItemId(null)
    setActiveDragId(null)
    setActiveGroupSortId(null)
    setOverId(null)
    setWheelOrigin(null)
    setWheelTarget(undefined)
    wheelActiveRef.current = false
    setWheelDragging(false)
    snapCenterRef.current = null
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
    const name = `Grupo ${index}`
    onGroupsChange([...groups, name])
    // El grupo recién creado se abre y pasa a ser el destino de los clics.
    setOpenGroups((current) => ({ ...current, [name]: true }))
    setDestination(name)
  }

  function renameGroup(previous: string, next: string): boolean {
    const name = next.trim()

    if (!name || name === previous) return false
    if (groups.some((group) => group === name)) {
      toast.error("Ya existe un grupo con ese nombre")
      return false
    }

    if (destination === previous) {
      setPendingRename({ from: previous, to: name })
      setDestination(name)
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
    if (destination === name) setDestination(null)
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
    const inMenuIds = new Set(selected.map((row) => row.itemId))
    const map = new Map<
      string,
      { id: string; name: string; articles: ArticleListItem[] }
    >()

    for (const article of articles) {
      if (term && !article.name.toLowerCase().includes(term)) continue

      const inMenu = inMenuIds.has(article.id)

      if (filter === "unassigned" && (inMenu || !article.isActive)) continue
      if (filter === "in-menu" && !inMenu) continue

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
  }, [articles, search, filter, selected])

  const stackArticles = React.useMemo(() => {
    if (!activeDragId) return [] as ArticleListItem[]

    const local = new Map(articles.map((article) => [article.id, article]))

    if (!activeDragId.startsWith(CATALOG_PREFIX)) {
      const article = activeItemId ? local.get(activeItemId) : null
      return article ? [article] : []
    }

    const active = parseItemId(activeDragId)
    const ids = active
      ? [active, ...pendingIds.filter((id) => id !== active)]
      : pendingIds

    return ids
      .slice(0, 3)
      .map((id) => local.get(id))
      .filter((article): article is ArticleListItem => Boolean(article))
  }, [activeDragId, activeItemId, pendingIds, articles])

  const stackCount = activeDragId?.startsWith(CATALOG_PREFIX)
    ? Math.max(pendingIds.length, stackArticles.length)
    : stackArticles.length
  const inMenuCount = selected.length
  const selectedGroupById = React.useMemo(
    () => new Map(selected.map((row) => [row.itemId, row.group ?? null])),
    [selected]
  )
  const destinationItems = React.useMemo(
    () => [
      { value: UNGROUPED, label: "Sin grupo" },
      ...groups.map((group) => ({ value: group, label: group })),
    ],
    [groups]
  )
  const unassignedCount = articles.filter(
    (article) => article.isActive && !selectedIds.has(article.id)
  ).length
  const selectedComboCount = selected.filter(
    (row) => byId.get(row.itemId)?.isCombo
  ).length
  const selectedArticleCount = selected.length - selectedComboCount
  const ungroupedCount = rowsByGroup.get(groupKey(null))?.length ?? 0
  const emptyMessage = search.trim()
    ? "No hay artículos que coincidan con la búsqueda."
    : filter === "unassigned"
      ? "Todos los artículos activos ya están en el menú."
      : filter === "in-menu"
        ? "Todavía no hay artículos en el menú."
        : "No hay artículos."

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      autoScroll={catalogDragActive ? false : undefined}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div
        className={cn(
          "flex flex-1 flex-col gap-6 lg:flex-row lg:items-stretch",
          layout === "split-scroll" && "lg:h-full lg:min-h-0"
        )}
      >
        {/* Catálogo */}
        <section
          className={cn(
            "flex min-w-0 flex-col lg:flex-[2] lg:pr-0",
            layout === "split-scroll" && "lg:min-h-0"
          )}
        >
          <div
            data-slot="header-articulos"
            className="flex shrink-0 flex-col gap-2 px-6 pt-6 pb-2"
          >
            <div className="flex items-baseline justify-between gap-2">
              <Label className="text-sm font-medium">Artículos</Label>
              <span className="text-xs text-muted-foreground tabular-nums">
                {inMenuCount} en el menú
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
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

              <div className="ml-auto flex flex-wrap items-center gap-1">
                {(
                  [
                    {
                      value: "unassigned",
                      label: "Sin asignar",
                      count: unassignedCount,
                    },
                    {
                      value: "in-menu",
                      label: "En el menú",
                      count: inMenuCount,
                    },
                    { value: "all", label: "Todos", count: articles.length },
                  ] as const
                ).map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    size="sm"
                    variant="outline"
                    aria-pressed={filter === option.value}
                    className={jalapenoChipClass(filter === option.value)}
                    onClick={() => setFilter(option.value)}
                  >
                    {option.label}
                    <span className="tabular-nums opacity-70">
                      {option.count}
                    </span>
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-1">
              <Select
                items={destinationItems}
                value={activeDestination ?? UNGROUPED}
                onValueChange={(value) => {
                  if (value === null) return

                  if (value === UNGROUPED) {
                    setDestination(null)
                    return
                  }

                  if (groups.includes(value)) setDestination(value)
                }}
              >
                <SelectTrigger className="h-8 w-52" aria-label="Grupo destino">
                  <span className="shrink-0 text-xs text-muted-foreground">
                    Agregar a:
                  </span>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNGROUPED}>Sin grupo</SelectItem>
                  {groups.map((group) => (
                    <SelectItem key={group} value={group}>
                      {group}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                type="button"
                size="sm"
                disabled={disabled || pendingCount === 0}
                onClick={confirmAssignment}
                title="Asignar la selección al grupo"
              >
                <CheckIcon className="size-4" />
                Asignar
                {pendingCount > 0 ? (
                  <span className="tabular-nums">{pendingCount}</span>
                ) : null}
              </Button>

              {pendingCount > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Limpiar selección"
                  title="Limpiar selección"
                  onClick={clearPending}
                >
                  <XIcon />
                </Button>
              ) : null}
            </div>
          </div>

          <div
            ref={catalogRef}
            data-slot="cards-articulos"
            className={cn(
              "flex flex-col gap-4 px-6 pb-6",
              layout === "split-scroll" && "min-h-0 flex-1 lg:overflow-y-auto",
              catalogDragActive && "pointer-events-none"
            )}
          >
            {categories.length === 0 ? (
              <p className="shrink-0 rounded-lg border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">
                {emptyMessage}
              </p>
            ) : (
              categories.map((category, index) => {
                const selectable = category.articles.filter(
                  (article) => article.isActive || selectedIds.has(article.id)
                )
                const allSelected =
                  selectable.length > 0 &&
                  selectable.every((article) => pendingSet.has(article.id))
                const someSelected =
                  !allSelected &&
                  selectable.some((article) => pendingSet.has(article.id))

                return (
                  <React.Fragment key={category.id}>
                    {index > 0 ? <Separator className="shrink-0" /> : null}
                    <div className="flex shrink-0 flex-col gap-2">
                      <label className="flex items-center gap-2 text-sm font-medium">
                        <Checkbox
                          checked={allSelected}
                          indeterminate={someSelected}
                          disabled={disabled || selectable.length === 0}
                          onCheckedChange={(value) =>
                            toggleCategory(category.articles, Boolean(value))
                          }
                          aria-label={`Seleccionar todos los artículos de ${category.name} para asignar`}
                        />
                        <span className="truncate">{category.name}</span>
                        <span className="text-xs font-normal text-muted-foreground tabular-nums">
                          {category.articles.length}
                        </span>
                      </label>

                      <div
                        className="grid gap-2"
                        style={{
                          gridTemplateColumns: `repeat(${CARD_COLUMNS}, minmax(0, 1fr))`,
                        }}
                      >
                        {category.articles.map((article) => {
                          const selectedAt = pending[article.id]

                          return (
                            <CatalogCard
                              key={article.id}
                              article={article}
                              selected={
                                selectedIds.has(article.id) ||
                                selectedAt !== undefined
                              }
                              pending={selectedAt !== undefined}
                              shakeDelay={
                                selectedAt !== undefined
                                  ? `-${selectedAt % SHAKE_DURATION_MS}ms`
                                  : undefined
                              }
                              groupLabel={
                                selectedGroupById.has(article.id)
                                  ? (selectedGroupById.get(article.id) ??
                                    "Sin grupo")
                                  : null
                              }
                              disabled={
                                disabled ||
                                (!article.isActive &&
                                  !selectedIds.has(article.id))
                              }
                              onToggle={() => togglePending(article)}
                            />
                          )
                        })}
                      </div>
                    </div>
                  </React.Fragment>
                )
              })
            )}
          </div>
        </section>

        <Separator
          orientation="vertical"
          className="hidden w-px self-stretch bg-border lg:block"
        />
        <Separator className="lg:hidden" />

        {/* Constructor */}
        <section
          className={cn(
            "flex min-w-0 flex-col lg:flex-[3] lg:pl-0",
            layout === "split-scroll" && "lg:min-h-0"
          )}
        >
          <div className="flex shrink-0 flex-wrap items-start justify-between gap-2 px-6 pt-6 pb-2">
            <div className="min-w-0">
              <Label className="text-sm font-medium">Constructor</Label>
              <div className="mt-1 flex flex-wrap items-center gap-1">
                {selectedComboCount > 0 ? (
                  <Badge
                    variant="outline"
                    className="border-sky-700 bg-sky-500/10 text-sky-700 dark:border-sky-400 dark:bg-sky-400/10 dark:text-sky-400"
                    title={`${selectedComboCount} ${selectedComboCount === 1 ? "combo" : "combos"}`}
                  >
                    <GroupIcon data-icon="inline-start" />
                    {selectedComboCount}
                  </Badge>
                ) : null}

                {selectedArticleCount > 0 ? (
                  <Badge
                    variant="outline"
                    className="h-5 border-primary/90 bg-primary/5 px-2 py-0.5 text-primary/90 dark:border-chart-1/90 dark:bg-primary/10 dark:text-chart-1"
                    title={`${selectedArticleCount} ${selectedArticleCount === 1 ? "artículo" : "artículos"}`}
                  >
                    <SoupIcon data-icon="inline-start" />
                    {selectedArticleCount}
                  </Badge>
                ) : null}

                {groups.length > 0 ? (
                  <Badge
                    variant="outline"
                    className="border-fuchsia-700 bg-fuchsia-500/10 text-fuchsia-700 dark:border-fuchsia-400 dark:bg-fuchsia-400/10 dark:text-fuchsia-400"
                    title={`${groups.length} ${groups.length === 1 ? "grupo" : "grupos"}`}
                  >
                    <LayersIcon data-icon="inline-start" />
                    {groups.length}
                  </Badge>
                ) : null}

                {selected.length > 0 ? (
                  <Badge
                    variant="secondary"
                    title={`${selected.length} artículos y combos en el menú`}
                  >
                    Total {selected.length}
                  </Badge>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  ungroupedRef.current?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                  })
                }
              >
                Sin grupo ({ungroupedCount})
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="bg-secondary text-foreground! hover:bg-secondary/80 hover:text-foreground!"
                disabled={disabled}
                onClick={addGroup}
              >
                <PlusIcon />
                Nuevo grupo
              </Button>
            </div>
          </div>

          <div
            className={cn(
              "flex flex-col gap-3 px-6 pb-6",
              layout === "split-scroll" && "min-h-0 flex-1 lg:overflow-y-auto"
            )}
          >
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

            <div ref={ungroupedRef} className="shrink-0">
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
          </div>
        </section>
      </div>

      {wheelOrigin ? (
        <MenuRadialGroups
          origin={wheelOrigin}
          groups={groups}
          target={wheelTarget}
        />
      ) : null}

      {/*
       * El overlay es el clon que sigue al cursor. Desde el catálogo muestra
       * un stack de hasta 3 cards seleccionadas; desde el constructor, una.
       * Va al body porque el diálogo usa `transform`, que desancla los `fixed`.
       */}
      {stackArticles.length > 0 && typeof document !== "undefined"
        ? createPortal(
            <DragOverlay
              dropAnimation={null}
              modifiers={[snapModifier]}
              transition={
                wheelDragging ? "transform 120ms ease-out" : undefined
              }
              zIndex={107}
              style={{ pointerEvents: "none" }}
            >
              <div
                className="relative"
                style={{ width: cardWidth, height: cardWidth }}
              >
                {stackArticles
                  .map((article, index) => ({ article, depth: index }))
                  .sort((left, right) => right.depth - left.depth)
                  .map(({ article, depth }) => {
                    const rotation =
                      depth === 0 ? 0 : depth % 2 === 0 ? -2.5 : 2.5

                    return (
                      <div
                        key={article.id}
                        className="absolute inset-0"
                        style={{
                          transform: `translate(${depth * 7}px, ${depth * 7}px) rotate(${rotation}deg)`,
                          zIndex: 10 - depth,
                          pointerEvents: "none",
                        }}
                      >
                        <ArticleCardVisual article={article} />
                      </div>
                    )
                  })}

                {stackCount > 3 ? (
                  <Badge className="absolute -top-2 -right-2 z-20 border border-background bg-primary text-primary-foreground shadow-md">
                    +{stackCount - 3}
                  </Badge>
                ) : null}
              </div>
            </DragOverlay>,
            document.body
          )
        : null}
    </DndContext>
  )
}

/** Card del catálogo: clic para seleccionar, arrastrar para asignar grupo. */
function CatalogCard({
  article,
  selected,
  pending = false,
  shakeDelay,
  groupLabel,
  disabled,
  onToggle,
}: {
  article: ArticleListItem
  selected: boolean
  /** Marcada para asignar/mover; dispara el shake. */
  pending?: boolean
  /** Desfase negativo para sincronizar todas las cards al mismo reloj. */
  shakeDelay?: string
  /** Grupo donde está el artículo, para mostrarlo sobre la card. */
  groupLabel?: string | null
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
      style={shakeDelay ? { animationDelay: shakeDelay } : undefined}
      className={cn(
        disabled ? "cursor-default" : "cursor-grab active:cursor-grabbing",
        pending && "np-menu-card-shake"
      )}
    >
      <ArticleCardVisual
        article={article}
        selected={selected}
        groupLabel={groupLabel}
      />
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
  groupLabel = null,
  disabled = false,
  onRemove,
}: {
  article: ArticleListItem
  selected?: boolean
  /** Grupo donde vive el artículo (solo en cards del catálogo). */
  groupLabel?: string | null
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
          <EntityImage
            src={article.imageUrl}
            assets={article.imageVariants}
            alt={article.name}
            sizes={CARD_IMAGE_SIZES}
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
        {selected && groupLabel ? (
          <Badge
            variant="outline"
            title={groupLabel}
            className="max-w-[calc(100%-1.5rem)] truncate border-white/35 bg-black/35 text-[10px] text-white backdrop-blur-sm"
          >
            {groupLabel}
          </Badge>
        ) : null}

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

  const comboCount = rows.filter(
    (row) => byId.get(row.itemId)?.isCombo
  ).length
  const articleCount = rows.length - comboCount

  // Al arrastrar la cabecera el grupo se contrae; al soltar recupera su estado.
  const draggingThisGroup = activeGroupSortId === groupSortId(title)
  const effectiveOpen = draggingThisGroup ? false : open

  return (
    <Collapsible
      ref={setNodeRef}
      open={effectiveOpen}
      onOpenChange={onOpenChange}
      style={{
        transform: CSS.Transform.toString(sortable.transform),
        transition: sortable.transition,
      }}
      className={cn(
        "shrink-0 overflow-hidden rounded-lg border transition-colors",
        highlighted && "border-primary bg-primary/5",
        sortable.isDragging && "relative z-10 opacity-70",
        activeGroupSortId === groupSortId(title) && "border-primary"
      )}
    >
      <div
        className="flex cursor-pointer flex-wrap items-center gap-1.5 bg-muted/50 p-2"
        onClick={(event) => {
          const target = event.target as HTMLElement

          // Los controles del header conservan su propia interacción.
          if (
            target.closest(
              'input, textarea, select, button, a, [role="button"], [role="checkbox"]'
            )
          ) {
            return
          }

          onOpenChange(!open)
        }}
      >
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

        {comboCount > 0 || articleCount > 0 ? (
          <div className="flex shrink-0 items-center gap-1">
            {comboCount > 0 ? (
              <Badge
                variant="outline"
                aria-label={`${comboCount} combos`}
                title={`${comboCount} combo${comboCount === 1 ? "" : "s"}`}
                className="border-sky-700 bg-sky-500/10 tabular-nums text-sky-700 dark:border-sky-400 dark:bg-sky-400/10 dark:text-sky-400"
              >
                <GroupIcon data-icon="inline-start" />
                {comboCount}
              </Badge>
            ) : null}

            {articleCount > 0 ? (
              <Badge
                variant="outline"
                aria-label={`${articleCount} artículos`}
                title={`${articleCount} artículo${articleCount === 1 ? "" : "s"}`}
                className="h-5 border-primary/90 bg-primary/5 px-2 py-0.5 tabular-nums text-primary/90 dark:border-chart-1/90 dark:bg-primary/10 dark:text-chart-1"
              >
                <SoupIcon data-icon="inline-start" />
                {articleCount}
              </Badge>
            ) : null}
          </div>
        ) : null}

        <GroupNameInput value={title} disabled={disabled} onCommit={onRename} />

        <CollapsibleTrigger
          type="button"
          className="min-w-0 flex-1 self-stretch rounded-md p-1"
          aria-label={`${effectiveOpen ? "Contraer" : "Expandir"} ${title}`}
        />

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
