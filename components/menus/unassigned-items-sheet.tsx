"use client"

import * as React from "react"
import Link from "next/link"
import { SearchIcon, SoupIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { EntityImage } from "@/components/ui/entity-image"
import { formatMoney, type ArticleListItem } from "@/lib/catalog"
import { cn } from "@/lib/utils"

export function UnassignedItemsSheet({
  open,
  onOpenChange,
  items,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: ArticleListItem[]
}) {
  const [search, setSearch] = React.useState("")

  const groups = React.useMemo(() => {
    const needle = search.trim().toLowerCase()
    const filtered = needle
      ? items.filter(
          (item) =>
            item.name.toLowerCase().includes(needle) ||
            (item.category?.name ?? "").toLowerCase().includes(needle)
        )
      : items

    const map = new Map<string, ArticleListItem[]>()

    for (const item of filtered) {
      const key = item.category?.name ?? "Sin categoría"
      const list = map.get(key) ?? []
      list.push(item)
      map.set(key, list)
    }

    return [...map.entries()]
      .sort(([left], [right]) => left.localeCompare(right, "es"))
      .map(([category, rows]) => ({
        category,
        items: [...rows].sort((left, right) =>
          left.name.localeCompare(right.name, "es", { sensitivity: "base" })
        ),
      }))
  }, [items, search])

  const visibleCount = groups.reduce(
    (total, group) => total + group.items.length,
    0
  )

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) setSearch("")
        onOpenChange(next)
      }}
    >
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Artículos sin menú</SheetTitle>
          <SheetDescription>
            Artículos vendibles que no pertenecen a ningún menú activo. Los
            menús no modifican precios ni inventario.
          </SheetDescription>
        </SheetHeader>

        <div className="px-4">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar artículo o categoría"
              className="pl-8"
              aria-label="Buscar artículos sin menú"
            />
            {search ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="absolute top-1/2 right-1 -translate-y-1/2"
                aria-label="Limpiar búsqueda"
                onClick={() => setSearch("")}
              >
                <XIcon />
              </Button>
            ) : null}
          </div>
        </div>

        <ScrollArea className="min-h-0 flex-1 px-4">
          {visibleCount === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
              <SoupIcon className="size-8" />
              <p className="font-medium text-foreground">
                {items.length === 0
                  ? "Todos los artículos están en algún menú"
                  : "No hay artículos que coincidan"}
              </p>
              <p className="text-sm">
                {items.length === 0
                  ? "La cobertura de menús está completa."
                  : "Prueba con otro nombre o categoría."}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4 pb-4">
              {groups.map((group) => (
                <section key={group.category} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-2 px-1">
                    <h3 className="text-xs font-medium text-muted-foreground">
                      {group.category}
                    </h3>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {group.items.length}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {group.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-2 rounded-md px-1.5 py-1.5 hover:bg-muted/60"
                      >
                        <ItemThumb item={item} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {item.name}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {item.category?.name ?? "Sin categoría"}
                          </p>
                        </div>
                        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                          {formatMoney(item.price)}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </ScrollArea>

        <SheetFooter className="border-t">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground tabular-nums">
              {visibleCount} de {items.length}
            </span>
            <Button
              variant="outline"
              size="sm"
              render={<Link href="/catalog" />}
            >
              Abrir Catálogo
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function ItemThumb({ item }: { item: ArticleListItem }) {
  const [failed, setFailed] = React.useState(false)
  const showImage = Boolean(item.imageUrl) && !failed

  return (
    <div
      className={cn(
        "flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted text-muted-foreground ring-1 ring-foreground/10"
      )}
    >
      {showImage ? (
        <EntityImage
          src={item.imageUrl}
          assets={item.imageVariants}
          alt=""
          sizes="36px"
          className="size-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <SoupIcon className="size-4" />
      )}
    </div>
  )
}
