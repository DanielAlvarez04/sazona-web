"use client"

import * as React from "react"
import { PencilIcon, PowerIcon, UtensilsCrossedIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
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
 * Imagen cuadrada del artículo.
 *
 * La imagen (o el icono de respaldo) ocupa toda la columna. Si no hay imagen o
 * la URL falla al cargar se muestra el icono de tenedor y cuchillo. Cuando el
 * artículo está inactivo la imagen va en blanco y negro y el badge «Inactivo»
 * queda centrado encima.
 */
function ArticleImage({ article }: { article: ArticleListItem }) {
  const { showFallback, handleError } = useArticleImage(article)

  return (
    <div
      className={cn(
        "relative size-20 shrink-0 overflow-hidden bg-muted",
        !article.isActive && "grayscale"
      )}
    >
      {showFallback ? (
        <div className="flex size-full items-center justify-center text-muted-foreground">
          <UtensilsCrossedIcon className="size-8" aria-hidden />
          <span className="sr-only">Sin imagen</span>
        </div>
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={article.imageUrl ?? undefined}
          alt={article.name}
          className="size-full object-cover"
          onError={handleError}
        />
      )}

      {article.isActive ? null : (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="rounded-full border border-amber-500/40 bg-background/90 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
            Inactivo
          </span>
        </div>
      )}
    </div>
  )
}

/**
 * Vista de tarjetas del catálogo de artículos.
 *
 * Cada tarjeta tiene una fila con la imagen, el contenido (precio, nombre y
 * presentaciones) y la columna de acciones con el checkbox de selección; el pie
 * contiene las acciones y el botón Editar.
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
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {articles.map((article) => (
        <Card key={article.id} size="sm" className="gap-0 py-0">
          <CardContent className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-0 p-0">
            <ArticleImage article={article} />

            <div className="flex min-w-0 flex-col gap-0.5 p-2">
              <div className="flex min-w-0 items-center gap-1">
                <span className="text-[0.9375rem] font-bold leading-tight tabular-nums text-muted-foreground">
                  {formatMoney(article.price)}
                </span>
                <PresentationPreview article={article} compact />
              </div>

              <p
                className="line-clamp-2 min-h-[2lh] text-left text-pretty font-semibold leading-snug text-foreground"
                title={article.name}
              >
                {article.name}
              </p>
            </div>

            {canSelect ? (
              <div className="self-start p-2 pl-0">
                <Checkbox
                  checked={selectedIds[article.id] ?? false}
                  onCheckedChange={(value) =>
                    onSelectedChange(article.id, !!value)
                  }
                  aria-label={`Seleccionar ${article.name}`}
                />
              </div>
            ) : null}
          </CardContent>

          <CardFooter className="justify-between gap-2 border-t bg-muted/50 p-2 pt-2!">
            <ArticleActionsMenu
              article={article}
              actions={actions}
              triggerSize="icon-sm"
            />
            <div className="flex items-center gap-1">
              <Button
                variant={article.isActive ? "default" : "secondary"}
                size="sm"
                onClick={() => actions.onEdit(article)}
              >
                <PencilIcon className="size-4" />
                Editar
              </Button>
              {article.isActive ? null : (
                <Button
                  variant="default"
                  size="icon-sm"
                  aria-label={`Activar ${article.name}`}
                  title="Activar artículo"
                  onClick={() => actions.onActivate(article)}
                >
                  <PowerIcon className="size-4" />
                </Button>
              )}
            </div>
          </CardFooter>
        </Card>
      ))}
    </div>
  )
}

/**
 * Tarjeta cuadrada con la imagen del artículo a sangre.
 *
 * La información (precio, presentaciones y nombre) se agrupa en la parte baja
 * sobre un degradado oscuro para que se lea sobre cualquier imagen. Las
 * acciones quedan arriba a la derecha y el botón de edición abajo, dentro del
 * mismo overlay.
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
      {/* Imagen (o icono) de fondo, ocupando toda la tarjeta. */}
      <div className="absolute inset-0 bg-muted">
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
              "size-full object-cover transition-transform duration-300 group-hover:scale-105",
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

          <div className="flex items-center gap-1">
            {article.isActive ? null : (
              <Button
                variant="ghost"
                size="icon-sm"
                className="bg-black/35 text-white/90 shadow-sm ring-1 ring-white/20 backdrop-blur-sm hover:bg-black/55 hover:text-white"
                aria-label={`Activar ${article.name}`}
                title="Activar artículo"
                onClick={() => actions.onActivate(article)}
              >
                <PowerIcon className="size-4" />
              </Button>
            )}
            <ArticleActionsMenu
              article={article}
              actions={actions}
              triggerSize="icon-sm"
              triggerClassName="bg-black/35 text-white/90 shadow-sm ring-1 ring-white/20 backdrop-blur-sm hover:bg-black/55 hover:text-white aria-expanded:bg-black/60"
            />
          </div>
        </div>

        <div className="mt-auto flex min-w-0 flex-col gap-1">
          {article.isActive ? null : (
            <Badge className="self-start border-transparent bg-amber-400 text-amber-950">
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

          <Button
            size="sm"
            className="mt-0.5 w-full shadow-sm"
            onClick={() => actions.onEdit(article)}
          >
            <PencilIcon className="size-4" />
            Editar
          </Button>
        </div>
      </div>
    </Card>
  )
}

/**
 * Vista «cards full» del catálogo.
 *
 * Igual que las tarjetas normales pero con relación de aspecto cuadrada, la
 * imagen de fondo y la información en overlay. Seis tarjetas por fila en
 * pantallas grandes.
 */
export function ArticleCardsFull({
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
