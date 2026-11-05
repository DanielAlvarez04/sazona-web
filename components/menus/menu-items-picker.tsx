"use client"

import { useMemo, useState } from "react"
import {
  ChevronDownIcon,
  ChevronUpIcon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatMoney, type ArticleListItem, type Category } from "@/lib/catalog"
import { ACTIVE_FILTER_OUTLINE, cn } from "@/lib/utils"
import type { MenuItemInput } from "@/app/(app)/menus/actions"

export function MenuItemsPicker({
  items,
  categories,
  value,
  onChange,
  disabled,
}: {
  items: ArticleListItem[]
  categories: Category[]
  value: MenuItemInput[]
  onChange: (next: MenuItemInput[]) => void
  disabled?: boolean
}) {
  const [search, setSearch] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [onlySelected, setOnlySelected] = useState(false)

  const byId = useMemo(
    () => new Map(items.map((item) => [item.id, item])),
    [items]
  )

  const selectedIds = useMemo(
    () => new Set(value.map((row) => row.itemId)),
    [value]
  )

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()

    return items.filter((item) => {
      if (onlySelected && !selectedIds.has(item.id)) return false
      if (categoryId && item.category?.id !== categoryId) return false
      if (!needle) return true
      return (
        item.name.toLowerCase().includes(needle) ||
        (item.sku ?? "").toLowerCase().includes(needle)
      )
    })
  }, [items, search, categoryId, onlySelected, selectedIds])

  function toggle(item: ArticleListItem) {
    if (disabled) return

    if (selectedIds.has(item.id)) {
      onChange(value.filter((row) => row.itemId !== item.id))
      return
    }

    if (!item.isActive) return

    onChange([...value, { itemId: item.id, sortOrder: value.length }])
  }

  function move(index: number, delta: number) {
    const next = [...value]
    const target = index + delta
    if (target < 0 || target >= next.length) return

    const [row] = next.splice(index, 1)
    next.splice(target, 0, row)
    onChange(next.map((entry, order) => ({ ...entry, sortOrder: order })))
  }

  function remove(itemId: string) {
    onChange(
      value
        .filter((row) => row.itemId !== itemId)
        .map((entry, order) => ({ ...entry, sortOrder: order }))
    )
  }

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-40 flex-1">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar artículo o combo"
              className="pl-8"
              aria-label="Buscar artículos para el menú"
            />
          </div>
          <Select
            value={categoryId || "all"}
            onValueChange={(next) =>
              setCategoryId(next === "all" ? "" : (next ?? ""))
            }
            items={[
              { value: "all", label: "Todas" },
              ...categories.map((category) => ({
                value: category.id,
                label: category.name,
              })),
            ]}
          >
            <SelectTrigger
              data-active={Boolean(categoryId)}
              className={cn("w-40", categoryId && ACTIVE_FILTER_OUTLINE)}
              aria-label="Filtrar por categoría"
            >
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <label className="flex items-center gap-2">
            <Checkbox
              checked={onlySelected}
              onCheckedChange={(checked) => setOnlySelected(Boolean(checked))}
            />
            Ver solo seleccionados
          </label>
          <span className="tabular-nums">
            {filtered.length} de {items.length}
          </span>
        </div>

        <ScrollArea className="max-h-72 rounded-lg border">
          <div className="flex flex-col gap-1 p-2">
          {filtered.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              No hay artículos que coincidan.
            </p>
          ) : (
            filtered.map((item) => {
              const checked = selectedIds.has(item.id)
              const unavailable = !item.isActive && !checked

              return (
                <label
                  key={item.id}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/60"
                >
                  <Checkbox
                    checked={checked}
                    disabled={disabled || unavailable}
                    onCheckedChange={() => toggle(item)}
                    aria-label={item.name}
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {item.name}
                    {item.isCombo ? (
                      <Badge variant="secondary" className="ml-1.5">
                        Combo
                      </Badge>
                    ) : null}
                    {!item.isActive ? (
                      <Badge variant="outline" className="ml-1.5">
                        Inactivo
                      </Badge>
                    ) : null}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {formatMoney(item.price)}
                  </span>
                </label>
              )
            })
          )}
          </div>
        </ScrollArea>
      </div>

      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-sm font-medium">
            Seleccionados ({value.length})
          </Label>
          {value.length > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled}
              onClick={() => onChange([])}
            >
              Quitar todos
            </Button>
          ) : null}
        </div>

        <ScrollArea className="max-h-72 rounded-lg border">
          <div className="flex flex-col gap-1 p-2">
          {value.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              Selecciona artículos de la lista.
            </p>
          ) : (
            value.map((row, index) => {
              const item = byId.get(row.itemId)

              return (
                <div
                  key={row.itemId}
                  className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-sm"
                >
                  <span className="w-5 text-center text-xs text-muted-foreground tabular-nums">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {item?.name ?? "Artículo eliminado"}
                    {item && !item.isActive ? (
                      <Badge variant="outline" className="ml-1.5">
                        Inactivo
                      </Badge>
                    ) : null}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={disabled || index === 0}
                    aria-label="Subir"
                    onClick={() => move(index, -1)}
                  >
                    <ChevronUpIcon />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={disabled || index === value.length - 1}
                    aria-label="Bajar"
                    onClick={() => move(index, 1)}
                  >
                    <ChevronDownIcon />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={disabled}
                    aria-label="Quitar del menú"
                    onClick={() => remove(row.itemId)}
                  >
                    <Trash2Icon />
                  </Button>
                </div>
              )
            })
          )}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
