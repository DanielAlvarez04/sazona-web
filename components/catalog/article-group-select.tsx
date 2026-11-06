"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

/** Valor centinela para «Sin grupo» (el estado usa `null`). */
const NO_GROUP = "__none__"

/**
 * Selector de sección de un menú para un artículo.
 *
 * Se comparte entre la tabla y las tarjetas del selector de artículos del
 * menú. El valor `null` representa «Sin grupo».
 */
export function ArticleGroupSelect({
  groups,
  value,
  onChange,
  disabled,
  ariaLabel,
}: {
  /** Secciones disponibles, en orden. */
  groups: string[]
  value: string | null
  onChange: (group: string | null) => void
  disabled?: boolean
  ariaLabel: string
}) {
  const items = [
    { value: NO_GROUP, label: "Sin grupo" },
    ...groups.map((group) => ({ value: group, label: group })),
  ]

  return (
    <Select
      value={value ?? NO_GROUP}
      onValueChange={(next) =>
        onChange(!next || next === NO_GROUP ? null : (next as string))
      }
      items={items}
      disabled={disabled}
    >
      <SelectTrigger
        size="sm"
        className="w-full"
        aria-label={ariaLabel}
        title={value ?? "Sin grupo"}
        onClick={(event) => event.stopPropagation()}
      >
        <SelectValue placeholder="Sin grupo" />
      </SelectTrigger>
      <SelectContent>
        {items.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
