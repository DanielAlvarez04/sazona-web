"use client"

import { SelectGroup, SelectItem, SelectLabel, SelectSeparator } from "@/components/ui/select"
import { UNIT_GROUPS } from "@/lib/catalog"

/**
 * Opciones de unidad agrupadas por dimensión (masa, volumen, conteo).
 *
 * Se usa dentro de `SelectContent`; el prop `items` de cada Select debe recibir
 * `UNIT_SELECT_ITEMS` para que el trigger muestre el símbolo elegido.
 */
export function UnitOptions() {
  return (
    <>
      {UNIT_GROUPS.map((group, index) => (
        <SelectGroup key={group.dimension}>
          <SelectLabel>{group.label}</SelectLabel>
          {group.units.map((unit) => (
            <SelectItem key={unit.code} value={unit.code}>
              <span className="font-medium">{unit.name}</span>
              <span className="text-muted-foreground">({unit.symbol})</span>
            </SelectItem>
          ))}
          {index < UNIT_GROUPS.length - 1 && <SelectSeparator />}
        </SelectGroup>
      ))}
    </>
  )
}
