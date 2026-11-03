"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { Loader2Icon, SaveIcon, TriangleAlertIcon } from "lucide-react"
import { toast } from "sonner"

import {
  createArticle,
  updateArticle,
  updateArticleImage,
  type ArticleInput,
} from "@/app/(app)/catalog/actions"
import { ImageDropzone } from "@/components/catalog/image-dropzone"
import {
  OptionGroupsEditor,
  optionGroupDrafts,
  optionGroupPayload,
  optionGroupsSignature,
  type OptionGroupDraft,
} from "@/components/catalog/option-groups-editor"
import {
  PresentationRows,
  defaultPresentationRows,
  nextPresentationKey,
  type PresentationRow,
} from "@/components/catalog/presentation-rows"
import { InfoHint } from "@/components/info-hint"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useActionForm } from "@/hooks/use-action-form"
import { isNoPriceOptionGroup } from "@/lib/catalog"
import type {
  ArticleListItem,
  Category,
  OptionGroup,
  OptionGroupPreset,
} from "@/lib/catalog"
import { isEmptyPatch, sameNumber, sameText } from "@/lib/diff"
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

/** Compara las presentaciones del formulario con las activas del artículo. */
function variantsChanged(
  article: ArticleListItem,
  variants: NonNullable<ArticleInput["variants"]>
): boolean {
  const current = article.variants.filter((variant) => variant.isActive)

  if (current.length !== variants.length) return true

  return variants.some((variant, index) => {
    const existing = current[index]

    return (
      !sameText(existing.name, variant.name) ||
      !sameNumber(existing.priceAdjust, variant.priceAdjust ?? 0) ||
      existing.isPrimary !== Boolean(variant.isPrimary)
    )
  })
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
  optionGroups,
  optionPresets,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  article: ArticleListItem | null
  categories: Category[]
  optionGroups: OptionGroup[]
  optionPresets: OptionGroupPreset[]
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
  const [groups, setGroups] = useState<OptionGroupDraft[]>(() =>
    optionGroupDrafts(article?.optionGroups)
  )
  const [optionsEnabled, setOptionsEnabled] = useState(
    () => (article?.optionGroups?.length ?? 0) > 0
  )
  // Confirmación al apagar «Múltiples presentaciones» de un artículo guardado.
  const [confirmDisableVariants, setConfirmDisableVariants] = useState(false)
  // Confirmación al apagar las opciones de un artículo ya guardado.
  const [confirmDisableOptions, setConfirmDisableOptions] = useState(false)

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

  /** Aplica el cambio del interruptor (sin volver a pedir confirmación). */
  function applyMultipleChange(next: boolean) {
    setMultiple(next)

    if (next && rows.length === 0) {
      setRows(defaultPresentationRows(name))
    }
  }

  function handleMultipleChange(next: boolean) {
    if (!next && article?.variants.some((variant) => variant.isActive)) {
      setConfirmDisableVariants(true)
      return
    }

    applyMultipleChange(next)
  }

  /** Apagar las opciones no borra el borrador: solo lo excluye al guardar. */
  function handleOptionsChange(next: boolean) {
    if (!next && (article?.optionGroups?.length ?? 0) > 0) {
      setConfirmDisableOptions(true)
      return
    }

    setOptionsEnabled(next)
  }

  function handleClear() {
    setName("")
    setDescription("")
    setCategoryId("")
    setPrice("")
    setImage(null)
    setMultiple(false)
    setRows([])
    setGroups([])
    setOptionsEnabled(false)
    form.setError(null)
  }

  function save() {
    const trimmedName = name.trim()

    if (!trimmedName) {
      form.setError("El nombre del artículo es obligatorio")
      return
    }

    if (!categoryId) {
      form.setError("La categoría es obligatoria")
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

    const activeGroups = optionsEnabled ? groups : []

    for (const group of activeGroups) {
      if (group.values.length === 0) {
        form.setError(`El grupo «${group.groupName}» no tiene opciones`)
        return
      }

      if (group.isRequired && !group.values.some((item) => item.isActive)) {
        form.setError(
          `El grupo obligatorio «${group.groupName}» necesita al menos una opción disponible`
        )
        return
      }

      for (const item of group.values) {
        if (!item.isActive || isNoPriceOptionGroup(group.groupName)) continue

        const delta = Number(item.priceDelta)
        if (!Number.isFinite(delta) || delta < 0) {
          form.setError(`Revisa el cargo de «${item.name}»`)
          return
        }
      }
    }

    const groupsChanged = optionsEnabled
      ? article
        ? optionGroupsSignature(groups) !==
          optionGroupsSignature(optionGroupDrafts(article.optionGroups))
        : groups.length > 0
      : (article?.optionGroups?.length ?? 0) > 0

    const payload: ArticleInput = {
      name: trimmedName,
      description: description.trim() || null,
      categoryId,
      price: basePrice,
      variants,
      ...(optionsEnabled && groups.length > 0
        ? { optionGroups: optionGroupPayload(groups) }
        : {}),
    }

    const imagePending = image?.kind === "pending"
    // Si se quitó la imagen guardada, se borra también del bucket.
    const imageRemoved = !image && Boolean(article?.imageKey)

    // En edición solo se envían los campos que realmente cambiaron.
    const changes: Partial<ArticleInput> = article
      ? {
          ...(sameText(article.name, trimmedName) ? {} : { name: trimmedName }),
          ...(sameText(article.description, payload.description)
            ? {}
            : { description: payload.description }),
          ...((article.category?.id ?? null) === categoryId
            ? {}
            : { categoryId }),
          ...(sameNumber(article.price, basePrice) ? {} : { price: basePrice }),
          ...(variantsChanged(article, variants) ? { variants } : {}),
          ...(groupsChanged
            ? { optionGroups: optionGroupPayload(activeGroups) }
            : {}),
          ...(imageRemoved ? { imageKey: null } : {}),
        }
      : payload

    if (article && isEmptyPatch(changes) && !imagePending) {
      toast.info("Sin cambios")
      onOpenChange(false)
      return
    }

    form.run(async () => {
      let itemId = article?.id

      if (article) {
        if (!isEmptyPatch(changes)) {
          const updated = await updateArticle(article.id, changes)
          if (!updated.ok) return updated
        }
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
          {/* Grupo superior: imagen a la izquierda; nombre, precio y categoría. */}
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
                  <div className="flex items-center gap-1.5">
                    <FieldLabel htmlFor="article-price">
                      Precio <span className="text-destructive">*</span>
                    </FieldLabel>
                    <InfoHint text="Precio final con IVA incluido. Con varias presentaciones, es el de la presentación principal." />
                  </div>
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
                </Field>

                <Field>
                  <FieldLabel htmlFor="article-category">
                    Categoría <span className="text-destructive">*</span>
                  </FieldLabel>
                  <Select
                    value={categoryId}
                    onValueChange={(value) => setCategoryId(value ?? "")}
                    items={categories.map((category) => ({
                      value: category.id,
                      label: category.name,
                    }))}
                  >
                    <SelectTrigger id="article-category" className="w-full">
                      <SelectValue placeholder="Selecciona una categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
            <p className="text-xs text-muted-foreground">
              El SKU se genera solo a partir de la categoría.
            </p>
          </Field>

          <Separator />

          <Tabs defaultValue="opciones" className="gap-4">
            <TabsList>
              <TabsTrigger type="button" value="opciones">
                Opciones
              </TabsTrigger>
              <TabsTrigger type="button" value="presentaciones">
                Presentaciones
              </TabsTrigger>
            </TabsList>

            <TabsContent value="opciones" keepMounted>
              <section className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <Label
                      htmlFor="article-options"
                      className="text-sm font-medium"
                    >
                      Opciones del artículo
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Grupos como salsa, proteína, leche o extras. Marca las
                      opciones que podrá elegir el mesero en la comanda; activa
                      «Múltiples opciones» si puede elegir más de una.
                    </p>
                  </div>
                  <Switch
                    id="article-options"
                    checked={optionsEnabled}
                    disabled={form.pending}
                    onCheckedChange={handleOptionsChange}
                  />
                </div>

                <OptionGroupsEditor
                  library={optionGroups}
                  presets={optionPresets}
                  value={groups}
                  onChange={setGroups}
                  disabled={form.pending}
                  hideHeader
                  suggestionsOnly={!optionsEnabled}
                  onGroupAdded={() => setOptionsEnabled(true)}
                />
              </section>
            </TabsContent>

            <TabsContent value="presentaciones" keepMounted>
              <section className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <Label
                      htmlFor="article-multiple"
                      className="text-sm font-medium"
                    >
                      Múltiples presentaciones
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Crea más presentaciones y elige cuál es la principal. Si no
                      indicas un precio propio, cada presentación conserva el de
                      la principal.
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
            </TabsContent>
          </Tabs>

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

        <AlertDialog
          open={confirmDisableVariants}
          onOpenChange={setConfirmDisableVariants}
        >
          <AlertDialogContent size="sm">
            <AlertDialogHeader>
              <AlertDialogMedia className="bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive">
                <TriangleAlertIcon />
              </AlertDialogMedia>
              <AlertDialogTitle>Desactivar presentaciones</AlertDialogTitle>
              <AlertDialogDescription>
                Se desactivarán las presentaciones actuales del artículo.
                ¿Continuar?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => applyMultipleChange(false)}
              >
                Desactivar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog
          open={confirmDisableOptions}
          onOpenChange={setConfirmDisableOptions}
        >
          <AlertDialogContent size="sm">
            <AlertDialogHeader>
              <AlertDialogMedia className="bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive">
                <TriangleAlertIcon />
              </AlertDialogMedia>
              <AlertDialogTitle>Desactivar opciones</AlertDialogTitle>
              <AlertDialogDescription>
                Se quitarán los grupos configurados de este artículo. Los grupos
                de la biblioteca no se borran. ¿Continuar?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => setOptionsEnabled(false)}
              >
                Desactivar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  )
}
