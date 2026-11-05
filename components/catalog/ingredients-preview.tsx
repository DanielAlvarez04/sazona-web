"use client"

import { BeefIcon } from "lucide-react"

import { badgeVariants } from "@/components/ui/badge"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import { formatQuantity, unitLabel, type Recipe } from "@/lib/catalog"
import { cn } from "cn"

/** Vista previa de los insumos que componen la receta. */
export function IngredientsPreview({ recipe }: { recipe: Recipe }) {
  const count = recipe.ingredients.length

  return (
    <HoverCard>
      <HoverCardTrigger
        render={<button type="button" />}
        className={cn(
          badgeVariants({ variant: "outline" }),
          "cursor-default tabular-nums"
        )}
        aria-label={`${count} ${count === 1 ? "ingrediente" : "ingredientes"}. Ver detalle`}
      >
        <BeefIcon />
        {count}
      </HoverCardTrigger>
      <HoverCardContent align="end" className="w-64 p-2">
        <p className="px-2 pb-1 text-xs font-medium text-muted-foreground">
          {count === 1 ? "Ingrediente" : "Ingredientes"}
        </p>
        {count === 0 ? (
          <p className="px-2 py-1 text-sm text-muted-foreground">
            Sin ingredientes.
          </p>
        ) : (
          <div className="flex flex-col gap-0.5">
            {recipe.ingredients.map((row) => (
              <div
                key={row.id}
                className="flex items-center justify-between gap-3 rounded-md px-2 py-1 text-sm"
              >
                <span className="min-w-0 truncate" title={row.ingredient.name}>
                  {row.ingredient.name}
                  {row.isOptional ? (
                    <span className="text-muted-foreground"> (opcional)</span>
                  ) : null}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {formatQuantity(row.quantity)}{" "}
                  {unitLabel(row.ingredient.displayUnit)}
                </span>
              </div>
            ))}
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  )
}
