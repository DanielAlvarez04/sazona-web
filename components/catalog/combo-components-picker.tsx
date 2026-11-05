"use client"

import * as React from "react"
import { GroupIcon, MinusIcon, PlusIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import { formatMoney, type ArticleListItem } from "@/lib/catalog"
import { cn } from "cn"

export type ComboComponentRow = {
  key: string
  itemId: string
  variantId: string
  quantity: number
}

type Presentation = {
  key: string
  item: ArticleListItem
  variantId: string | null
  variantName: string | null
  name: string
  price: number
  /** Imagen propia de la presentación o, si falta, la del artículo. */
  imageUrl: string | null
}

function comboKey(itemId: string, variantId?: string | null) {
  return `${itemId}:${variantId ?? ""}`
}

function flattenPresentations(products: ArticleListItem[]): Presentation[] {
  return products.flatMap<Presentation>((item) => {
    const variants = item.variants.filter((variant) => variant.isActive)

    if (variants.length === 0) {
      return [
        {
          key: comboKey(item.id),
          item,
          variantId: null,
          variantName: null,
          name: item.name,
          price: Number(item.price),
          imageUrl: item.imageUrl,
        },
      ]
    }

    return variants.map((variant) => ({
      key: comboKey(item.id, variant.id),
      item,
      variantId: variant.id,
      variantName: variant.name,
      name: `${item.name} · ${variant.name}`,
      price: Number(item.price) + Number(variant.priceAdjust),
      imageUrl: variant.imageUrl ?? item.imageUrl,
    }))
  })
}

export function ComboComponentsPicker({
  products,
  value,
  onChange,
  disabled,
}: {
  products: ArticleListItem[]
  value: ComboComponentRow[]
  onChange: (next: ComboComponentRow[]) => void
  disabled?: boolean
}) {
  const presentations = React.useMemo(
    () => flattenPresentations(products),
    [products]
  )

  const [search, setSearch] = React.useState("")
  const [selected, setSelected] = React.useState<Presentation | null>(null)

  const selectedByKey = React.useMemo(
    () => new Map(value.map((row) => [row.key, row])),
    [value]
  )

  // Los artículos agregados siempre aparecen primero.
  const ordered = React.useMemo(() => {
    return [...presentations].sort((left, right) => {
      const leftSelected = selectedByKey.has(left.key) ? 0 : 1
      const rightSelected = selectedByKey.has(right.key) ? 0 : 1

      if (leftSelected !== rightSelected) return leftSelected - rightSelected
      return left.name.localeCompare(right.name, "es", { sensitivity: "base" })
    })
  }, [presentations, selectedByKey])

  // El buscador filtra solo los artículos no agregados: los agregados quedan
  // siempre visibles al inicio.
  const filtered = React.useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return ordered

    return ordered.filter(
      (presentation) =>
        selectedByKey.has(presentation.key) ||
        presentation.name.toLowerCase().includes(term)
    )
  }, [ordered, search, selectedByKey])

  function toggle(presentation: Presentation) {
    if (disabled) return

    if (selectedByKey.has(presentation.key)) {
      onChange(value.filter((row) => row.key !== presentation.key))
      return
    }

    onChange([
      ...value,
      {
        key: presentation.key,
        itemId: presentation.item.id,
        variantId: presentation.variantId ?? "",
        quantity: 1,
      },
    ])
  }

  function changeQuantity(presentation: Presentation, delta: number) {
    const current = selectedByKey.get(presentation.key)
    const next = (current?.quantity ?? 0) + delta

    if (next <= 0) {
      if (current) {
        onChange(value.filter((row) => row.key !== presentation.key))
      }
      return
    }

    if (!current) {
      onChange([
        ...value,
        {
          key: presentation.key,
          itemId: presentation.item.id,
          variantId: presentation.variantId ?? "",
          quantity: next,
        },
      ])
      return
    }

    onChange(
      value.map((row) =>
        row.key === presentation.key ? { ...row, quantity: next } : row
      )
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <Combobox
        items={presentations}
        value={selected}
        onValueChange={(next) => {
          setSelected(next ?? null)
          setSearch(next?.name ?? "")
        }}
        inputValue={search}
        onInputValueChange={setSearch}
        isItemEqualToValue={(item, current) => item.key === current.key}
        disabled={disabled}
      >
        <ComboboxInput
          aria-label="Buscar artículo del combo"
          placeholder="Buscar artículo o presentación…"
          showClear={Boolean(search)}
          className="w-full"
        />
        <ComboboxContent>
          <ComboboxEmpty>Sin artículos</ComboboxEmpty>
          <ComboboxList>
            {(presentation: Presentation) => (
              <ComboboxItem key={presentation.key} value={presentation}>
                <span className="min-w-0 flex-1 truncate">
                  {presentation.name}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {formatMoney(presentation.price)}
                </span>
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>

      {filtered.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No hay artículos disponibles.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {filtered.map((presentation) => {
            const row = selectedByKey.get(presentation.key)
            const isSelected = Boolean(row)
            const quantity = row?.quantity ?? 0

            return (
              <div
                key={presentation.key}
                data-selected={isSelected || undefined}
                className="rounded-xl data-[selected=true]:ring-2 data-[selected=true]:ring-primary"
              >
                <Card size="sm" className="gap-0 overflow-hidden p-0 py-0">
                  <div
                    role="button"
                    tabIndex={disabled ? -1 : 0}
                    aria-disabled={disabled || undefined}
                    aria-label={`${isSelected ? "Quitar" : "Añadir"} ${presentation.name}`}
                    onClick={() => toggle(presentation)}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" && event.key !== " ") return
                      event.preventDefault()
                      toggle(presentation)
                    }}
                    className={cn(
                      "relative aspect-square w-full text-left",
                      disabled ? "cursor-default" : "cursor-pointer"
                    )}
                  >
                    <div className="absolute inset-0 bg-muted">
                      {presentation.imageUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={presentation.imageUrl}
                          alt={presentation.name}
                          className="size-full object-cover"
                        />
                      ) : (
                        <div className="flex size-full items-center justify-center text-muted-foreground">
                          <GroupIcon className="size-8 opacity-40" aria-hidden />
                        </div>
                      )}
                    </div>

                    <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/85 via-black/25 to-black/5" />

                    <div className="relative flex size-full flex-col p-2 text-white">
                      <div className="flex items-start justify-between gap-1">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggle(presentation)}
                          aria-label={`Seleccionar ${presentation.name}`}
                          className="border-white/70 bg-black/30"
                          onClick={(event) => event.stopPropagation()}
                        />
                        {presentation.item.isActive ? null : (
                          <Badge className="border border-amber-300/40 bg-amber-400/20 text-amber-200 backdrop-blur-sm">
                            Inactivo
                          </Badge>
                        )}
                      </div>

                      <div className="mt-auto flex min-w-0 flex-col gap-1">
                        <span className="text-[15px] leading-none font-normal tabular-nums text-white drop-shadow-sm">
                          {formatMoney(presentation.price)}
                        </span>
                        <p
                          className="line-clamp-2 text-pretty text-sm font-semibold leading-snug drop-shadow-sm"
                          title={presentation.name}
                        >
                          {presentation.name}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-1 border-t bg-muted px-2 py-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-xs"
                      aria-label={`Quitar una unidad de ${presentation.name}`}
                      disabled={disabled || quantity <= 0}
                      onClick={() => changeQuantity(presentation, -1)}
                    >
                      <MinusIcon />
                    </Button>
                    <span className="min-w-6 text-center text-sm font-medium tabular-nums">
                      {quantity}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-xs"
                      aria-label={`Añadir una unidad de ${presentation.name}`}
                      disabled={disabled}
                      onClick={() => changeQuantity(presentation, 1)}
                    >
                      <PlusIcon />
                    </Button>
                  </div>
                </Card>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
