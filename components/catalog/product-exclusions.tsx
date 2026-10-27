"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { Loader2Icon, SaveIcon } from "lucide-react"

import { replaceExclusions } from "@/app/(app)/catalog/actions"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { FieldError } from "@/components/ui/field"
import { useActionForm } from "@/hooks/use-action-form"
import type { Ingredient, ProductDetail } from "@/lib/catalog"

export function ProductExclusions({
  product,
  ingredients,
  canManage,
}: {
  product: ProductDetail
  ingredients: Ingredient[]
  canManage: boolean
}) {
  const router = useRouter()
  const { pending, error, run } = useActionForm(() => router.refresh())
  const [selected, setSelected] = useState<string[]>(
    () => product.ingredientExclusions.map((item) => item.ingredient.id)
  )

  function toggle(ingredientId: string) {
    setSelected((current) =>
      current.includes(ingredientId)
        ? current.filter((id) => id !== ingredientId)
        : [...current, ingredientId]
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ingredientes que se pueden quitar</CardTitle>
        <CardDescription>
          Aparecerán como exclusiones al tomar el pedido (por ejemplo, «sin
          cebolla»). No cambia la receta ni el consumo.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {ingredients.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Todavía no hay ingredientes.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {ingredients.map((ingredient) => (
              <label
                key={ingredient.id}
                className="flex items-center gap-2 rounded-md border p-2 text-sm"
              >
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={selected.includes(ingredient.id)}
                  disabled={!canManage || pending}
                  onChange={() => toggle(ingredient.id)}
                />
                <span className="truncate">{ingredient.name}</span>
              </label>
            ))}
          </div>
        )}

        {error ? <FieldError>{error}</FieldError> : null}

        {canManage ? (
          <div className="flex justify-end">
            <Button
              type="button"
              disabled={pending}
              onClick={() => run(() => replaceExclusions(product.id, selected))}
            >
              {pending ? <Loader2Icon className="animate-spin" /> : <SaveIcon />}
              Guardar exclusiones
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
