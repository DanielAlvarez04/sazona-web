"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2Icon, SaveIcon, Settings2Icon } from "lucide-react"
import { toast } from "sonner"
import type { DateRange } from "react-day-picker"

import { MenuArticlesBuilder } from "@/components/menus/menu-articles-builder"
import { MenuDetailsForm } from "@/components/menus/menu-details-form"
import {
  createMenu,
  updateMenu,
  type MenuInput,
  type MenuItemInput,
} from "@/app/(app)/menus/actions"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { FieldError } from "@/components/ui/field"
import { Separator } from "@/components/ui/separator"
import { useActionForm } from "@/hooks/use-action-form"
import type { ArticleListItem } from "@/lib/catalog"
import { diffFields, isEmptyPatch, sameStringSet, sameText } from "@/lib/diff"
import {
  formatMenuSchedule,
  sortMenuDays,
  type Menu,
} from "@/lib/menus"
import { cn } from "@/lib/utils"

function toLocalDate(value: string | null): Date | undefined {
  if (!value) return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

/** Fecha local → ISO; el fin de vigencia cubre el día completo. */
function toIso(date: Date | undefined, endOfDay: boolean): string | null {
  if (!date) return null

  const next = new Date(date)
  if (endOfDay) next.setHours(23, 59, 59, 999)
  else next.setHours(0, 0, 0, 0)

  return next.toISOString()
}

function rangeFromMenu(menu: Menu | null): DateRange | undefined {
  const from = toLocalDate(menu?.startsAt ?? null)
  const to = toLocalDate(menu?.endsAt ?? null)

  return from || to ? { from, to } : undefined
}

/** Todos los días de la semana; en la API un arreglo vacío también significa todos. */
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]
/** Viernes, sábado y domingo. */
const WEEKEND_DAYS = [5, 6, 0]

type MenuDetailsMode = "collapsible" | "always"

/**
 * Reversión rápida del diseño del diálogo.
 *
 * - `DETAILS_MODE = "always"` deja el formulario de detalles siempre visible,
 *   como la estructura anterior.
 * - `BUILDER_LAYOUT = "single-scroll"` vuelve al scroll único del diálogo.
 *
 * No hay que tocar nada más para comparar ambos diseños.
 */
const DETAILS_MODE: MenuDetailsMode = "collapsible"
const BUILDER_LAYOUT: "split-scroll" | "single-scroll" = "split-scroll"
const SPLIT_LAYOUT = BUILDER_LAYOUT === "split-scroll"

function initialDays(menu: Menu | null): number[] {
  if (!menu) return ALL_DAYS
  return menu.daysOfWeek.length > 0 ? menu.daysOfWeek : ALL_DAYS
}

export function MenuDialog({
  menu,
  items,
  onClose,
}: {
  menu: Menu | null
  items: ArticleListItem[]
  onClose: () => void
}) {
  const router = useRouter()
  const form = useActionForm(() => {
    toast.success(menu ? "Menú actualizado" : "Menú creado")
    router.refresh()
    onClose()
  })

  const [name, setName] = useState(menu?.name ?? "")
  const [description, setDescription] = useState(menu?.description ?? "")
  const [days, setDays] = useState<number[]>(() => initialDays(menu))
  const [range, setRange] = useState<DateRange | undefined>(() =>
    rangeFromMenu(menu)
  )
  const [startTime, setStartTime] = useState(menu?.startTime ?? "")
  const [endTime, setEndTime] = useState(menu?.endTime ?? "")
  const [selected, setSelected] = useState<MenuItemInput[]>(() =>
    (menu?.items ?? []).map((row, index) => ({
      itemId: row.itemId,
      sortOrder: row.sortOrder ?? index,
      group: row.group ?? null,
    }))
  )
  const [groups, setGroups] = useState<string[]>(() => menu?.groups ?? [])
  const [detailsOpen, setDetailsOpen] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)

  const startsAtIso = toIso(range?.from, false)
  const endsAtIso = toIso(range?.to, true)

  const schedulePreview = formatMenuSchedule({
    daysOfWeek: days,
    startTime: startTime || null,
    endTime: endTime || null,
    startsAt: startsAtIso,
    endsAt: endsAtIso,
  })

  function toggleDay(day: number) {
    setDays((current) =>
      current.includes(day)
        ? current.filter((value) => value !== day)
        : sortMenuDays([...current, day])
    )
  }

  const isDaily = days.length === ALL_DAYS.length
  const isWeekend = sameStringSet(days.map(String), WEEKEND_DAYS.map(String))

  /** «Diario» se activa y desactiva: sin días seleccionados también es diario. */
  function toggleDaily() {
    setDays(isDaily ? [] : ALL_DAYS)
  }

  /** «Finde» marca o desmarca viernes, sábado y domingo. */
  function toggleWeekend() {
    setDays(isWeekend ? [] : WEEKEND_DAYS)
  }

  function save() {
    const trimmedName = name.trim()

    if (!trimmedName) {
      form.setError("El nombre del menú es obligatorio")
      requestAnimationFrame(() => nameInputRef.current?.focus())
      return
    }

    if (selected.length === 0) {
      form.setError("Selecciona al menos un artículo")
      return
    }

    if (Boolean(startTime) !== Boolean(endTime)) {
      form.setError("Indica la hora de inicio y la de fin")
      return
    }

    const items = selected.map((row, index) => ({
      itemId: row.itemId,
      sortOrder: index,
      group: row.group ?? null,
    }))

    const next: MenuInput = {
      name: trimmedName,
      description: description.trim() || null,
      // La API interpreta `[]` como «todos los días»: sin días marcados
      // el menú aplica siempre y no hay restricción que guardar.
      daysOfWeek:
        days.length === ALL_DAYS.length || days.length === 0
          ? []
          : sortMenuDays(days),
      startTime: startTime || null,
      endTime: endTime || null,
      startsAt: startsAtIso,
      endsAt: endsAtIso,
      groups,
      items,
    }

    if (!menu) {
      form.run(() => createMenu(next))
      return
    }

    const currentItems = (menu.items ?? []).map((row, index) => ({
      itemId: row.itemId,
      sortOrder: row.sortOrder ?? index,
      group: row.group ?? null,
    }))

    const itemsChanged =
      currentItems.length !== items.length ||
      currentItems.some(
        (row, index) =>
          row.itemId !== items[index].itemId ||
          row.sortOrder !== items[index].sortOrder ||
          row.group !== items[index].group
      )

    const changes = {
      ...diffFields(
        {
          name: menu.name,
          description: menu.description,
          daysOfWeek: menu.daysOfWeek,
          startTime: menu.startTime,
          endTime: menu.endTime,
          startsAt: menu.startsAt,
          endsAt: menu.endsAt,
          groups: menu.groups ?? [],
        },
        {
          name: next.name,
          description: next.description,
          daysOfWeek: next.daysOfWeek,
          startTime: next.startTime,
          endTime: next.endTime,
          startsAt: next.startsAt,
          endsAt: next.endsAt,
          groups: next.groups,
        },
        {
          name: (left, right) =>
            sameText(left as string, right as string),
          description: (left, right) =>
            sameText(left as string | null, right as string | null),
          daysOfWeek: (left, right) =>
            sameStringSet(
              (left as number[]).map(String),
              (right as number[]).map(String)
            ),
          groups: (left, right) =>
            JSON.stringify(left) === JSON.stringify(right),
        }
      ),
      ...(itemsChanged ? { items } : {}),
    }

    if (isEmptyPatch(changes)) {
      toast.info("Sin cambios")
      onClose()
      return
    }

    form.run(() => updateMenu(menu.id, changes))
  }

  const detailsFormProps = {
    name,
    onNameChange: setName,
    nameInputRef,
    description,
    onDescriptionChange: setDescription,
    days,
    isDaily,
    isWeekend,
    onToggleDaily: toggleDaily,
    onToggleWeekend: toggleWeekend,
    onToggleDay: toggleDay,
    range,
    onRangeChange: setRange,
    startTime,
    onStartTimeChange: setStartTime,
    endTime,
    onEndTimeChange: setEndTime,
    schedulePreview,
  }

  return (
    <Dialog
      open
      disablePointerDismissal
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogContent className="flex h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0! sm:max-w-[calc(100%-2rem)]">
        <div
          className={cn(
            "scroll-fade-y no-scrollbar min-h-0 flex-1",
            SPLIT_LAYOUT
              ? "overflow-y-auto lg:overflow-hidden"
              : "overflow-y-auto"
          )}
        >
          <div
            className={cn(
              "flex min-h-full flex-col",
              SPLIT_LAYOUT && "lg:h-full"
            )}
          >
            <DialogHeader className="shrink-0 px-6 pt-6">
              <DialogTitle>{menu ? "Editar menú" : "Nuevo menú"}</DialogTitle>
              <DialogDescription>
                Agrupa artículos y define cuándo está disponible. No cambia
                precios ni inventario.
              </DialogDescription>
            </DialogHeader>

            {DETAILS_MODE === "always" ? (
              <div className="px-6 pt-4">
                <MenuDetailsForm variant="full" {...detailsFormProps} />
              </div>
            ) : (
              <div className="px-6 pt-4">
                <MenuDetailsForm
                  variant="header"
                  action={
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-expanded={detailsOpen}
                      onClick={() => setDetailsOpen((open) => !open)}
                    >
                      <Settings2Icon className="size-4" />
                      {detailsOpen ? "Ocultar detalles" : "Agregar más detalles"}
                    </Button>
                  }
                  {...detailsFormProps}
                />

                {detailsOpen ? (
                  <div className="pt-3">
                    <MenuDetailsForm
                      variant="body"
                      {...detailsFormProps}
                    />
                  </div>
                ) : null}
              </div>
            )}

            <div className="flex min-h-0 flex-1 flex-col pt-6">
              <Separator />

              <MenuArticlesBuilder
                articles={items}
                groups={groups}
                selected={selected}
                onGroupsChange={setGroups}
                onSelectedChange={setSelected}
                disabled={form.pending}
                layout={BUILDER_LAYOUT}
              />

              {form.error ? (
                <FieldError className="px-6 pb-6">{form.error}</FieldError>
              ) : null}
            </div>
          </div>
        </div>

        <DialogFooter className="mx-0 mb-0 rounded-none px-6 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={form.pending}
          >
            Cancelar
          </Button>
          <Button type="button" onClick={save} disabled={form.pending}>
            {form.pending ? (
              <Loader2Icon className="animate-spin" />
            ) : (
              <SaveIcon />
            )}
            {menu ? "Guardar menú" : "Crear menú"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
