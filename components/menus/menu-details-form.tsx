"use client"

import type { Ref } from "react"
import type { DateRange } from "react-day-picker"

import { InfoHint } from "@/components/info-hint"
import { MenuDateRangePicker } from "@/components/menus/menu-date-range-picker"
import { MenuTimePicker } from "@/components/menus/menu-time-picker"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { jalapenoChipClass } from "@/lib/chips"
import { MENU_DAY_LABELS, MENU_WEEK_DAYS } from "@/lib/menus"

/**
 * Datos generales del menú: nombre, descripción y disponibilidad.
 *
 * Es el mismo formulario de siempre, extraído para poder envolverlo en el panel
 * colapsable sin duplicar markup.
 */
export function MenuDetailsForm({
  name,
  onNameChange,
  nameInputRef,
  description,
  onDescriptionChange,
  days,
  isDaily,
  isWeekend,
  onToggleDaily,
  onToggleWeekend,
  onToggleDay,
  range,
  onRangeChange,
  startTime,
  onStartTimeChange,
  endTime,
  onEndTimeChange,
  schedulePreview,
}: {
  name: string
  onNameChange: (value: string) => void
  nameInputRef?: Ref<HTMLInputElement>
  description: string
  onDescriptionChange: (value: string) => void
  days: number[]
  isDaily: boolean
  isWeekend: boolean
  onToggleDaily: () => void
  onToggleWeekend: () => void
  onToggleDay: (day: number) => void
  range: DateRange | undefined
  onRangeChange: (range: DateRange | undefined) => void
  startTime: string
  onStartTimeChange: (value: string) => void
  endTime: string
  onEndTimeChange: (value: string) => void
  schedulePreview: string
}) {
  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,22rem)_1px_minmax(0,40rem)]">
      <section className="flex min-w-0 flex-col gap-3">
        <Field>
          <FieldLabel htmlFor="menu-name">
            Nombre <span className="text-destructive">*</span>
          </FieldLabel>
          <Input
            id="menu-name"
            ref={nameInputRef}
            value={name}
            maxLength={80}
            onChange={(event) => onNameChange(event.target.value)}
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
            onChange={(event) => onDescriptionChange(event.target.value)}
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
            <InfoHint text="Sin días marcados el menú aplica a todos los días." />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              aria-pressed={isDaily}
              className={jalapenoChipClass(isDaily)}
              onClick={onToggleDaily}
            >
              Diario
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              aria-pressed={isWeekend}
              className={jalapenoChipClass(isWeekend)}
              onClick={onToggleWeekend}
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
                  onClick={() => onToggleDay(day)}
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
              onChange={onRangeChange}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="menu-start-time">Hora inicio</FieldLabel>
            <MenuTimePicker
              id="menu-start-time"
              value={startTime}
              onChange={onStartTimeChange}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="menu-end-time">Hora fin</FieldLabel>
            <MenuTimePicker
              id="menu-end-time"
              value={endTime}
              onChange={onEndTimeChange}
            />
          </Field>
        </div>

        <p className="rounded-lg border border-dashed bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Resumen: </span>
          {schedulePreview}
        </p>
      </section>
    </div>
  )
}
