"use client"

import * as React from "react"
import { cn } from "cn"
import { ClockIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { jalapenoChipClass } from "@/lib/chips"

/** Horas en formato 12 h (01–12). */
const HOURS = Array.from({ length: 12 }, (_, index) =>
  String(index + 1).padStart(2, "0")
)
const MINUTES = ["00", "15", "30", "45"]
const PERIODS = ["AM", "PM"] as const

type Period = (typeof PERIODS)[number]

/** `"HH:MM"` (24 h) → partes; cualquier otro valor se trata como sin horario. */
function splitTime(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value)
  return match ? { hour: Number(match[1]), minute: match[2] } : null
}

function toPeriod(hour24: number): Period {
  return hour24 >= 12 ? "PM" : "AM"
}

/** 0–23 → 01–12. */
function toHour12(hour24: number) {
  const hour = hour24 % 12
  return hour === 0 ? "12" : String(hour).padStart(2, "0")
}

/** 01–12 + AM/PM → 0–23. */
function toHour24(hour12: string, period: Period) {
  const hour = Number(hour12) % 12
  return period === "PM" ? hour + 12 : hour
}

function format24(hour24: number, minute: string) {
  return `${String(hour24).padStart(2, "0")}:${minute}`
}

/** Etiqueta 12 h para el campo: «09:30 PM». */
function format12(hour24: number, minute: string) {
  return `${toHour12(hour24)}:${minute} ${toPeriod(hour24)}`
}

/**
 * Selector de hora con la misma apariencia que un campo de hora, pero con un
 * desplegable propio (Popover) en lugar del nativo del navegador.
 *
 * Se muestra en formato 12 h con AM/PM y guarda `HH:MM` en 24 h, que es lo que
 * usan la API y las tablas. Incluye «Sin horario» para dejar el menú disponible
 * todo el día.
 */
export function MenuTimePicker({
  id,
  value,
  onChange,
}: {
  id?: string
  value: string
  onChange: (value: string) => void
}) {
  const [open, setOpen] = React.useState(false)

  const current = splitTime(value)
  const hour24 = current?.hour ?? null
  const minute = current?.minute ?? null
  const period = hour24 === null ? null : toPeriod(hour24)
  const hour12 = hour24 === null ? null : toHour12(hour24)

  function selectHour(next: string) {
    onChange(format24(toHour24(next, period ?? "AM"), minute ?? "00"))
  }

  function selectMinute(next: string) {
    // Sin hora elegida, parte de la hora actual.
    const hour = hour24 ?? new Date().getHours()
    onChange(format24(hour, next))
  }

  function selectPeriod(next: Period) {
    // Sin hora elegida, AM ancla a las 00:00 y PM al mediodía.
    const hour = hour12 ? toHour24(hour12, next) : toHour24("12", next)
    onChange(format24(hour, minute ?? "00"))
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            id={id}
            className="w-full justify-start px-2.5 font-normal"
          />
        }
      >
        <ClockIcon data-icon="inline-start" />
        <span
          className={
            value ? "truncate tabular-nums" : "truncate text-muted-foreground"
          }
        >
          {hour24 === null ? "Sin horario" : format12(hour24, minute ?? "00")}
        </span>
      </PopoverTrigger>

      <PopoverContent className="w-64 p-0" align="start">
        <div className="flex items-center justify-end px-3 py-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!value}
            className="h-6 px-1.5 text-xs text-muted-foreground"
            onClick={() => {
              onChange("")
              setOpen(false)
            }}
          >
            Sin horario
          </Button>
        </div>

        <Separator />

        <div className="flex flex-col gap-1 p-2">
          <span className="px-1 text-xs text-muted-foreground">Hora</span>
          <div className="grid grid-cols-6 gap-1">
            {HOURS.map((option) => (
              <Button
                key={option}
                type="button"
                variant="outline"
                size="sm"
                aria-pressed={hour12 === option}
                aria-label={`${option} horas`}
                className={cn(
                  jalapenoChipClass(hour12 === option),
                  "w-full justify-center px-0"
                )}
                onClick={() => selectHour(option)}
              >
                {option}
              </Button>
            ))}
          </div>
        </div>

        <Separator />

        <div className="flex flex-col gap-1 p-2">
          <span className="px-1 text-xs text-muted-foreground">Minutos</span>
          <div className="grid grid-cols-4 gap-1">
            {MINUTES.map((option) => (
              <Button
                key={option}
                type="button"
                variant="outline"
                size="sm"
                aria-pressed={minute === option}
                aria-label={`${option} minutos`}
                className={cn(
                  jalapenoChipClass(minute === option),
                  "w-full justify-center px-0"
                )}
                onClick={() => selectMinute(option)}
              >
                {option}
              </Button>
            ))}
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-2 gap-1 p-2">
          {PERIODS.map((option) => (
            <Button
              key={option}
              type="button"
              variant="outline"
              size="sm"
              aria-pressed={period === option}
              className={cn(
                jalapenoChipClass(period === option),
                "w-full justify-center px-0"
              )}
              onClick={() => selectPeriod(option)}
            >
              {option}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
