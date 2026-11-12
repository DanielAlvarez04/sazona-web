"use client"

import { NotebookTextIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { EntityImage } from "@/components/ui/entity-image"
import { CARD_IMAGE_SIZES, type ImageAssets } from "@/lib/images"
import {
  menuStatusLabel,
  type Menu,
  type MenuStatusKind,
} from "@/lib/menus"
import { cn } from "@/lib/utils"

/** Imagen de un artículo del menú: URL de respaldo + variantes optimizadas. */
export interface MenuImage {
  url: string | null
  assets: ImageAssets | null
}

export type MenuImageMap = Map<string, MenuImage | null>

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
        // Fondo del tema en ambos modos: el `dark:bg-*` de la variante
        // success/outline no debe filtrarse solo en modo oscuro.
        "gap-1.5 border border-transparent bg-background dark:bg-background",
        kind === "inactive" && "text-muted-foreground",
        kind === "outside" && "border-border",
        className
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-1.5 rounded-full",
          kind === "inactive" && "bg-muted-foreground/60",
          (kind === "always" || kind === "available") && "bg-emerald-500",
          kind === "outside" && "bg-amber-500"
        )}
      />
      {menuStatusLabel(kind)}
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
  imageById: MenuImageMap
  className?: string
}) {
  const image = firstImage(menu, imageById)

  return (
    <div
      className={cn(
        "flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-linear-to-br from-chart-4/25 via-muted to-background text-muted-foreground ring-1 ring-foreground/10",
        className
      )}
    >
      {image ? (
        <EntityImage
          src={image.url}
          assets={image.assets}
          alt=""
          sizes="36px"
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
  imageById: MenuImageMap
  className?: string
}) {
  const images = menu.items
    .map((row) => imageById.get(row.itemId) ?? null)
    .filter((image): image is MenuImage => Boolean(image?.url))

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
        <EntityImage
          src={images[0].url}
          assets={images[0].assets}
          alt=""
          sizes={CARD_IMAGE_SIZES}
          className={imageClassName}
        />
      ) : null}

      {count === 2 ? (
        <>
          {images.map((image, index) => (
            <EntityImage
              key={`${image.url}-${index}`}
              src={image.url}
              assets={image.assets}
              alt=""
              sizes={CARD_IMAGE_SIZES}
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
          {images.map((image, index) => (
            <EntityImage
              key={`${image.url}-${index}`}
              src={image.url}
              assets={image.assets}
              alt=""
              sizes={CARD_IMAGE_SIZES}
              className={imageClassName}
            />
          ))}
        </div>
      ) : null}

      {count >= 4 ? (
        <div className="grid size-full grid-cols-2 grid-rows-2">
          {visible.map((image, index) => (
            <div key={`${image.url}-${index}`} className="relative overflow-hidden">
              <EntityImage
                src={image.url}
                assets={image.assets}
                alt=""
                sizes={CARD_IMAGE_SIZES}
                className={imageClassName}
              />

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

function firstImage(
  menu: Menu,
  imageById: MenuImageMap
): MenuImage | null {
  for (const row of menu.items) {
    const image = imageById.get(row.itemId)
    if (image?.url) return image
  }

  return null
}
