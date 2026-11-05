"use client"

import * as React from "react"
import {
  BlenderIcon,
  PackageIcon,
  PencilIcon,
  PowerIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { formatMoney, type Recipe } from "@/lib/catalog"
import { cn } from "cn"

import { PresentationPreview } from "./articles-columns"
import { RecipeActionsMenu, type RecipeRowActions } from "./recipes-columns"

/** Estado de la imagen del artículo publicado; las recetas usan la del item. */
function useRecipeImage(recipe: Recipe) {
  const [failedSrc, setFailedSrc] = React.useState<string | null>(null)
  const src = recipe.imageUrl ?? recipe.item?.imageUrl ?? null

  return {
    src,
    showFallback: !src || failedSrc === src,
    handleError: () => setFailedSrc(src),
  }
}

/**
 * Tarjeta de receta con el mismo patrón que las tarjetas de artículos: imagen
 * cuadrada con la información en overlay y las acciones en un pie.
 */
function FullRecipeCard({
  recipe,
  actions,
  canSelect,
  selected,
  onSelectedChange,
}: {
  recipe: Recipe
  actions: RecipeRowActions
  canSelect: boolean
  selected: boolean
  onSelectedChange: (id: string, selected: boolean) => void
}) {
  const { src, showFallback, handleError } = useRecipeImage(recipe)
  const item = recipe.item

  return (
    <div
      data-selected={selected || undefined}
      className={cn(
        "rounded-xl",
        "data-[selected=true]:ring-2 data-[selected=true]:ring-primary"
      )}
    >
      <Card size="sm" className="gap-0 overflow-hidden p-0 py-0">
        <div className="relative aspect-square w-full">
          <div className="absolute inset-0 bg-muted">
            {showFallback ? (
              <div className="flex size-full items-center justify-center text-muted-foreground">
                <BlenderIcon className="size-12" aria-hidden />
                <span className="sr-only">Sin imagen</span>
              </div>
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={src ?? undefined}
                alt={recipe.name}
                className={cn(
                  "size-full object-cover",
                  !recipe.isActive && "grayscale"
                )}
                onError={handleError}
              />
            )}
          </div>

          <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/85 via-black/30 to-black/10" />

          <div className="relative flex size-full flex-col p-2 text-white">
            <div className="flex items-start justify-between gap-1">
              {canSelect ? (
                <Checkbox
                  checked={selected}
                  onCheckedChange={(value) =>
                    onSelectedChange(recipe.id, !!value)
                  }
                  aria-label={`Seleccionar ${recipe.name}`}
                  className="border-white/70 bg-black/30"
                />
              ) : (
                <span />
              )}

              <RecipeActionsMenu
                recipe={recipe}
                actions={actions}
                triggerSize="icon-sm"
                triggerClassName="text-white/90 hover:bg-white/15 hover:text-white aria-expanded:bg-white/15 [&_svg]:drop-shadow-[0_1px_2px_rgb(0_0_0/0.85)]"
              />
            </div>

            <div className="mt-auto flex min-w-0 flex-col gap-1">
              <div className="flex flex-wrap gap-1">
                <Badge className="border border-white/30 bg-black/30 text-white backdrop-blur-sm">
                  {recipe.itemId ? "Artículo" : "Solo receta"}
                </Badge>
                {recipe.producesIngredient ? (
                  <Badge className="border border-white/30 bg-black/30 text-white backdrop-blur-sm">
                    <PackageIcon data-icon="inline-start" />
                    Insumo
                  </Badge>
                ) : null}
                {recipe.isActive ? null : (
                  <Badge className="border border-amber-300/40 bg-amber-400/20 text-amber-200 backdrop-blur-sm">
                    Inactiva
                  </Badge>
                )}
              </div>

              <div className="flex min-w-0 items-center gap-1">
                {item ? (
                  <>
                    <span className="text-[15px] leading-none font-normal tabular-nums text-white drop-shadow-sm">
                      {formatMoney(item.price)}
                    </span>
                    <PresentationPreview
                      price={item.price}
                      variants={item.variants}
                      compact
                      className="border-white/40 bg-black/30 text-white/90 hover:bg-black/45 hover:text-white"
                    />
                  </>
                ) : (
                  <span className="text-[15px] leading-none font-normal tabular-nums text-white drop-shadow-sm">
                    {recipe.estimatedCost
                      ? `Costo ${formatMoney(recipe.estimatedCost)}`
                      : "Sin costo"}
                  </span>
                )}
              </div>

              {item ? (
                <span className="text-[11px] leading-none text-white/80 drop-shadow-sm">
                  {recipe.estimatedCost
                    ? `Costo ${formatMoney(recipe.estimatedCost)}`
                    : "Sin costo"}
                </span>
              ) : null}

              <p
                className="line-clamp-2 text-pretty text-base font-semibold leading-snug drop-shadow-sm"
                title={recipe.name}
              >
                {recipe.name}
              </p>
            </div>
          </div>
        </div>

        <div
          role="group"
          aria-label={`Acciones de ${recipe.name}`}
          className="flex items-center justify-end gap-1 border-t bg-muted px-2 py-2"
        >
          {recipe.isActive ? (
            <Button
              size="sm"
              className="w-max shadow-sm"
              onClick={() => actions.onEdit(recipe)}
            >
              <PencilIcon className="size-4" />
              Editar
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => actions.onEdit(recipe)}
                aria-label={`Editar ${recipe.name}`}
              >
                <PencilIcon className="size-4" />
              </Button>
              <Button
                size="sm"
                className="w-max shadow-sm"
                onClick={() => actions.onToggleActive(recipe)}
              >
                <PowerIcon className="size-4" />
                Activar
              </Button>
            </>
          )}
        </div>
      </Card>
    </div>
  )
}

/** Vista de tarjetas del catálogo de recetas. */
export function RecipeCards({
  recipes,
  actions,
  canSelect = false,
  selectedIds,
  onSelectedChange,
}: {
  recipes: Recipe[]
  actions: RecipeRowActions
  /** Muestra el checkbox de selección para acciones en lote. */
  canSelect?: boolean
  selectedIds: Record<string, boolean>
  onSelectedChange: (id: string, selected: boolean) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-[repeat(var(--np-card-columns,6),minmax(0,1fr))]">
      {recipes.map((recipe) => (
        <FullRecipeCard
          key={recipe.id}
          recipe={recipe}
          actions={actions}
          canSelect={canSelect}
          selected={selectedIds[recipe.id] ?? false}
          onSelectedChange={onSelectedChange}
        />
      ))}
    </div>
  )
}
