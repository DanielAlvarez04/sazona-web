"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { Loader2Icon, SaveIcon } from "lucide-react"
import { toast } from "sonner"

import {
  createArticle,
  updateArticle,
  updateArticleImage,
  type ArticleInput,
} from "@/app/(app)/catalog/actions"
import { ImageDropzone } from "@/components/catalog/image-dropzone"
import {
  PresentationRows,
  defaultPresentationRows,
  nextPresentationKey,
  type PresentationRow,
} from "@/components/catalog/presentation-rows"
import { Button } from "@/components/ui/button"
import { ClearFieldsButton } from "@/components/ui/clear-fields-button"
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
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useActionForm } from "@/hooks/use-action-form"
import type { ArticleListItem, Category } from "@/lib/catalog"
import { uploadItemImage } from "@/lib/uploads"

/** Imagen del diálogo: la guardada en R2 o un archivo local sin subir. */
type DialogImage =
  | { kind: "existing"; key: string; url: string }
  | { kind: "pending"; file: File; url: string }

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function toNumber(value: string): number {
  return Number(value.replace(",", "."))
}

/** Presentaciones activas del artículo, con el precio ya en valor absoluto. */
function initialRows(article: ArticleListItem | null): PresentationRow[] {
  if (!article) return []

  const variants = article.variants.filter((variant) => variant.isActive)
  if (variants.length === 0) return []

  const base = toNumber(article.price)
  const explicitPrimary = variants.findIndex((variant) => variant.isPrimary)
  const primaryIndex = explicitPrimary >= 0 ? explicitPrimary : 0

  return variants.map((variant, index) => ({
    key: nextPresentationKey(),
    name: variant.name,
    // La principal toma siempre el precio del artículo; las demás lo guardan.
    price:
      index === primaryIndex
        ? ""
        : String(round2(base + toNumber(variant.priceAdjust))),
    isPrimary: index === primaryIndex,
    linkedName: false,
  }))
}

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
  const [categoryId, setCategoryId] = useState(article?.category?.id ?? "")
  const [price, setPrice] = useState(article?.price ?? "")
  const [image, setImage] = useState<DialogImage | null>(() =>
    article?.imageKey && article.imageUrl
      ? { kind: "existing", key: article.imageKey, url: article.imageUrl }
      : null
  )
  const [multiple, setMultiple] = useState(
    () => (article?.variants.filter((variant) => variant.isActive).length ?? 0) > 0
  )
  const [rows, setRows] = useState<PresentationRow[]>(() =>
    initialRows(article)
  )

  /** El nombre del artículo arrastra a las filas que no se editaron a mano. */
  function handleNameChange(value: string) {
    setName(value)
    setRows((current) =>
      current.map((row) =>
        row.linkedName ? { ...row, name: value } : row
      )
    )
  }

  /** Vista previa local: la imagen se sube a R2 al guardar el artículo. */
  function handleSelectImage(file: File) {
    setImage((current) => {
      if (current?.kind === "pending") URL.revokeObjectURL(current.url)
      return { kind: "pending", file, url: URL.createObjectURL(file) }
    })
  }

  function handleRemoveImage() {
    setImage((current) => {
      if (current?.kind === "pending") URL.revokeObjectURL(current.url)
      return null
    })
  }

  function handleMultipleChange(next: boolean) {
    if (!next && article?.variants.some((variant) => variant.isActive)) {
      if (
        !window.confirm(
          "Se desactivarán las presentaciones actuales del artículo. ¿Continuar?"
        )
      ) {
        return
      }
    }

    setMultiple(next)

    if (next && rows.length === 0) {
      setRows(defaultPresentationRows(name))
    }
  }

  function handleClear() {
    setName("")
    setDescription("")
    setCategoryId("")
    setPrice("")
    setImage(null)
    setMultiple(false)
    setRows([])
    form.setError(null)
  }

  function save() {
    const trimmedName = name.trim()

    if (!trimmedName) {
      form.setError("El nombre del artículo es obligatorio")
      return
    }

    const basePrice = toNumber(price)

    if (!Number.isFinite(basePrice) || basePrice < 0) {
      form.setError("Indica un precio válido")
      return
    }

    const variants: NonNullable<ArticleInput["variants"]> = []

    if (multiple) {
      if (rows.length === 0) {
        form.setError("Agrega al menos una presentación")
        return
      }

      const used = new Set<string>()

      for (const [index, row] of rows.entries()) {
        // Los campos vacíos se guardan con el nombre y el precio sugeridos.
        const rowName = row.name.trim() || `${trimmedName} #${index + 1}`
        const normalized = rowName.toLowerCase()

        if (used.has(normalized)) {
          form.setError(`La presentación "${rowName}" está repetida`)
          return
        }
        used.add(normalized)

        const rawPrice = row.isPrimary
          ? basePrice
          : row.price.trim()
            ? toNumber(row.price)
            : basePrice
        const rowPrice =
          Number.isFinite(rawPrice) && rawPrice >= 0 ? rawPrice : basePrice

        variants.push({
          name: rowName,
          // La API guarda el ajuste; el precio del artículo es la principal.
          priceAdjust: round2(rowPrice - basePrice),
          sortOrder: index,
          isPrimary: row.isPrimary,
        })
      }

      if (!variants.some((variant) => variant.isPrimary)) {
        variants[0].isPrimary = true
      }
    }

    const payload: ArticleInput = {
      name: trimmedName,
      description: description.trim() || null,
      categoryId: categoryId || null,
      price: basePrice,
      variants,
    }

    // Si se quitó la imagen guardada, se borra también del bucket.
    if (!image && article?.imageKey) {
      payload.imageKey = null
    }

    form.run(async () => {
      let itemId = article?.id

      if (article) {
        const updated = await updateArticle(article.id, payload)
        if (!updated.ok) return updated
      } else {
        const created = await createArticle(payload)
        if (!created.ok) return created
        itemId = created.data?.id
      }

      // La imagen se sube al guardar: el artículo ya tiene su carpeta en R2.
      if (image?.kind === "pending" && itemId) {
        const uploaded = await uploadItemImage(itemId, image.file)

        if (!uploaded.ok) {
          // El artículo ya quedó guardado: se avisa y se cierra el diálogo.
          toast.warning(
            uploaded.message ??
              "El artículo se guardó, pero la imagen no se pudo subir."
          )
          router.refresh()
          onOpenChange(false)
          return { ok: true }
        }

        const saved = await updateArticleImage(itemId, uploaded.key ?? null)
        if (!saved.ok) return saved
      }

      return { ok: true }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="no-scrollbar max-h-[90vh] overflow-y-auto sm:max-w-3xl">
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
          {/* Grupo superior: imagen a la izquierda; nombre, categoría y precio. */}
          <div className="grid gap-4 sm:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
            <ImageDropzone
              url={image?.url ?? null}
              onSelect={handleSelectImage}
              onRemove={handleRemoveImage}
              disabled={form.pending}
            />

            <div className="flex flex-col gap-3">
              <Field>
                <FieldLabel htmlFor="article-name">
                  Nombre <span className="text-destructive">*</span>
                </FieldLabel>
                <Input
                  id="article-name"
                  value={name}
                  maxLength={120}
                  onChange={(event) => handleNameChange(event.target.value)}
                  placeholder="Ej. Café americano"
                />
              </Field>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="article-category">Categoría</FieldLabel>
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
                    <SelectTrigger id="article-category" className="w-full">
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
                  <p className="text-xs text-muted-foreground">
                    El SKU se genera solo a partir de la categoría.
                  </p>
                </Field>

                <Field>
                  <FieldLabel htmlFor="article-price">
                    Precio <span className="text-destructive">*</span>
                  </FieldLabel>
                  <InputGroup>
                    <InputGroupAddon align="inline-start">
                      <InputGroupText>$</InputGroupText>
                    </InputGroupAddon>
                    <InputGroupInput
                      id="article-price"
                      type="number"
                      min="0"
                      step="0.01"
                      value={price}
                      onChange={(event) => setPrice(event.target.value)}
                      placeholder="0.00"
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupText>MXN</InputGroupText>
                    </InputGroupAddon>
                  </InputGroup>
                  <p className="text-xs text-muted-foreground">
                    {multiple
                      ? "Es el precio de la presentación principal."
                      : "Precio final con IVA incluido."}
                  </p>
                </Field>
              </div>
            </div>
          </div>

          <Field>
            <FieldLabel htmlFor="article-description">Descripción</FieldLabel>
            <Textarea
              id="article-description"
              value={description}
              maxLength={500}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Descripción para el menú"
            />
          </Field>

          <Separator />

          <section className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <Label htmlFor="article-multiple" className="text-sm font-medium">
                  Múltiples presentaciones
                </Label>
                <p className="text-xs text-muted-foreground">
                  Crea más presentaciones y elige cuál es la principal. Si no
                  indicas un precio propio, cada presentación conserva el de la
                  principal.
                </p>
              </div>
              <Switch
                id="article-multiple"
                checked={multiple}
                disabled={form.pending}
                onCheckedChange={handleMultipleChange}
              />
            </div>

            {multiple ? (
              <PresentationRows
                rows={rows}
                onChange={setRows}
                articleName={name}
                articlePrice={price}
                onArticlePriceChange={setPrice}
                disabled={form.pending}
              />
            ) : null}
          </section>

          {form.error ? <FieldError>{form.error}</FieldError> : null}
        </div>

        <DialogFooter>
          {!article ? (
            <ClearFieldsButton
              onClick={handleClear}
              disabled={form.pending}
              className="sm:mr-auto"
            />
          ) : null}
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
