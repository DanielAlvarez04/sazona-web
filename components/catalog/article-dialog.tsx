"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { Loader2Icon, SaveIcon } from "lucide-react"
import { toast } from "sonner"

import {
  createArticle,
  updateArticle,
  type ArticleInput,
} from "@/app/(app)/catalog/actions"
import {
  PresentationEditor,
  defaultPresentationRows,
  nextPresentationKey,
  type PresentationRow,
} from "@/components/catalog/presentation-editor"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
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
import type { ArticleListItem, Category } from "@/lib/catalog"

export function ArticleDialog({
  open,
  onOpenChange,
  article,
  categories,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  article: ArticleListItem | null
  categories: Category[]
}) {
  const router = useRouter()
  const form = useActionForm(() => {
    toast.success(article ? "Artículo actualizado" : "Artículo creado")
    router.refresh()
    onOpenChange(false)
  })

  const [name, setName] = useState(article?.name ?? "")
  const [description, setDescription] = useState(article?.description ?? "")
  const [sku, setSku] = useState(article?.sku ?? "")
  const [categoryId, setCategoryId] = useState(article?.category?.id ?? "")
  const [price, setPrice] = useState(article?.price ?? "")
  const [taxRate, setTaxRate] = useState(article?.taxRate ?? "")
  const [presentations, setPresentations] = useState<PresentationRow[]>(() =>
    article
      ? article.variants.map((variant) => ({
          key: nextPresentationKey(),
          name: variant.name,
          priceAdjust: variant.priceAdjust,
          recipeFactor: variant.recipeFactor,
        }))
      : defaultPresentationRows()
  )

  const linkedRecipes = article?.recipes ?? []

  function save() {
    if (!name.trim()) {
      form.setError("El nombre del artículo es obligatorio")
      return
    }

    const value = Number(price.replace(",", "."))

    if (!Number.isFinite(value) || value < 0) {
      form.setError("Indica un precio válido")
      return
    }

    const payload: ArticleInput = {
      name: name.trim(),
      description: description.trim() || null,
      sku: sku.trim() || null,
      categoryId: categoryId || null,
      price: value,
      taxRate: taxRate.trim() ? Number(taxRate.replace(",", ".")) : null,
      variants: presentations
        .filter((row) => row.name.trim())
        .map((row, index) => ({
          name: row.name.trim(),
          priceAdjust: Number(row.priceAdjust.replace(",", ".")) || 0,
          recipeFactor: Number(row.recipeFactor.replace(",", ".")) || 1,
          sortOrder: index,
        })),
    }

    form.run(() =>
      article ? updateArticle(article.id, payload) : createArticle(payload)
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {article ? "Editar artículo" : "Nuevo artículo"}
          </DialogTitle>
          <DialogDescription>
            Los artículos se venden en el punto de venta y podrán usarse en
            menús. Crearlos aquí no modifica el inventario.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="article-name">Nombre</FieldLabel>
              <Input
                id="article-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ej. Café americano"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="article-sku">SKU</FieldLabel>
              <Input
                id="article-sku"
                value={sku}
                onChange={(event) => setSku(event.target.value)}
                placeholder="Opcional"
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field>
              <FieldLabel>Categoría</FieldLabel>
              <Select
                value={categoryId || "none"}
                onValueChange={(value) =>
                  setCategoryId(value === "none" ? "" : (value ?? ""))
                }
                items={[
                  { value: "none", label: "Sin categoría" },
                  ...categories.map((category) => ({
                    value: category.id,
                    label: category.name,
                  })),
                ]}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sin categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin categoría</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="article-price">Precio</FieldLabel>
              <Input
                id="article-price"
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                placeholder="0.00"
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="article-tax">IVA (fracción)</FieldLabel>
              <Input
                id="article-tax"
                type="number"
                min="0"
                max="1"
                step="0.01"
                value={taxRate}
                onChange={(event) => setTaxRate(event.target.value)}
                placeholder="0.16"
              />
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="article-description">Descripción</FieldLabel>
            <Textarea
              id="article-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Descripción para el menú"
            />
          </Field>

          <section className="flex flex-col gap-3 rounded-lg border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-medium">Presentaciones</h3>
                <p className="text-xs text-muted-foreground">
                  Chico, Regular y Grande son sugerencias. El factor escala el
                  consumo de la receta; Regular es la base.
                </p>
              </div>
              {linkedRecipes.length > 0 ? (
                <Badge variant="secondary">
                  {linkedRecipes.length} receta(s) vinculada(s)
                </Badge>
              ) : (
                <Badge variant="outline">Sin receta</Badge>
              )}
            </div>
            <PresentationEditor
              rows={presentations}
              onChange={setPresentations}
            />
          </section>

          {form.error ? <FieldError>{form.error}</FieldError> : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={form.pending}
          >
            Cancelar
          </Button>
          <Button type="button" onClick={save} disabled={form.pending}>
            {form.pending ? <Loader2Icon className="animate-spin" /> : <SaveIcon />}
            {article ? "Guardar artículo" : "Crear artículo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
