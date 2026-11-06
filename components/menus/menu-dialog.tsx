"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2Icon, SaveIcon } from "lucide-react"
import { toast } from "sonner"
import type { DateRange } from "react-day-picker"

import { MenuArticlesBuilder } from "@/components/menus/menu-articles-builder"
import { MenuDateRangePicker } from "@/components/menus/menu-date-range-picker"
import { MenuTimePicker } from "@/components/menus/menu-time-picker"
import { InfoHint } from "@/components/info-hint"
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
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { useActionForm } from "@/hooks/use-action-form"
import type { ArticleListItem } from "@/lib/catalog"
import { jalapenoChipClass } from "@/lib/chips"
import { diffFields, isEmptyPatch, sameStringSet, sameText } from "@/lib/diff"
import {
  formatMenuSchedule,
  MENU_DAY_LABELS,
  MENU_WEEK_DAYS,
  type Menu,
} from "@/lib/menus"

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
        : [...current, day].sort((left, right) => left - right)
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
        days.length === ALL_DAYS.length || days.length === 0 ? [] : days,
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

  return (
    <Dialog
      open
      disablePointerDismissal
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogContent className="flex h-[calc(100dvh-2rem)] flex-col gap-0 p-0! sm:max-w-[calc(100%-2rem)]">
        <div className="scroll-fade-y no-scrollbar min-h-0 flex-1 overflow-y-auto">
          <div className="grid gap-6 p-6">
            <DialogHeader>
              <DialogTitle>{menu ? "Editar menú" : "Nuevo menú"}</DialogTitle>
              <DialogDescription>
                Un menú agrupa artículos para filtrarlos en el punto de venta.
                Aparecerá solo los días, en el horario y durante las fechas que
                definas: sin horario aplica todo el día y sin vigencia no
                caduca. No cambia precios ni inventario.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-6 md:grid-cols-[minmax(0,22rem)_1px_minmax(0,40rem)]">
              <section className="flex min-w-0 flex-col gap-3">
                <Field>
                  <FieldLabel htmlFor="menu-name">
                    Nombre <span className="text-destructive">*</span>
                  </FieldLabel>
                  <Input
                    id="menu-name"
                    value={name}
                    maxLength={80}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Ej. Menú infantil"
                  />
                </Field>

                <Field className="h-full">
                  <FieldLabel htmlFor="menu-description">Descripción</FieldLabel>
                  <Textarea
                    id="menu-description"
                    value={description}
                    maxLength={300}
                    rows={4}
                    className="h-[-webkit-fill-available] resize-none"
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Para quién o cuándo aplica este menú"
                  />
                </Field>
              </section>

              <Separator orientation="vertical" className="hidden md:block" />
              <Separator className="md:hidden" />

              <section className="flex min-w-0 flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-1">
                    <Label className="text-sm font-medium">Días</Label>
                    <InfoHint
                      text="Sin días marcados el menú aplica a todos los días."
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      aria-pressed={isDaily}
                      className={jalapenoChipClass(isDaily)}
                      onClick={toggleDaily}
                    >
                      Diario
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      aria-pressed={isWeekend}
                      className={jalapenoChipClass(isWeekend)}
                      onClick={toggleWeekend}
                    >
                      Finde
                    </Button>

                    <span
                      aria-hidden
                      className="mx-0.5 h-5 w-px self-center bg-border"
                    />

                    {MENU_WEEK_DAYS.map((day) => {
                      const selected = days.includes(day)

                      return (
                        <Button
                          key={day}
                          type="button"
                          size="sm"
                          variant="outline"
                          aria-pressed={selected}
                          className={jalapenoChipClass(selected)}
                          onClick={() => toggleDay(day)}
                        >
                          {MENU_DAY_LABELS[day]}
                        </Button>
                      )
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)] gap-2">
                  <Field>
                    <FieldLabel htmlFor="menu-date-range">Vigencia</FieldLabel>
                    <MenuDateRangePicker
                      id="menu-date-range"
                      value={range}
                      onChange={setRange}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="menu-start-time">
                      Hora inicio
                    </FieldLabel>
                    <MenuTimePicker
                      id="menu-start-time"
                      value={startTime}
                      onChange={setStartTime}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="menu-end-time">Hora fin</FieldLabel>
                    <MenuTimePicker
                      id="menu-end-time"
                      value={endTime}
                      onChange={setEndTime}
                    />
                  </Field>
                </div>

                <p className="rounded-lg border border-dashed bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Resumen: </span>
                  {schedulePreview}
                </p>
              </section>
            </div>

            <Separator className="-mx-6" />

            <MenuArticlesBuilder
              articles={items}
              groups={groups}
              selected={selected}
              onGroupsChange={setGroups}
              onSelectedChange={setSelected}
              disabled={form.pending}
            />

            {form.error ? <FieldError>{form.error}</FieldError> : null}
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
