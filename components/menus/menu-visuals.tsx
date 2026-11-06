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

/**
 * Collage de imágenes del menú según cuántas haya:
 * 1 → completa, 2 → diagonal, 3 → tres columnas, 4+ → 2×2 con «+N» en la
 * cuarta celda cuando sobran imágenes.
 */
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

  const imageClassName = cn(
    "size-full object-cover",
    !menu.isActive && "opacity-70 grayscale"
  )
  const count = images.length
  const visible = images.slice(0, 4)
  const extras = Math.max(0, count - 4)

  return (
    <div className={cn("relative size-full overflow-hidden bg-muted", className)}>
      {count === 1 ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={images[0]} alt="" className={imageClassName} />
      ) : null}

      {count === 2 ? (
        <>
          {images.map((url, index) => (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              key={`${url}-${index}`}
              src={url}
              alt=""
              className={cn("absolute inset-0", imageClassName)}
              style={{
                clipPath:
                  index === 0
                    ? "polygon(0 0, 100% 0, 0 100%)"
                    : "polygon(100% 0, 100% 100%, 0 100%)",
              }}
            />
          ))}
        </>
      ) : null}

      {count === 3 ? (
        <div className="grid size-full grid-cols-3">
          {images.map((url, index) => (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              key={`${url}-${index}`}
              src={url}
              alt=""
              className={imageClassName}
            />
          ))}
        </div>
      ) : null}

      {count >= 4 ? (
        <div className="grid size-full grid-cols-2 grid-rows-2">
          {visible.map((url, index) => (
            <div key={`${url}-${index}`} className="relative overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className={imageClassName} />

              {index === 3 && extras > 0 ? (
                <div className="absolute inset-0 flex items-center justify-center bg-black/55 text-lg font-semibold text-white backdrop-blur-[1px]">
                  +{extras}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
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
