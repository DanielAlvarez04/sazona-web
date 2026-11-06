"use client"

import * as React from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { CalendarIcon, XIcon } from "lucide-react"
import type { DateRange } from "react-day-picker"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

const DATE_FORMAT = "d MMM y"

function formatDate(date: Date) {
  return format(date, DATE_FORMAT, { locale: es })
}

/**
 * Rango de fechas opcional (vigencia del menú).
 *
 * Sin fechas el menú no caduca; con un solo extremo se muestra «Desde …» y el
 * rango queda abierto por el otro lado.
 */
export function MenuDateRangePicker({
  id,
  value,
  onChange,
}: {
  id?: string
  value: DateRange | undefined
  onChange: (range: DateRange | undefined) => void
}) {
  const [open, setOpen] = React.useState(false)

  const label = value?.from
    ? value.to
      ? `${formatDate(value.from)} – ${formatDate(value.to)}`
      : `Desde ${formatDate(value.from)}`
    : value?.to
      ? `Hasta ${formatDate(value.to)}`
      : "Sin límite de fechas"

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
        <CalendarIcon data-icon="inline-start" />
        <span
          className={
            value?.from || value?.to
              ? "truncate"
              : "truncate text-muted-foreground"
          }
        >
          {label}
        </span>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          locale={es}
          defaultMonth={value?.from}
          selected={value}
          onSelect={onChange}
          numberOfMonths={2}
        />
        <div className="flex items-center justify-between gap-2 border-t p-2">
          <span className="px-1 text-xs text-muted-foreground">
            {value?.from && !value.to
              ? "Elige la fecha final o quita el rango."
              : "Opcional: sin fechas el menú no caduca."}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!value?.from && !value?.to}
            onClick={() => {
              onChange(undefined)
              setOpen(false)
            }}
          >
            <XIcon />
            Quitar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
