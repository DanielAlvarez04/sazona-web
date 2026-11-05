"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2Icon, SaveIcon } from "lucide-react"
import { toast } from "sonner"

import { MenuItemsPicker } from "@/components/menus/menu-items-picker"
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
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useActionForm } from "@/hooks/use-action-form"
import type { ArticleListItem, Category } from "@/lib/catalog"
import { MENU_DAY_LABELS, type Menu } from "@/lib/menus"

function toDateInput(value: string | null): string {
  return value ? value.slice(0, 10) : ""
}

function dateInputToIso(value: string, endOfDay: boolean): string | null {
  if (!value) return null
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00"}`)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export function MenuDialog({
  menu,
  items,
  categories,
  onClose,
}: {
  menu: Menu | null
  items: ArticleListItem[]
  categories: Category[]
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
  const [isActive, setIsActive] = useState(menu?.isActive ?? true)
  const [days, setDays] = useState<number[]>(menu?.daysOfWeek ?? [])
  const [startTime, setStartTime] = useState(menu?.startTime ?? "")
  const [endTime, setEndTime] = useState(menu?.endTime ?? "")
  const [startsAt, setStartsAt] = useState(toDateInput(menu?.startsAt ?? null))
  const [endsAt, setEndsAt] = useState(toDateInput(menu?.endsAt ?? null))
  const [selected, setSelected] = useState<MenuItemInput[]>(() =>
    (menu?.items ?? []).map((row, index) => ({
      itemId: row.itemId,
      sortOrder: row.sortOrder ?? index,
    }))
  )

  function toggleDay(day: number) {
    setDays((current) =>
      current.includes(day)
        ? current.filter((value) => value !== day)
        : [...current, day].sort((left, right) => left - right)
    )
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

    if (startsAt && endsAt && endsAt < startsAt) {
      form.setError("La fecha de fin debe ser posterior a la de inicio")
      return
    }

    const items = selected.map((row, index) => ({
      itemId: row.itemId,
      sortOrder: index,
    }))

    const base: Omit<MenuInput, "name"> & { name: string } = {
      name: trimmedName,
      description: description.trim() || null,
      isActive,
      daysOfWeek: days,
      startTime: startTime || null,
      endTime: endTime || null,
      startsAt: dateInputToIso(startsAt, false),
      endsAt: dateInputToIso(endsAt, true),
      items,
    }

    if (!menu) {
      form.run(() => createMenu(base))
      return
    }

    const currentItems = (menu.items ?? []).map((row, index) => ({
      itemId: row.itemId,
      sortOrder: row.sortOrder ?? index,
    }))

    const itemsChanged =
      currentItems.length !== items.length ||
      currentItems.some(
        (row, index) =>
          row.itemId !== items[index].itemId ||
          row.sortOrder !== items[index].sortOrder
      )

    const changes: Partial<Omit<MenuInput, "items">> & {
      items?: MenuItemInput[]
    } = {
      ...(menu.name === trimmedName ? {} : { name: trimmedName }),
      ...((menu.description ?? "") === (base.description ?? "")
        ? {}
        : { description: base.description }),
      ...(menu.isActive === isActive ? {} : { isActive }),
      ...(JSON.stringify(menu.daysOfWeek) === JSON.stringify(days)
        ? {}
        : { daysOfWeek: days }),
      ...((menu.startTime ?? "") === (base.startTime ?? "")
        ? {}
        : { startTime: base.startTime }),
      ...((menu.endTime ?? "") === (base.endTime ?? "")
        ? {}
        : { endTime: base.endTime }),
      ...((menu.startsAt ?? "") === (base.startsAt ?? "")
        ? {}
        : { startsAt: base.startsAt }),
      ...((menu.endsAt ?? "") === (base.endsAt ?? "")
        ? {}
        : { endsAt: base.endsAt }),
      ...(itemsChanged ? { items } : {}),
    }

    if (Object.keys(changes).length === 0) {
      toast.info("Sin cambios")
      onClose()
      return
    }

    form.run(() => updateMenu(menu.id, changes))
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-hidden p-0! sm:max-w-4xl">
        <div className="scroll-fade-y no-scrollbar max-h-[90vh] overflow-y-auto p-6">
          <div className="grid gap-6">
        <DialogHeader>
          <DialogTitle>{menu ? "Editar menú" : "Nuevo menú"}</DialogTitle>
          <DialogDescription>
            Un menú es una colección de artículos para filtrar el punto de
            venta. No cambia precios ni consume inventario por sí mismo.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
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

            <div className="flex items-end justify-between gap-3 rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Activo</p>
                <p className="text-xs text-muted-foreground">
                  Visible en el POS
                </p>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          </div>

          <Field>
            <FieldLabel htmlFor="menu-description">Descripción</FieldLabel>
            <Textarea
              id="menu-description"
              value={description}
              maxLength={300}
              rows={2}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Para quién o cuándo aplica este menú"
            />
          </Field>

          <Separator />

          <section className="flex flex-col gap-3">
            <div>
              <Label className="text-sm font-medium">Disponibilidad</Label>
              <p className="text-xs text-muted-foreground">
                Sin días ni horas, el menú está siempre disponible. Si solo
                eliges horas, aplican todos los días.
              </p>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {MENU_DAY_LABELS.map((label, day) => (
                <Button
                  key={label}
                  type="button"
                  size="sm"
                  variant={days.includes(day) ? "secondary" : "outline"}
                  onClick={() => toggleDay(day)}
                >
                  {label}
                </Button>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field>
                <FieldLabel htmlFor="menu-start-time">Hora inicio</FieldLabel>
                <Input
                  id="menu-start-time"
                  type="time"
                  value={startTime}
                  onChange={(event) => setStartTime(event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="menu-end-time">Hora fin</FieldLabel>
                <Input
                  id="menu-end-time"
                  type="time"
                  value={endTime}
                  onChange={(event) => setEndTime(event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="menu-starts-at">Desde fecha</FieldLabel>
                <Input
                  id="menu-starts-at"
                  type="date"
                  value={startsAt}
                  onChange={(event) => setStartsAt(event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="menu-ends-at">Hasta fecha</FieldLabel>
                <Input
                  id="menu-ends-at"
                  type="date"
                  value={endsAt}
                  onChange={(event) => setEndsAt(event.target.value)}
                />
              </Field>
            </div>
          </section>

          <Separator />

          <section className="flex flex-col gap-2">
            <div>
              <Label className="text-sm font-medium">
                Artículos del menú <span className="text-destructive">*</span>
              </Label>
              <p className="text-xs text-muted-foreground">
                Puedes incluir artículos y combos. El orden se usa para
                mostrarlos en el POS.
              </p>
            </div>
            <MenuItemsPicker
              items={items}
              categories={categories}
              value={selected}
              onChange={setSelected}
              disabled={form.pending}
            />
          </section>

          {form.error ? <FieldError>{form.error}</FieldError> : null}
        </div>

        <DialogFooter>
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
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
