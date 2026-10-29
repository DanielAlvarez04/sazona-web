"use client"

import { PlusIcon, Trash2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PRESENTATION_PRESETS } from "@/lib/catalog"

export interface PresentationRow {
  key: string
  name: string
  priceAdjust: string
  recipeFactor: string
}

let presentationCounter = 0

export function nextPresentationKey() {
  presentationCounter += 1
  return `presentation-${presentationCounter}`
}

/** Presentaciones base: Chico (0.8), Regular (1) y Grande (1.3). */
export function defaultPresentationRows(): PresentationRow[] {
  return PRESENTATION_PRESETS.map((preset) => ({
    key: nextPresentationKey(),
    name: preset.name,
    priceAdjust: "0",
    recipeFactor: preset.recipeFactor,
  }))
}

export function PresentationEditor({
  rows,
  onChange,
  disabled = false,
}: {
  rows: PresentationRow[]
  onChange: (rows: PresentationRow[]) => void
  disabled?: boolean
}) {
  function update(key: string, changes: Partial<PresentationRow>) {
    onChange(
      rows.map((row) => (row.key === key ? { ...row, ...changes } : row))
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-[minmax(0,1fr)_7rem_7rem_auto] gap-2 text-xs font-medium text-muted-foreground">
        <span>Presentación</span>
        <span>Ajuste de precio</span>
        <span>Factor de consumo</span>
        <span className="sr-only">Acciones</span>
      </div>

      {rows.map((row) => (
        <div
          key={row.key}
          className="grid grid-cols-[minmax(0,1fr)_7rem_7rem_auto] items-center gap-2"
        >
          <Input
            aria-label="Nombre de la presentación"
            value={row.name}
            disabled={disabled}
            onChange={(event) => update(row.key, { name: event.target.value })}
            placeholder="Chico, Regular, Grande…"
          />
          <Input
            aria-label="Ajuste de precio"
            type="number"
            step="0.01"
            value={row.priceAdjust}
            disabled={disabled}
            onChange={(event) =>
              update(row.key, { priceAdjust: event.target.value })
            }
          />
          <Input
            aria-label="Factor de consumo"
            type="number"
            min="0.001"
            step="0.1"
            value={row.recipeFactor}
            disabled={disabled}
            onChange={(event) =>
              update(row.key, { recipeFactor: event.target.value })
            }
          />
          {disabled ? null : (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Quitar presentación"
              onClick={() =>
                onChange(rows.filter((candidate) => candidate.key !== row.key))
              }
            >
              <Trash2Icon />
            </Button>
          )}
        </div>
      ))}

      {disabled ? null : (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              onChange([
                ...rows,
                {
                  key: nextPresentationKey(),
                  name: "",
                  priceAdjust: "0",
                  recipeFactor: "1",
                },
              ])
            }
          >
            <PlusIcon />
            Añadir presentación
          </Button>
          {rows.length === 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange(defaultPresentationRows())}
            >
              Usar Chico / Regular / Grande
            </Button>
          ) : null}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        El factor multiplica el consumo de la receta. Regular es la medida base
        (1).
      </p>
    </div>
  )
}
