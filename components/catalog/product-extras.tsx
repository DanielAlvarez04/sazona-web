"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { Loader2Icon, PlusIcon, Trash2Icon } from "lucide-react"

import { createExtra, deactivateExtra } from "@/app/(app)/catalog/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useActionForm } from "@/hooks/use-action-form"
import {
  formatMoney,
  formatQuantity,
  UNIT_CODES,
  UNIT_LABELS,
  unitLabel,
  type Extra,
  type Ingredient,
  type ProductDetail,
} from "@/lib/catalog"

export function ProductExtras({
  product,
  ingredients,
  canManage,
}: {
  product: ProductDetail
  ingredients: Ingredient[]
  canManage: boolean
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Extras</CardTitle>
        <CardDescription>
          Añadidos con precio propio. Si registras su consumo, se descontará del
          inventario al preparar el pedido.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {product.extras.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Este producto no tiene extras.
          </p>
        ) : (
          product.extras.map((extra) => (
            <ExtraRow
              key={extra.id}
              productId={product.id}
              extra={extra}
              canManage={canManage}
            />
          ))
        )}

        {canManage ? (
          <ExtraCreateForm productId={product.id} ingredients={ingredients} />
        ) : null}
      </CardContent>
    </Card>
  )
}

function ExtraRow({
  productId,
  extra,
  canManage,
}: {
  productId: string
  extra: Extra
  canManage: boolean
}) {
  const router = useRouter()
  const { pending, error, run } = useActionForm(() => router.refresh())

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium">{extra.name}</p>
          <Badge variant="outline">+{formatMoney(extra.price)}</Badge>
          {extra.isActive ? null : <Badge variant="secondary">Inactivo</Badge>}
        </div>
        <p className="text-xs text-muted-foreground">
          {(extra.ingredients ?? []).length === 0
            ? "Sin consumo de inventario"
            : extra.ingredients
                ?.map(
                  (item) =>
                    `${formatQuantity(item.quantity)} ${unitLabel(
                      item.ingredient.displayUnit
                    )} de ${item.ingredient.name}`
                )
                .join(" · ")}
        </p>
        {error ? <FieldError>{error}</FieldError> : null}
      </div>

      {canManage && extra.isActive ? (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Desactivar ${extra.name}`}
          disabled={pending}
          onClick={() => {
            if (!window.confirm(`¿Desactivar el extra "${extra.name}"?`)) return
            run(() => deactivateExtra(productId, extra.id))
          }}
        >
          {pending ? <Loader2Icon className="animate-spin" /> : <Trash2Icon />}
        </Button>
      ) : null}
    </div>
  )
}

function ExtraCreateForm({
  productId,
  ingredients,
}: {
  productId: string
  ingredients: Ingredient[]
}) {
  const router = useRouter()
  const { pending, error, run } = useActionForm(() => router.refresh())
  const [ingredientId, setIngredientId] = useState("none")
  const [unit, setUnit] = useState("base")

  return (
    <form
      className="flex flex-col gap-3 rounded-md border border-dashed p-3"
      onSubmit={(event) => {
        event.preventDefault()
        const form = event.currentTarget
        const formData = new FormData(form)
        formData.set("ingredientId", ingredientId === "none" ? "" : ingredientId)
        formData.set("unit", unit === "base" ? "" : unit)

        run(async () => {
          const result = await createExtra(productId, formData)

          if (result.ok) {
            form.reset()
            setIngredientId("none")
            setUnit("base")
          }

          return result
        })
      }}
    >
      <p className="text-sm font-medium">Nuevo extra</p>
      <div className="grid gap-2 sm:grid-cols-3">
        <Field>
          <FieldLabel htmlFor="extra-name">Nombre</FieldLabel>
          <Input
            id="extra-name"
            name="name"
            required
            maxLength={80}
            placeholder="Shot extra"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="extra-price">Precio</FieldLabel>
          <Input
            id="extra-price"
            name="price"
            type="number"
            min="0"
           
            required
            placeholder="12.00"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="extra-ingredient">Ingrediente</FieldLabel>
          <Select
            value={ingredientId}
            onValueChange={(value) => setIngredientId(value ?? "none")}
            items={[
              { value: "none", label: "Sin consumo" },
              ...ingredients.map((ingredient) => ({
                value: ingredient.id,
                label: `${ingredient.name} (${UNIT_LABELS[ingredient.displayUnit]})`,
              })),
            ]}
          >
            <SelectTrigger
              id="extra-ingredient"
              className="w-full"
              aria-label="Ingrediente"
            >
              <SelectValue placeholder="Sin consumo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sin consumo</SelectItem>
              {ingredients.map((ingredient) => (
                <SelectItem key={ingredient.id} value={ingredient.id}>
                  {ingredient.name} ({UNIT_LABELS[ingredient.displayUnit]})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <Field>
          <FieldLabel htmlFor="extra-quantity">Cantidad</FieldLabel>
          <Input
            id="extra-quantity"
            name="quantity"
            type="number"
            min="0"
           
            placeholder="8"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="extra-unit">Unidad</FieldLabel>
          <Select
            value={unit}
            onValueChange={(value) => setUnit(value ?? "base")}
            items={[
              { value: "base", label: "Unidad base" },
              ...UNIT_CODES.map((code) => ({
                value: code,
                label: UNIT_LABELS[code],
              })),
            ]}
          >
            <SelectTrigger
              id="extra-unit"
              className="w-full"
              aria-label="Unidad"
            >
              <SelectValue placeholder="Unidad base" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="base">Unidad base</SelectItem>
              {UNIT_CODES.map((code) => (
                <SelectItem key={code} value={code}>
                  {UNIT_LABELS[code]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <div className="flex items-end">
          <Button type="submit" disabled={pending}>
            {pending ? <Loader2Icon className="animate-spin" /> : <PlusIcon />}
            Añadir extra
          </Button>
        </div>
      </div>

      {error ? <FieldError>{error}</FieldError> : null}
    </form>
  )
}
