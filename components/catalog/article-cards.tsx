"use client"

import * as React from "react"
import { PencilIcon, PowerIcon, SoupIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { formatMoney, type ArticleListItem } from "@/lib/catalog"
import { cn } from "cn"

import {
  ArticleActionsMenu,
  PresentationPreview,
  type ArticleRowActions,
} from "./articles-columns"
import { ArticleGroupSelect } from "./article-group-select"

/**
 * Estado de la imagen del artículo: qué mostrar cuando no hay imagen o la URL
 * falla al cargar.
 */
function useArticleImage(article: ArticleListItem) {
  // URL que falló al cargar; si cambia la imagen se vuelve a intentar.
  const [failedSrc, setFailedSrc] = React.useState<string | null>(null)

  return {
    showFallback: !article.imageUrl || failedSrc === article.imageUrl,
    handleError: () => setFailedSrc(article.imageUrl ?? null),
  }
}

/**
 * Tarjeta con la imagen del artículo en relación de aspecto cuadrada.
 *
 * La información (precio, presentaciones y nombre) va sobre la imagen,
 * alineada al borde inferior, y las acciones (editar/activar) viven en un pie
 * debajo de la imagen con el mismo fondo que el pie de los diálogos. La card no
 * tiene efectos de hover.
 */
function FullArticleCard({
  article,
  actions,
  showActions = true,
  canSelect,
  selectDisabled = false,
  selected,
  onSelectedChange,
  groups = [],
  group = null,
  onGroupChange,
}: {
  article: ArticleListItem
  actions: ArticleRowActions
  /** `false` oculta el pie de acciones (selector de artículos del menú). */
  showActions?: boolean
  canSelect: boolean
  /** Bloquea el checkbox (p. ej. artículos inactivos en el menú). */
  selectDisabled?: boolean
  selected: boolean
  onSelectedChange: (id: string, selected: boolean) => void
  /** Secciones disponibles para asignar el artículo. */
  groups?: string[]
  group?: string | null
  onGroupChange?: (id: string, group: string | null) => void
}) {
  const { showFallback, handleError } = useArticleImage(article)

  return (
    <div
      data-selected={selected || undefined}
      className={cn(
        "rounded-xl",
        "data-[selected=true]:ring-2 data-[selected=true]:ring-primary"
      )}
    >
      <Card size="sm" className="gap-0 overflow-hidden p-0 py-0">
        {/* Imagen cuadrada con la información alineada al borde inferior. */}
        <div className="relative aspect-square w-full">
          <div className="absolute inset-0 bg-muted">
            {showFallback ? (
              <div className="flex size-full items-center justify-center text-muted-foreground">
                <SoupIcon className="size-12" aria-hidden />
                <span className="sr-only">Sin imagen</span>
              </div>
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={article.imageUrl ?? undefined}
                alt={article.name}
                className={cn(
                  "size-full object-cover",
                  !article.isActive && "grayscale"
                )}
                onError={handleError}
              />
            )}
          </div>

          {/* Degradado para que el texto se lea sobre la foto. */}
          <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/85 via-black/30 to-black/10" />

          <div className="relative flex size-full flex-col p-2 text-white">
            <div className="flex items-start justify-between gap-1">
              {canSelect ? (
                <Checkbox
                  checked={selected}
                  disabled={selectDisabled}
                  onCheckedChange={(value) =>
                    onSelectedChange(article.id, !!value)
                  }
                  aria-label={`Seleccionar ${article.name}`}
                  className="border-white/70 bg-black/30"
                />
              ) : (
                <span />
              )}

              {showActions ? (
                <ArticleActionsMenu
                  article={article}
                  actions={actions}
                  triggerSize="icon-sm"
                  triggerClassName="text-white/90 hover:bg-white/15 hover:text-white aria-expanded:bg-white/15 [&_svg]:drop-shadow-[0_1px_2px_rgb(0_0_0/0.85)]"
                />
              ) : null}
            </div>

            {/*
             * La información queda alineada al borde inferior de la imagen y
             * siempre visible: la card no tiene efectos de hover.
             */}
            <div className="mt-auto flex min-w-0 flex-col gap-1">
              {article.isActive ? null : (
                <Badge className="self-start border border-amber-300/40 bg-amber-400/20 text-amber-200 backdrop-blur-sm">
                  Inactivo
                </Badge>
              )}

              <div className="flex min-w-0 items-center gap-1">
                <span className="text-[15px] leading-none font-normal tabular-nums text-white drop-shadow-sm">
                  {formatMoney(article.price)}
                </span>
                <PresentationPreview
                  price={article.price}
                  variants={article.variants}
                  compact
                  className="border-white/40 bg-black/30 text-white/90 hover:bg-black/45 hover:text-white"
                />
              </div>

              <p
                className="line-clamp-2 text-pretty text-base font-semibold leading-snug drop-shadow-sm"
                title={article.name}
              >
                {article.name}
              </p>
            </div>
          </div>
        </div>

        {/* Pie: acciones en Catálogo, grupo del menú en el selector. */}
        <div
          role="group"
          aria-label={
            showActions ? `Acciones de ${article.name}` : `Grupo de ${article.name}`
          }
          className={cn(
            "flex min-h-11 items-center gap-1 border-t bg-muted px-2",
            showActions && "justify-end py-2"
          )}
        >
          {showActions ? (
            article.isActive ? (
              <Button
                size="sm"
                className="w-max shadow-sm"
                onClick={() => actions.onEdit(article)}
              >
                <PencilIcon className="size-4" />
                Editar
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => actions.onEdit(article)}
                  aria-label={`Editar ${article.name}`}
                >
                  <PencilIcon className="size-4" />
                </Button>
                <Button
                  size="sm"
                  className="w-max shadow-sm"
                  onClick={() => actions.onActivate(article)}
                >
                  <PowerIcon className="size-4" />
                  Activar
                </Button>
              </>
            )
          ) : selected ? (
            <ArticleGroupSelect
              groups={groups}
              value={group}
              disabled={!onGroupChange}
              ariaLabel={`Grupo de ${article.name}`}
              onChange={(next) => onGroupChange?.(article.id, next)}
            />
          ) : null}
        </div>
      </Card>
    </div>
  )
}

/**
 * Vista de tarjetas del catálogo de artículos.
 *
 * Tarjetas cuadradas con la imagen de fondo y la información en overlay. Seis
 * por fila en pantallas grandes.
 */
export function ArticleCards({
  articles,
  actions,
  showActions = true,
  canSelect = false,
  selectedIds,
  onSelectedChange,
  groups,
  groupByItemId,
  onGroupChange,
  isSelectable,
}: {
  articles: ArticleListItem[]
  actions: ArticleRowActions
  /** `false` oculta el pie de acciones (selector de artículos del menú). */
  showActions?: boolean
  /** Muestra el checkbox de selección para acciones en lote. */
  canSelect?: boolean
  selectedIds: Record<string, boolean>
  onSelectedChange: (id: string, selected: boolean) => void
  /** Secciones del menú y grupo asignado a cada artículo. */
  groups?: string[]
  groupByItemId?: Record<string, string | null>
  onGroupChange?: (id: string, group: string | null) => void
  /** Restringe qué artículos se pueden marcar (p. ej. solo activos). */
  isSelectable?: (article: ArticleListItem) => boolean
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-[repeat(var(--np-card-columns,6),minmax(0,1fr))]">
      {articles.map((article) => (
        <FullArticleCard
          key={article.id}
          article={article}
          actions={actions}
          showActions={showActions}
          canSelect={canSelect}
          selectDisabled={isSelectable ? !isSelectable(article) : false}
          selected={selectedIds[article.id] ?? false}
          onSelectedChange={onSelectedChange}
          groups={groups}
          group={groupByItemId?.[article.id] ?? null}
          onGroupChange={onGroupChange}
        />
      ))}
    </div>
  )
}
