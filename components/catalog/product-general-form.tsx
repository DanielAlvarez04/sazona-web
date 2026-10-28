"use client"

import { useRouter } from "next/navigation"
import { Loader2Icon, SaveIcon } from "lucide-react"

import { updateProduct } from "@/app/(app)/catalog/actions"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useActionForm } from "@/hooks/use-action-form"
import type { Category, ProductDetail } from "@/lib/catalog"

export function ProductGeneralForm({
  product,
  categories,
  canManage,
}: {
  product: ProductDetail
  categories: Category[]
  canManage: boolean
}) {
  const router = useRouter()
  const { pending, error, run } = useActionForm(() => router.refresh())

  return (
    <Card>
      <CardHeader>
        <CardTitle>Datos generales</CardTitle>
        <CardDescription>
          El precio es final con IVA incluido. Si la tasa queda vacía no se
          asume ningún IVA.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            const formData = new FormData(event.currentTarget)

            // El Select usa "none" porque un valor vacío se interpreta como
            // "sin selección" y no muestra la etiqueta.
            if (formData.get("categoryId") === "none") {
              formData.set("categoryId", "")
            }

            run(() => updateProduct(product.id, formData))
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="detail-name">Nombre</FieldLabel>
              <Input
                id="detail-name"
                name="name"
                defaultValue={product.name}
                required
                maxLength={120}
                disabled={!canManage}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="detail-sku">SKU</FieldLabel>
              <Input
                id="detail-sku"
                name="sku"
                defaultValue={product.sku ?? ""}
                maxLength={60}
                disabled={!canManage}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="detail-category">Categoría</FieldLabel>
              <Select
                name="categoryId"
                defaultValue={product.category?.id ?? "none"}
                disabled={!canManage}
                items={[
                  { value: "none", label: "Sin categoría" },
                  ...categories.map((category) => ({
                    value: category.id,
                    label: `${category.name}${category.isActive ? "" : " (inactiva)"}`,
                  })),
                ]}
              >
                <SelectTrigger
                  id="detail-category"
                  className="w-full"
                  aria-label="Categoría"
                >
                  <SelectValue placeholder="Sin categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin categoría</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                      {category.isActive ? "" : " (inactiva)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="detail-price">Precio (IVA incl.)</FieldLabel>
              <Input
                id="detail-price"
                name="price"
                type="number"
                min="0"
               
                defaultValue={product.price}
                required
                disabled={!canManage}
              />
              <FieldDescription>
                El IVA se toma de Ajustes → Personalización.
              </FieldDescription>
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="detail-description">Descripción</FieldLabel>
            <Textarea
              id="detail-description"
              name="description"
              rows={3}
              maxLength={500}
              defaultValue={product.description ?? ""}
              disabled={!canManage}
            />
          </Field>

          <div className="flex flex-wrap gap-5">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked={product.isActive}
                disabled={!canManage}
                className="size-4 accent-primary"
              />
              Activo
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="isCombo"
                defaultChecked={product.isCombo}
                disabled={!canManage}
                className="size-4 accent-primary"
              />
              Es combo
            </label>
          </div>

          {error ? <FieldError>{error}</FieldError> : null}

          {canManage ? (
            <div>
              <Button type="submit" disabled={pending}>
                {pending ? (
                  <Loader2Icon className="animate-spin" />
                ) : (
                  <SaveIcon />
                )}
                Guardar cambios
              </Button>
            </div>
          ) : null}
        </form>
      </CardContent>
    </Card>
  )
}
