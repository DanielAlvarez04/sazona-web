"use client"

import { SelectGroup, SelectItem, SelectLabel, SelectSeparator } from "@/components/ui/select"
import { UNIT_GROUPS, type UnitDimension } from "@/lib/catalog"

/**
 * Opciones de unidad agrupadas por dimensión (masa, volumen, conteo).
 *
 * Se usa dentro de `SelectContent`; el prop `items` de cada Select debe recibir
 * `UNIT_SELECT_ITEMS` (o las unidades de la dimensión) para que el trigger
 * muestre el símbolo elegido.
 */
export function UnitOptions({ dimension }: { dimension?: UnitDimension }) {
  const groups = dimension
    ? UNIT_GROUPS.filter((group) => group.dimension === dimension)
    : UNIT_GROUPS

  return (
    <>
      {groups.map((group, index) => (
        <SelectGroup key={group.dimension}>
          <SelectLabel>{group.label}</SelectLabel>
          {group.units.map((unit) => (
            <SelectItem key={unit.code} value={unit.code}>
              <span className="font-medium">{unit.name}</span>
              <span className="text-muted-foreground">({unit.symbol})</span>
            </SelectItem>
          ))}
          {index < groups.length - 1 && <SelectSeparator />}
        </SelectGroup>
      ))}
    </>
  )
}
