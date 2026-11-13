"use client"

import type { ReactNode, Ref } from "react"
import type { DateRange } from "react-day-picker"
import dynamic from "next/dynamic"

import { InfoHint } from "@/components/info-hint"
import { MenuTimePicker } from "@/components/menus/menu-time-picker"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { jalapenoChipClass } from "@/lib/chips"
import { MENU_DAY_LABELS, MENU_WEEK_DAYS } from "@/lib/menus"

/**
 * El calendario (react-day-picker + date-fns) solo se necesita cuando se abre
 * el selector de vigencia. Cargarlo aparte saca ~44 KB gzip de la entrada de
 * `/menus`.
 */
const MenuDateRangePicker = dynamic(
  () =>
    import("@/components/menus/menu-date-range-picker").then(
      (mod) => mod.MenuDateRangePicker
    ),
  {
    ssr: false,
    loading: () => <Skeleton className="h-9 w-full" />,
  }
)

export type MenuDetailsVariant = "full" | "header" | "body"

/**
 * Datos generales del menú.
 *
 * `header` muestra solo nombre y días (siempre visible en el panel
 * colapsable), `body` el resto de campos y `full` el formulario completo de
 * la estructura anterior.
 */
export function MenuDetailsForm({
  variant = "full",
  action,
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
  variant?: MenuDetailsVariant
  /** Botón de colapsar/expandir que se coloca en el header. */
  action?: ReactNode
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
  const nameField = (
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
  )

  const descriptionField = (
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
  )

  const daysField = (
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

        <span aria-hidden className="mx-0.5 h-5 w-px self-center bg-border" />

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
  )

  const scheduleFields = (
    <div className="flex w-full max-w-[40rem] flex-col gap-3">
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
    </div>
  )

  if (variant === "header") {
    return (
      <div className="flex items-start gap-3">
        <div className="grid min-w-0 flex-1 gap-3 md:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
          <section className="flex min-w-0 flex-col gap-3">
            {nameField}
          </section>
          <section className="flex min-w-0 flex-col gap-3">
            {daysField}
          </section>
        </div>

        {action ? <div className="shrink-0 pt-6">{action}</div> : null}
      </div>
    )
  }

  if (variant === "body") {
    return (
      <div className="grid gap-3 md:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <section className="flex min-w-0 flex-col gap-3">
          {descriptionField}
        </section>
        <section className="flex min-w-0 flex-col gap-3">
          {scheduleFields}
        </section>
      </div>
    )
  }

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,22rem)_1px_minmax(0,40rem)]">
      <section className="flex min-w-0 flex-col gap-3">
        {nameField}
        {descriptionField}
      </section>

      <Separator orientation="vertical" className="hidden md:block" />
      <Separator className="md:hidden" />

      <section className="flex min-w-0 flex-col gap-3">
        {daysField}
        {scheduleFields}
      </section>
    </div>
  )
}
