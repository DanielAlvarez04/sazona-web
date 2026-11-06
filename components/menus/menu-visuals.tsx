"use client"

import { NotebookTextIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import type { Menu, MenuStatusKind } from "@/lib/menus"
import { cn } from "@/lib/utils"

export function MenuStatusBadge({
  kind,
  className,
}: {
  kind: MenuStatusKind
  className?: string
}) {
  const variant =
    kind === "inactive"
      ? "secondary"
      : kind === "outside"
        ? "outline"
        : "success"

  return (
    <Badge
      variant={variant}
      className={cn(
        "gap-1.5 border border-transparent bg-background/90 backdrop-blur-sm",
        kind === "inactive" && "text-muted-foreground",
        kind === "outside" && "border-border bg-background/90",
        className
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-1.5 rounded-full",
          kind === "inactive" && "bg-muted-foreground/60",
          kind === "always" && "bg-emerald-500",
          kind === "available" && "bg-emerald-500",
          kind === "outside" && "bg-amber-500"
        )}
      />
      {kind === "inactive"
        ? "Inactivo"
        : kind === "always"
          ? "Siempre disponible"
          : kind === "available"
            ? "En horario"
            : "Fuera de horario"}
    </Badge>
  )
}

/** Miniatura de una sola imagen; se usa en la tabla. */
export function MenuThumbnail({
  menu,
  imageById,
  className,
}: {
  menu: Menu
  imageById: Map<string, string | null>
  className?: string
}) {
  const imageUrl = firstImageUrl(menu, imageById)

  return (
    <div
      className={cn(
        "flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-linear-to-br from-chart-4/25 via-muted to-background text-muted-foreground ring-1 ring-foreground/10",
        className
      )}
    >
      {imageUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={imageUrl}
          alt=""
          className={cn(
            "size-full object-cover",
            !menu.isActive && "opacity-60 grayscale"
          )}
        />
      ) : (
        <NotebookTextIcon className="size-4" aria-hidden />
      )}
    </div>
  )
}

/** Collage 2×2 con las imágenes de los primeros artículos del menú. */
export function MenuCover({
  menu,
  imageById,
  className,
}: {
  menu: Menu
  imageById: Map<string, string | null>
  className?: string
}) {
  const images = menu.items
    .map((row) => imageById.get(row.itemId) ?? null)
    .filter((url): url is string => Boolean(url))
    .slice(0, 4)

  if (images.length === 0) {
    return (
      <div
        className={cn(
          "flex size-full items-center justify-center bg-linear-to-br from-chart-4/25 via-muted to-background text-muted-foreground",
          className
        )}
      >
        <NotebookTextIcon className="size-10" aria-hidden />
      </div>
    )
  }

  const single = images.length === 1

  return (
    <div
      className={cn(
        "grid size-full bg-muted",
        single ? "grid-cols-1 grid-rows-1" : "grid-cols-2 grid-rows-2",
        className
      )}
    >
      {images.map((url, index) => (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          key={`${url}-${index}`}
          src={url}
          alt=""
          className={cn(
            "size-full object-cover",
            !menu.isActive && "opacity-70 grayscale"
          )}
        />
      ))}
      {!single
        ? Array.from({ length: Math.max(0, 4 - images.length) }).map(
            (_, index) => (
              <div
                key={`filler-${index}`}
                className="bg-linear-to-br from-chart-4/15 via-muted to-background"
              />
            )
          )
        : null}
    </div>
  )
}

function firstImageUrl(
  menu: Menu,
  imageById: Map<string, string | null>
): string | null {
  for (const row of menu.items) {
    const url = imageById.get(row.itemId)
    if (url) return url
  }

  return null
}
