"use client"

import * as React from "react"
import { PencilIcon, PowerIcon, UtensilsCrossedIcon } from "lucide-react"

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
 * Tarjeta cuadrada con la imagen del artículo a sangre.
 *
 * La información (precio, presentaciones y nombre) se agrupa en la parte baja
 * sobre un degradado oscuro para que se lea sobre cualquier imagen. Las
 * acciones quedan arriba a la derecha y el grupo «actionable» (editar/activar)
 * entra deslizándose desde abajo al pasar el cursor.
 */
function FullArticleCard({
  article,
  actions,
  canSelect,
  selected,
  onSelectedChange,
}: {
  article: ArticleListItem
  actions: ArticleRowActions
  canSelect: boolean
  selected: boolean
  onSelectedChange: (id: string, selected: boolean) => void
}) {
  const { showFallback, handleError } = useArticleImage(article)

  return (
    <Card
      size="sm"
      data-selected={selected || undefined}
      className={cn(
        "group relative aspect-square gap-0 overflow-hidden p-0 py-0 transition-shadow",
        "data-[selected=true]:ring-2 data-[selected=true]:ring-primary"
      )}
    >
      {/*
       * Imagen (o icono) de fondo. El contenedor sobresale 16 px por cada lado
       * para que el desenfoque del hover no deje un borde translúcido: la card
       * lo recorta con `overflow-hidden`.
       */}
      <div className="absolute -inset-4 bg-muted">
        {showFallback ? (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            <UtensilsCrossedIcon className="size-12" aria-hidden />
            <span className="sr-only">Sin imagen</span>
          </div>
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={article.imageUrl ?? undefined}
            alt={article.name}
            className={cn(
              "size-full object-cover transition-[filter] duration-300 ease-out group-hover:blur-[16px]",
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
              onCheckedChange={(value) =>
                onSelectedChange(article.id, !!value)
              }
              aria-label={`Seleccionar ${article.name}`}
              className="border-white/70 bg-black/30"
            />
          ) : (
            <span />
          )}

          <ArticleActionsMenu
            article={article}
            actions={actions}
            triggerSize="icon-sm"
            triggerClassName="text-white/90 hover:bg-white/15 hover:text-white aria-expanded:bg-white/15"
          />
        </div>

        {/*
         * La información queda alineada al borde inferior. Al pasar el cursor
         * (o al enfocar con el teclado) sube justo lo que mide el grupo
         * «actionable» (32 px del botón + 4 px de separación) para dejarle
         * sitio. Se usa `focus-visible` en lugar de `focus-within` para que un
         * clic con el ratón no deje la tarjeta abierta.
         */}
        <div className="mt-auto flex min-w-0 flex-col gap-1 transition-transform duration-200 ease-out group-hover:-translate-y-9 group-has-[:focus-visible]:-translate-y-9">
          {article.isActive ? null : (
            <Badge className="self-start border border-amber-300/40 bg-amber-400/20 text-amber-200 backdrop-blur-sm">
              Inactivo
            </Badge>
          )}

          <div className="flex min-w-0 items-center gap-1">
            <span className="text-base font-bold leading-none tabular-nums text-white/80 drop-shadow-sm">
              {formatMoney(article.price)}
            </span>
            <PresentationPreview
              article={article}
              compact
              className="border-white/40 bg-black/30 text-white/90 hover:bg-black/45 hover:text-white"
            />
          </div>

          <p
            className="line-clamp-2 text-pretty text-sm font-semibold leading-snug drop-shadow-sm"
            title={article.name}
          >
            {article.name}
          </p>
        </div>

        {/*
         * Grupo «actionable»: vive fuera del borde inferior de la card (lo
         * recorta `overflow-hidden`) y entra deslizándose desde abajo al pasar
         * el cursor o al enfocar con el teclado (`focus-visible`, no al hacer
         * clic con el ratón).
         */}
        <div
          role="group"
          aria-label={`Acciones de ${article.name}`}
          className={cn(
            "absolute inset-x-2 bottom-2 flex items-center gap-1",
            "translate-y-[calc(100%+0.5rem)] transition-transform duration-200 ease-out",
            "group-hover:translate-y-0 group-has-[:focus-visible]:translate-y-0"
          )}
        >
          {article.isActive ? (
            <Button
              size="sm"
              className="w-full shadow-sm"
              onClick={() => actions.onEdit(article)}
            >
              <PencilIcon className="size-4" />
              Editar
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 border-white/50 bg-transparent text-white hover:bg-white/10 hover:text-white"
                onClick={() => actions.onEdit(article)}
              >
                <PencilIcon className="size-4" />
                Editar
              </Button>
              <Button
                size="sm"
                className="flex-1 shadow-sm"
                onClick={() => actions.onActivate(article)}
              >
                <PowerIcon className="size-4" />
                Activar
              </Button>
            </>
          )}
        </div>
      </div>
    </Card>
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
  canSelect = false,
  selectedIds,
  onSelectedChange,
}: {
  articles: ArticleListItem[]
  actions: ArticleRowActions
  /** Muestra el checkbox de selección para acciones en lote. */
  canSelect?: boolean
  selectedIds: Record<string, boolean>
  onSelectedChange: (id: string, selected: boolean) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {articles.map((article) => (
        <FullArticleCard
          key={article.id}
          article={article}
          actions={actions}
          canSelect={canSelect}
          selected={selectedIds[article.id] ?? false}
          onSelectedChange={onSelectedChange}
        />
      ))}
    </div>
  )
}
