"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  GroupIcon,
  Loader2Icon,
  PencilIcon,
  PlusIcon,
  SaveIcon,
  Trash2Icon,
} from "lucide-react"
import { toast } from "sonner"

import {
  createArticle,
  replaceComboComponents,
  updateArticle,
  type ArticleInput,
  type ComboPromotionInput,
} from "@/app/(app)/catalog/actions"
import {
  OptionGroupsEditor,
  optionGroupDrafts,
  optionGroupPayload,
  optionGroupsSignature,
  type OptionGroupDraft,
} from "@/components/catalog/option-groups-editor"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,  DialogContent,
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
import {
  formatMoney,
  PROMOTION_TYPE_LABELS,
  type ArticleListItem,
  type Category,
  type ItemListItem,
  type OptionGroup,
  type OptionGroupPreset,
  type PromotionType,
} from "@/lib/catalog"

const DAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]

interface ComponentRow {
  key: string
  itemId: string
  variantId: string
  quantity: string
}

interface PromotionRow {
  key: string
  name: string
  type: PromotionType
  value: string
  daysOfWeek: number[]
  startTime: string
  endTime: string
  isActive: boolean
}

let rowCounter = 0

function nextKey(prefix: string) {
  rowCounter += 1
  return `${prefix}-${rowCounter}`
}

function componentRows(combo: ArticleListItem | null): ComponentRow[] {
  return (combo?.comboComponents ?? []).map((component) => ({
    key: nextKey("component"),
    itemId: component.componentItem.id,
    variantId: component.variant?.id ?? "",
    quantity: String(component.quantity),
  }))
}

function promotionRows(combo: ArticleListItem | null): PromotionRow[] {
  return (combo?.promotions ?? []).map((promotion) => ({
    key: nextKey("promotion"),
    name: promotion.name,
    type: promotion.type,
    value: String(Number(promotion.value)),
    daysOfWeek: promotion.daysOfWeek ?? [],
    startTime: promotion.startTime ?? "",
    endTime: promotion.endTime ?? "",
    isActive: promotion.isActive,
  }))
}

function promotionPayload(rows: PromotionRow[]): ComboPromotionInput[] {
  return rows.map((row) => ({
    name: row.name.trim(),
    type: row.type,
    value: row.type === "BOGO" ? 0 : Number(row.value) || 0,
    daysOfWeek: [...row.daysOfWeek].sort((left, right) => left - right),
    startTime: row.startTime || null,
    endTime: row.endTime || null,
    isActive: row.isActive,
  }))
}

function promotionSignature(rows: PromotionRow[]): string {
  return JSON.stringify(promotionPayload(rows))
}

export function CombosPanel({
  combos,
  products,
  categories,
  optionGroups,
  optionPresets,
  canManage,
  onActivate,
  onDeactivate,
  onDelete,
}: {
  combos: ArticleListItem[]
  products: ItemListItem[]
  categories: Category[]
  optionGroups: OptionGroup[]
  optionPresets: OptionGroupPreset[]
  canManage: boolean
  onActivate: (combo: ArticleListItem) => Promise<boolean>
  onDeactivate: (combo: ArticleListItem) => Promise<boolean>
  onDelete: (combos: ArticleListItem[]) => Promise<boolean>
}) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ArticleListItem | null>(null)

  function openNew() {
    setEditing(null)
    setDialogOpen(true)
  }

  function openEdit(combo: ArticleListItem) {
    setEditing(combo)
    setDialogOpen(true)
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="gap-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <GroupIcon className="size-4" />
                Combos
              </CardTitle>
              <CardDescription>
                Paquetes de artículos con precio propio, opciones y promociones
                (descuentos, 2x1 u horarios). No consumen inventario por sí
                mismos: lo que consuman sus componentes.
              </CardDescription>
            </div>
            {canManage ? (
              <Button type="button" onClick={openNew}>
                <PlusIcon />
                Nuevo combo
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {combos.length === 0 ? (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Todavía no hay combos. Crea uno seleccionando artículos y fijando
              su precio.
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {combos.map((combo) => {
                const components = combo.comboComponents ?? []
                const componentValue = components.reduce((sum, component) => {
                  const unit =
                    Number(component.componentItem.price) +
                    Number(
                      products
                        .find(
                          (product) =>
                            product.id === component.componentItem.id
                        )
                        ?.variants.find(
                          (variant) => variant.id === component.variant?.id
                        )?.priceAdjust ?? 0
                    )
                  return sum + unit * component.quantity
                }, 0)

                return (
                  <div
                    key={combo.id}
                    className="flex flex-col gap-2 rounded-xl border p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{combo.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {components.length} componente
                          {components.length === 1 ? "" : "s"} ·{" "}
                          {combo.category?.name ?? "Sin categoría"}
                        </p>
                      </div>
                      <Badge variant={combo.isActive ? "secondary" : "outline"}>
                        {combo.isActive ? "Activo" : "Inactivo"}
                      </Badge>
                    </div>

                    <div className="flex items-end justify-between gap-2">
                      <div>
                        <p className="text-lg font-semibold tabular-nums">
                          {formatMoney(combo.price)}
                        </p>
                        {componentValue > 0 ? (
                          <p className="text-xs text-muted-foreground">
                            Componentes: {formatMoney(componentValue)} ·{" "}
                            {componentValue - Number(combo.price) >= 0
                              ? `ahorro ${formatMoney(
                                  componentValue - Number(combo.price)
                                )}`
                              : `cargo ${formatMoney(
                                  Number(combo.price) - componentValue
                                )}`}
                          </p>
                        ) : null}
                      </div>
                      {(combo.promotions ?? []).length > 0 ? (
                        <Badge variant="outline">
                          {(combo.promotions ?? []).length} promoción
                          {(combo.promotions ?? []).length === 1 ? "" : "es"}
                        </Badge>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
                      {components.slice(0, 3).map((component) => (
                        <span
                          key={component.id}
                          className="rounded-md bg-muted px-1.5 py-0.5"
                        >
                          {component.quantity}× {component.componentItem.name}
                        </span>
                      ))}
                      {components.length > 3 ? (
                        <span>+{components.length - 3}</span>
                      ) : null}
                    </div>

                    {canManage ? (
                      <div className="mt-auto flex flex-wrap gap-2 pt-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openEdit(combo)}
                        >
                          <PencilIcon />
                          Editar
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            combo.isActive
                              ? void onDeactivate(combo)
                              : void onActivate(combo)
                          }
                        >
                          {combo.isActive ? "Desactivar" : "Activar"}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => void onDelete([combo])}
                        >
                          <Trash2Icon />
                        </Button>
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {dialogOpen && canManage ? (
        <ComboDialog
          combo={editing}
          products={products}
          categories={categories}
          optionGroups={optionGroups}
          optionPresets={optionPresets}
          onClose={() => setDialogOpen(false)}
        />
      ) : null}
    </div>
  )
}

function ComboDialog({
  combo,
  products,
  categories,
  optionGroups,
  optionPresets,
  onClose,
}: {
  combo: ArticleListItem | null
  products: ItemListItem[]
  categories: Category[]
  optionGroups: OptionGroup[]
  optionPresets: OptionGroupPreset[]
  onClose: () => void
}) {
  const router = useRouter()
  const form = useActionForm(() => {
    toast.success(combo ? "Combo actualizado" : "Combo creado")
    router.refresh()
    onClose()
  })

  const [name, setName] = useState(combo?.name ?? "")
  const [description, setDescription] = useState(combo?.description ?? "")
  const [categoryId, setCategoryId] = useState(combo?.category?.id ?? "")
  const [price, setPrice] = useState(combo ? String(Number(combo.price)) : "")
  const [components, setComponents] = useState<ComponentRow[]>(() =>
    componentRows(combo)
  )
  const [promotions, setPromotions] = useState<PromotionRow[]>(() =>
    promotionRows(combo)
  )
  const [groups, setGroups] = useState<OptionGroupDraft[]>(() =>
    optionGroupDrafts(combo?.optionGroups)
  )

  const availableProducts = products.filter(
    (product) =>
      !product.isCombo &&
      (product.isActive ||
        components.some((row) => row.itemId === product.id))
  )

  const componentValue = components.reduce((sum, row) => {
    const product = products.find((candidate) => candidate.id === row.itemId)
    if (!product) return sum
    const variant = product.variants.find(
      (candidate) => candidate.id === row.variantId
    )
    return (
      sum +
      (Number(product.price) + Number(variant?.priceAdjust ?? 0)) *
        Math.max(1, Math.trunc(Number(row.quantity) || 1))
    )
  }, 0)

  function updateComponent(key: string, changes: Partial<ComponentRow>) {
    setComponents((current) =>
      current.map((row) => (row.key === key ? { ...row, ...changes } : row))
    )
  }

  function updatePromotion(key: string, changes: Partial<PromotionRow>) {
    setPromotions((current) =>
      current.map((row) => (row.key === key ? { ...row, ...changes } : row))
    )
  }

  function save() {
    const trimmedName = name.trim()
    const numericPrice = Number(price.replace(",", "."))

    if (!trimmedName) {
      form.setError("El nombre del combo es obligatorio")
      return
    }
    if (!categoryId) {
      form.setError("La categoría es obligatoria")
      return
    }
    if (!Number.isFinite(numericPrice) || numericPrice < 0) {
      form.setError("Indica un precio válido")
      return
    }

    const nextComponents = components
      .filter((row) => row.itemId)
      .map((row) => ({
        itemId: row.itemId,
        ...(row.variantId ? { variantId: row.variantId } : {}),
        quantity: Math.max(1, Math.trunc(Number(row.quantity) || 1)),
      }))

    if (nextComponents.length === 0) {
      form.setError("El combo debe tener al menos un artículo")
      return
    }

    const unique = new Set(
      nextComponents.map(
        (component) => `${component.itemId}:${component.variantId ?? ""}`
      )
    )
    if (unique.size !== nextComponents.length) {
      form.setError("Cada artículo o variante solo puede aparecer una vez")
      return
    }

    const nextPromotions = promotionPayload(promotions)
    for (const promotion of nextPromotions) {
      if (!promotion.name) {
        form.setError("Cada promoción necesita un nombre")
        return
      }
      if (
        promotion.type === "PERCENT" &&
        (promotion.value ?? 0) > 100
      ) {
        form.setError("El descuento no puede superar 100 %")
        return
      }
      if (
        (promotion.startTime && !promotion.endTime) ||
        (!promotion.startTime && promotion.endTime)
      ) {
        form.setError("Indica la hora de inicio y de fin de la promoción")
        return
      }
    }

    form.run(async () => {
      for (const group of groups) {
        if (
          group.isRequired &&
          group.values.length > 0 &&
          !group.values.some((value) => value.isActive)
        ) {
          return {
            ok: false,
            message: `El grupo obligatorio «${group.groupName}» necesita al menos una opción disponible`,
          }
        }
      }

      // Los grupos y sus opciones ya se guardaron en la biblioteca al crearlos.
      const savedGroups = groups

      const base: ArticleInput = {
        name: trimmedName,
        description: description.trim() || null,
        categoryId,
        price: numericPrice,
        isCombo: true,
        ...(savedGroups.length > 0
          ? { optionGroups: optionGroupPayload(savedGroups) }
          : {}),
      }

      if (!combo) {
        return createArticle({
          ...base,
          comboComponents: nextComponents,
          promotions: nextPromotions,
        })
      }

      const changes: Partial<ArticleInput> = {
        ...(combo.name === trimmedName ? {} : { name: trimmedName }),
        ...((combo.description ?? "") === (base.description ?? "")
          ? {}
          : { description: base.description }),
        ...((combo.category?.id ?? "") === categoryId ? {} : { categoryId }),
        ...(Number(combo.price) === numericPrice ? {} : { price: numericPrice }),
        ...(optionGroupsSignature(savedGroups) ===
        optionGroupsSignature(optionGroupDrafts(combo.optionGroups))
          ? {}
          : { optionGroups: optionGroupPayload(savedGroups) }),
        ...(promotionSignature(promotions) ===
        promotionSignature(promotionRows(combo))
          ? {}
          : { promotions: nextPromotions }),
      }

      const currentComponents = (combo.comboComponents ?? []).map((component) => ({
        itemId: component.componentItem.id,
        variantId: component.variant?.id ?? "",
        quantity: component.quantity,
      }))
      const key = (row: { itemId: string; variantId?: string }) =>
        `${row.itemId}:${row.variantId ?? ""}`
      const componentsChanged =
        currentComponents.length !== nextComponents.length ||
        currentComponents.some((row) => {
          const next = nextComponents.find(
            (candidate) => key(candidate) === key(row)
          )
          return next?.quantity !== row.quantity
        })

      if (Object.keys(changes).length === 0 && !componentsChanged) {
        toast.info("Sin cambios")
        onClose()
        return { ok: true }
      }

      if (Object.keys(changes).length > 0) {
        const updated = await updateArticle(combo.id, changes)
        if (!updated.ok) return updated
      }

      if (componentsChanged) {
        const replaced = await replaceComboComponents(
          combo.id,
          nextComponents
        )
        if (!replaced.ok) return replaced
      }

      return { ok: true }
    })
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-hidden p-0! sm:max-w-3xl">
        <div className="scroll-fade-y no-scrollbar max-h-[90vh] overflow-y-auto p-6">
          <div className="grid gap-6">
        <DialogHeader>
          <DialogTitle>{combo ? "Editar combo" : "Nuevo combo"}</DialogTitle>
          <DialogDescription>
            Elige los artículos que incluye, fija un precio propio y añade
            promociones. Los componentes conservan su consumo de inventario.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="combo-name">
                Nombre <span className="text-destructive">*</span>
              </FieldLabel>
              <Input
                id="combo-name"
                value={name}
                maxLength={120}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ej. Combo desayuno"
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="combo-category">
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
                <SelectTrigger id="combo-category" className="w-full">
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

          <div className="grid gap-3 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="combo-price">
                Precio del combo <span className="text-destructive">*</span>
              </FieldLabel>
              <InputGroup>
                <InputGroupAddon align="inline-start">
                  <InputGroupText>$</InputGroupText>
                </InputGroupAddon>
                <InputGroupInput
                  id="combo-price"
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
                Componentes: {formatMoney(componentValue)}. El precio puede ser
                menor (ahorro) o mayor que la suma.
              </p>
            </Field>

            <Field>
              <FieldLabel htmlFor="combo-description">Descripción</FieldLabel>
              <Textarea
                id="combo-description"
                value={description}
                maxLength={500}
                rows={2}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Qué incluye el combo"
              />
            </Field>
          </div>

          <Separator />

          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Componentes</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setComponents((current) => [
                    ...current,
                    {
                      key: nextKey("component"),
                      itemId: "",
                      variantId: "",
                      quantity: "1",
                    },
                  ])
                }
              >
                <PlusIcon />
                Añadir artículo
              </Button>
            </div>

            {components.length === 0 ? (
              <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                Añade al menos un artículo.
              </p>
            ) : null}

            {components.map((row) => {
              const product = products.find(
                (candidate) => candidate.id === row.itemId
              )
              const variants = (product?.variants ?? []).filter(
                (variant) =>
                  variant.isActive || variant.id === row.variantId
              )

              return (
                <div
                  key={row.key}
                  className="grid gap-2 rounded-md border p-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_5rem_auto]"
                >
                  <Select
                    value={row.itemId || "none"}
                    onValueChange={(value) =>
                      updateComponent(row.key, {
                        itemId: value === "none" ? "" : (value ?? ""),
                        variantId: "",
                      })
                    }
                    items={[
                      { value: "none", label: "Elige un artículo" },
                      ...availableProducts.map((candidate) => ({
                        value: candidate.id,
                        label: candidate.name,
                      })),
                    ]}
                  >
                    <SelectTrigger className="w-full" aria-label="Artículo">
                      <SelectValue placeholder="Elige un artículo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Elige un artículo</SelectItem>
                      {availableProducts.map((candidate) => (
                        <SelectItem key={candidate.id} value={candidate.id}>
                          {candidate.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={row.variantId || "none"}
                    disabled={!product || variants.length === 0}
                    onValueChange={(value) =>
                      updateComponent(row.key, {
                        variantId: value === "none" ? "" : (value ?? ""),
                      })
                    }
                    items={[
                      { value: "none", label: "Sin variante" },
                      ...variants.map((variant) => ({
                        value: variant.id,
                        label: variant.name,
                      })),
                    ]}
                  >
                    <SelectTrigger className="w-full" aria-label="Variante">
                      <SelectValue placeholder="Sin variante" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin variante</SelectItem>
                      {variants.map((variant) => (
                        <SelectItem key={variant.id} value={variant.id}>
                          {variant.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Input
                    type="number"
                    min="1"
                    aria-label="Cantidad"
                    value={row.quantity}
                    onChange={(event) =>
                      updateComponent(row.key, {
                        quantity: event.target.value,
                      })
                    }
                  />

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Quitar artículo"
                    onClick={() =>
                      setComponents((current) =>
                        current.filter((item) => item.key !== row.key)
                      )
                    }
                  >
                    <Trash2Icon />
                  </Button>
                </div>
              )
            })}
          </section>

          <Separator />

          <OptionGroupsEditor
            library={optionGroups}
            presets={optionPresets}
            value={groups}
            onChange={setGroups}
            disabled={form.pending}
          />

          <Separator />

          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Promociones</Label>
                <p className="text-xs text-muted-foreground">
                  Descuento por porcentaje, importe fijo, 2x1 o vigencia por día
                  y horario.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setPromotions((current) => [
                    ...current,
                    {
                      key: nextKey("promotion"),
                      name: "",
                      type: "PERCENT",
                      value: "10",
                      daysOfWeek: [],
                      startTime: "",
                      endTime: "",
                      isActive: true,
                    },
                  ])
                }
              >
                <PlusIcon />
                Añadir promoción
              </Button>
            </div>

            {promotions.length === 0 ? (
              <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                Sin promociones. El combo se cobra a su precio normal.
              </p>
            ) : null}

            {promotions.map((promotion) => (
              <div
                key={promotion.key}
                className="flex flex-col gap-2 rounded-md border p-3"
              >
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_6rem_auto]">
                  <Input
                    value={promotion.name}
                    placeholder="Nombre de la promoción"
                    aria-label="Nombre de la promoción"
                    onChange={(event) =>
                      updatePromotion(promotion.key, {
                        name: event.target.value,
                      })
                    }
                  />
                  <Select
                    value={promotion.type}
                    onValueChange={(value) =>
                      updatePromotion(promotion.key, {
                        type: (value ?? "PERCENT") as PromotionType,
                      })
                    }
                    items={Object.entries(PROMOTION_TYPE_LABELS).map(
                      ([value, label]) => ({ value, label })
                    )}
                  >
                    <SelectTrigger
                      className="w-full"
                      aria-label="Tipo de promoción"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(PROMOTION_TYPE_LABELS).map(
                        ([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={promotion.value}
                    disabled={promotion.type === "BOGO"}
                    aria-label="Valor de la promoción"
                    onChange={(event) =>
                      updatePromotion(promotion.key, {
                        value: event.target.value,
                      })
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Quitar promoción"
                    onClick={() =>
                      setPromotions((current) =>
                        current.filter((item) => item.key !== promotion.key)
                      )
                    }
                  >
                    <Trash2Icon />
                  </Button>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex flex-wrap gap-1">
                    {DAY_LABELS.map((label, day) => (
                      <Button
                        key={label}
                        type="button"
                        size="sm"
                        variant={
                          promotion.daysOfWeek.includes(day)
                            ? "secondary"
                            : "outline"
                        }
                        onClick={() =>
                          updatePromotion(promotion.key, {
                            daysOfWeek: promotion.daysOfWeek.includes(day)
                              ? promotion.daysOfWeek.filter(
                                  (value) => value !== day
                                )
                              : [...promotion.daysOfWeek, day],
                          })
                        }
                      >
                        {label}
                      </Button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1">
                    <Input
                      type="time"
                      value={promotion.startTime}
                      aria-label="Hora de inicio"
                      className="h-8 w-32"
                      onChange={(event) =>
                        updatePromotion(promotion.key, {
                          startTime: event.target.value,
                        })
                      }
                    />
                    <span className="text-xs text-muted-foreground">a</span>
                    <Input
                      type="time"
                      value={promotion.endTime}
                      aria-label="Hora de fin"
                      className="h-8 w-32"
                      onChange={(event) =>
                        updatePromotion(promotion.key, {
                          endTime: event.target.value,
                        })
                      }
                    />
                  </div>

                  <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                    Activa
                    <Switch
                      checked={promotion.isActive}
                      onCheckedChange={(checked) =>
                        updatePromotion(promotion.key, {
                          isActive: checked,
                        })
                      }
                    />
                  </label>
                </div>
              </div>
            ))}
          </section>

          {form.error ? <FieldError>{form.error}</FieldError> : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={form.pending}
          >
            Cancelar
          </Button>
          <Button type="button" onClick={save} disabled={form.pending}>
            {form.pending ? (
              <Loader2Icon className="animate-spin" />
            ) : (
              <SaveIcon />
            )}
            {combo ? "Guardar combo" : "Crear combo"}
          </Button>
        </DialogFooter>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
