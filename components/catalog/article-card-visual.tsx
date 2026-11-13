"use client"

import * as React from "react"
import { LayersIcon, SoupIcon, XIcon } from "lucide-react"
import { cn } from "cn"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EntityImage } from "@/components/ui/entity-image"
import { CARD_IMAGE_SIZES, type ImageAssets } from "@/lib/images"

/** Escala del texto sobre la card (nombre, precio y detalle). */
export type ArticleCardTextSize = "sm" | "md" | "lg" | "xl" | "2xl"

const CARD_TEXT_CLASSES: Record<
  ArticleCardTextSize,
  { price: string; name: string; nameLeading: string; subtitle: string }
> = {
  sm: {
    price: "text-[10px]",
    name: "text-[11px]",
    nameLeading: "leading-tight",
    subtitle: "text-[10px]",
  },
  md: {
    price: "text-[11px]",
    name: "text-[13px]",
    nameLeading: "leading-[1.2]",
    subtitle: "text-[11px]",
  },
  lg: {
    price: "text-[13px]",
    name: "text-[15px]",
    nameLeading: "leading-[1.15]",
    subtitle: "text-xs",
  },
  xl: {
    price: "text-sm",
    name: "text-[16px]",
    nameLeading: "leading-[1.1]",
    subtitle: "text-[13px]",
  },
  "2xl": {
    price: "text-[16px]",
    name: "text-[18px]",
    nameLeading: "leading-[1.05]",
    subtitle: "text-sm",
  },
}

/**
 * Card visual de un artículo: imagen a sangre, degradado y precio/nombre.
 *
 * Es la misma pieza que usa el editor de menús (catálogo y artículos
 * seleccionados). Acepta slots para reutilizarla en el POS:
 * - `badge`: etiqueta superior izquierda (grupo, persona, etc.).
 * - `action`: acción superior derecha (por defecto, la ✕ de quitar).
 * - `subtitle`: línea extra bajo el nombre (presentación, opciones…).
 * - `price`: precio mostrado (por defecto, el del artículo).
 */
export function ArticleCardVisual({
  name,
  price,
  imageUrl,
  imageVariants,
  isActive = true,
  selected = false,
  groupLabel = null,
  badge,
  action,
  subtitle = null,
  onRemove,
  removeLabel,
  disabled = false,
  className,
  textSize = "md",
  compact = false,
  showImage = true,
  isCombo = false,
}: {
  name: string
  price: string
  imageUrl?: string | null
  imageVariants?: ImageAssets | null
  isActive?: boolean
  /** Si es `false`, se oculta la imagen y la card pasa a relación 5:3. */
  showImage?: boolean
  /** Cambia el icono de respaldo (combo vs. artículo). */
  isCombo?: boolean
  selected?: boolean
  /** Grupo donde vive el artículo (solo en cards del catálogo de menús). */
  groupLabel?: string | null
  /** Etiqueta superior izquierda; tiene prioridad sobre `groupLabel`. */
  badge?: React.ReactNode
  /** Acción superior derecha; tiene prioridad sobre `onRemove`. */
  action?: React.ReactNode
  /** Detalle bajo el nombre (variante, opciones, etc.). */
  subtitle?: string | null
  onRemove?: () => void
  removeLabel?: string
  disabled?: boolean
  /** Clases extra para el contenedor (hover, foco, etc.). */
  className?: string
  /** Escala del texto de la card (solo POS la ajusta). */
  textSize?: ArticleCardTextSize
  /**
   * Interlineado compacto y sin separación entre precio y nombre. Se usa en el
   * catálogo del POS, donde el texto puede crecer hasta extra grande.
   */
  compact?: boolean
}) {
  const [failedSrc, setFailedSrc] = React.useState<string | null>(null)
  const showFallback = !showImage || !imageUrl || failedSrc === imageUrl
  const FallbackIcon = isCombo ? LayersIcon : SoupIcon
  const topLeft =
    badge ??
    (groupLabel ? (
      <Badge
        variant="outline"
        title={groupLabel}
        className="max-w-[calc(100%-1.5rem)] truncate border-white/35 bg-black/35 text-[10px] text-white backdrop-blur-sm"
      >
        {groupLabel}
      </Badge>
    ) : null)
  const topRight =
    action ??
    (onRemove ? (
      <Button
        type="button"
        variant="destructive"
        size="icon-xs"
        aria-label={removeLabel ?? `Quitar ${name} del menú`}
        title="Quitar"
        disabled={disabled}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation()
          onRemove()
        }}
        className="ml-auto bg-destructive text-white shadow-sm hover:bg-destructive/90 dark:bg-destructive dark:text-white dark:hover:bg-destructive/90"
      >
        <XIcon />
      </Button>
    ) : null)

  const text = CARD_TEXT_CLASSES[textSize]

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-xl border bg-muted text-left select-none",
        showImage ? "aspect-square" : "aspect-[5/3]",
        selected && "ring-2 ring-primary",
        !isActive && "opacity-80",
        className
      )}
    >
      <div className="absolute inset-0 bg-muted">
        {showFallback ? (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            <FallbackIcon className="size-8" aria-hidden />
            <span className="sr-only">Sin imagen</span>
          </div>
        ) : (
          <EntityImage
            src={imageUrl}
            assets={imageVariants}
            alt={name}
            sizes={CARD_IMAGE_SIZES}
            draggable={false}
            className={cn(
              "size-full object-cover",
              !isActive && "grayscale"
            )}
            onError={() => setFailedSrc(imageUrl ?? null)}
          />
        )}
      </div>

      {/* Mismo degradado que las tarjetas de Catálogo. */}
      <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/85 via-black/30 to-black/10" />

      <div className="relative flex size-full flex-col p-1.5 text-white">
        {topLeft || topRight ? (
          <div className="flex items-start justify-between gap-1">
            <div className="min-w-0">{topLeft}</div>
            {topRight}
          </div>
        ) : null}

        <div
          className={cn(
            "mt-auto flex min-w-0 flex-col",
            compact ? "gap-0" : "gap-0.5"
          )}
        >
          <span
            className={cn(
              "leading-none font-normal text-white tabular-nums drop-shadow-sm",
              text.price
            )}
          >
            {price}
          </span>
          <p
            className={cn(
              "line-clamp-2 text-pretty font-semibold text-white drop-shadow-sm",
              text.name,
              compact
                ? cn(text.nameLeading, "pt-[0.06em] pb-[0.1em]")
                : "leading-tight"
            )}
            title={name}
          >
            {name}
          </p>
          {subtitle ? (
            <span
              className={cn(
                "line-clamp-1 mt-0.5 leading-tight text-white/80 drop-shadow-sm",
                text.subtitle
              )}
              title={subtitle}
            >
              {subtitle}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  )
}
