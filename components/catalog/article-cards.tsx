"use client"

import * as React from "react"
import { PencilIcon, PowerIcon, UtensilsCrossedIcon } from "lucide-react"

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
 * Imagen cuadrada del artículo.
 *
 * La imagen (o el icono de respaldo) ocupa toda la columna. Si no hay imagen o
 * la URL falla al cargar se muestra el icono de tenedor y cuchillo. Cuando el
 * artículo está inactivo la imagen va en blanco y negro y el badge «Inactivo»
 * queda centrado encima.
 */
function ArticleImage({ article }: { article: ArticleListItem }) {
  // URL que falló al cargar; si cambia la imagen se vuelve a intentar.
  const [failedSrc, setFailedSrc] = React.useState<string | null>(null)
  const showFallback =
    !article.imageUrl || failedSrc === article.imageUrl

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
          onError={() => setFailedSrc(article.imageUrl ?? null)}
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
