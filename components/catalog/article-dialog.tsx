"use client"

import { useRouter } from "next/navigation"
import { useRef, useState } from "react"
import { Loader2Icon, SaveIcon, TriangleAlertIcon } from "lucide-react"
import { toast } from "sonner"

import {
  createArticle,
  createRecipe,
  deactivateItem,
  publishRecipe,
  unpublishRecipe,
  updateArticle,
  updateArticleImage,
  updateRecipe,
  type ArticleInput,
  type RecipeIngredientInput,
  type RecipeInput,
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
  createPresentationRow,
  defaultPresentationRows,
  nextPresentationKey,
  sizePresentationRows,
  type PresentationMode,
  type PresentationRow,
} from "@/components/catalog/presentation-rows"
import {
  RecipeRows,
  emptyRecipeRow,
  recipeRowsFrom,
  type RecipeRow,
} from "@/components/catalog/recipe-rows"
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
import { Badge } from "@/components/ui/badge"
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
import { cn } from "cn"
import {
  PRESENTATION_PRESETS,
  UNIT_DEFINITIONS,
  convertUnitValue,
  isNoPriceOptionGroup,
  roundQuantity,
} from "@/lib/catalog"
import type {
  ArticleListItem,
  Category,
  Ingredient,
  OptionGroup,
  OptionGroupPreset,
  Recipe,
  UnitCode,
} from "@/lib/catalog"
import { isEmptyPatch, sameNumber, sameText } from "@/lib/diff"
import { uploadItemImage, uploadRecipeImage } from "@/lib/uploads"

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
      !sameNumber(existing.recipeFactor, variant.recipeFactor ?? 1) ||
      existing.isPrimary !== Boolean(variant.isPrimary)
    )
  })
}

/** Modo de presentaciones: tamaño (Chico/Regular/Grande) o variantes. */
function initialPresentationMode(
  article: ArticleListItem | null
): PresentationMode {
  const active = article?.variants.filter((variant) => variant.isActive) ?? []
  if (active.length === 0) return "variant"

  const names = active.map((variant) => variant.name.trim().toLowerCase())
  const sizes = ["chico", "regular", "grande"].every((name) =>
    names.includes(name)
  )
  const hasFactors = active.some(
    (variant) => Number(variant.recipeFactor) !== 1
  )

  return sizes || (active.length === 3 && hasFactors) ? "size" : "variant"
}

/** Presentaciones activas del artículo, con el precio ya en valor absoluto. */
function initialRows(article: ArticleListItem | null): PresentationRow[] {
  if (!article) return []

  const variants = article.variants.filter((variant) => variant.isActive)
  if (variants.length === 0) return []

  const base = toNumber(article.price)
  const explicitPrimary = variants.findIndex((variant) => variant.isPrimary)
  const primaryIndex = explicitPrimary >= 0 ? explicitPrimary : 0

  return variants.map((variant, index) => {
    const preset = PRESENTATION_PRESETS.find(
      (candidate) =>
        candidate.name.trim().toLowerCase() ===
        variant.name.trim().toLowerCase()
    )
    const placeholder = preset?.recipeFactor ?? "1"

    return {
      key: nextPresentationKey(),
      name: variant.name,
      // La principal toma siempre el precio del artículo; las demás lo guardan.
      price:
        index === primaryIndex
          ? ""
          : String(round2(base + toNumber(variant.priceAdjust))),
      // Si el factor es el sugerido, el campo queda vacío y usa el placeholder.
      recipeFactor:
        Number(variant.recipeFactor) === Number(placeholder)
          ? ""
          : variant.recipeFactor,
      recipeFactorPlaceholder: placeholder,
      isPrimary: index === primaryIndex,
      linkedName: false,
      variantId: variant.id,
    }
  })
}

/** Unidad visible por defecto para el rendimiento de un insumo producido. */
function defaultYieldUnit(baseUnit: UnitCode | null | undefined): UnitCode {
  if (baseUnit === "G") return "KG"
  if (baseUnit === "ML") return "L"
  return "UNIT"
}

/** Rendimiento guardado, convertido a una unidad legible. */
function initialYield(recipe: Recipe | null): {
  quantity: string
  unit: UnitCode
} {
  if (
    !recipe?.producesIngredientId ||
    !recipe.yieldQuantity ||
    !recipe.yieldUnit
  ) {
    return { quantity: "", unit: "KG" }
  }

  const unit =
    recipe.producesIngredient?.displayUnit ??
    defaultYieldUnit(recipe.yieldUnit)
  const converted = convertUnitValue(
    Number(recipe.yieldQuantity),
    recipe.yieldUnit,
    unit
  )

  return {
    quantity:
      converted === null ? recipe.yieldQuantity : String(roundQuantity(converted)),
    unit,
  }
}

/** Filas iniciales: siempre al menos una fila visible para capturar insumos. */
function initialRecipeRows(recipe: Recipe | null): RecipeRow[] {
  if (!recipe) return [emptyRecipeRow()]

  const rows = recipeRowsFrom(recipe)
  return rows.length > 0 ? rows : [emptyRecipeRow()]
}

function sameRecipeIngredients(
  recipe: Recipe,
  rows: RecipeIngredientInput[]
): boolean {
  /** Compara la cantidad del formulario con la guardada (ambas en su unidad). */
  function sameLineQuantity(
    quantity: string | number,
    unit: UnitCode | undefined,
    stored: string,
    displayUnit: UnitCode
  ): boolean {
    const from = unit ?? displayUnit
    const converted =
      from === displayUnit
        ? Number(quantity)
        : convertUnitValue(Number(quantity), from, displayUnit)

    return converted !== null && sameNumber(stored, converted)
  }

  if (recipe.ingredients.length !== rows.length) return false

  return rows.every((row, index) => {
    const line = recipe.ingredients[index]
    if (!line) return false

    if (
      line.ingredient.id !== row.ingredientId ||
      (line.variantId ?? null) !== (row.variantId ?? null) ||
      !sameLineQuantity(
        row.quantity,
        row.unit as UnitCode | undefined,
        line.quantity,
        line.ingredient.displayUnit
      ) ||
      (line.label ?? null) !== (row.label?.trim() || null) ||
      line.isOptional !== Boolean(row.isOptional) ||
      line.options.length !== (row.alternatives?.length ?? 0)
    ) {
      return false
    }

    return (row.alternatives ?? []).every((alternative, optionIndex) => {
      const option = line.options[optionIndex]
      if (!option) return false

      return (
        option.ingredient.id === alternative.ingredientId &&
        sameLineQuantity(
          alternative.quantity,
          alternative.unit as UnitCode | undefined,
          option.quantity,
          option.ingredient.displayUnit
        )
      )
    })
  })
}

export function ArticleDialog({
  open,
  onOpenChange,
  mode,
  article,
  recipe,
  categories,
  recipeCategories,
  ingredients,
  optionGroups,
  optionPresets,
  initialArticle,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Entidad con la que se abrió el diálogo (define el texto y los valores). */
  mode: "article" | "recipe"
  article: ArticleListItem | null
  recipe: Recipe | null
  categories: Category[]
  recipeCategories: Category[]
  ingredients: Ingredient[]
  optionGroups: OptionGroup[]
  optionPresets: OptionGroupPreset[]
  /** Abre el diálogo con el switch «Publicar como artículo» encendido. */
  initialArticle?: boolean
}) {
  const router = useRouter()
  const form = useActionForm(() => {
    toast.success(
      mode === "recipe"
        ? recipe
          ? "Receta actualizada"
          : "Receta creada"
        : article
          ? "Artículo actualizado"
          : "Artículo creado"
    )
    router.refresh()
    onOpenChange(false)
  })

  const [articleEnabled, setArticleEnabled] = useState(
    () => Boolean(article) || Boolean(initialArticle)
  )
  // Un insumo no puede publicarse como artículo: si ambos venían activos,
  // gana el artículo y el switch de insumo arranca apagado.
  const [ingredientEnabled, setIngredientEnabled] = useState(
    () =>
      !Boolean(article) &&
      !Boolean(initialArticle) &&
      Boolean(recipe?.producesIngredientId)
  )
  const [name, setName] = useState(article?.name ?? recipe?.name ?? "")
  const [description, setDescription] = useState(
    article?.description ?? recipe?.description ?? ""
  )
  const [articleCategoryId, setArticleCategoryId] = useState(
    article?.category?.id ?? ""
  )
  const [recipeCategoryId, setRecipeCategoryId] = useState(
    recipe?.categoryId ?? ""
  )
  const [price, setPrice] = useState(
    article?.price ?? recipe?.item?.price ?? ""
  )
  const [image, setImage] = useState<DialogImage | null>(() => {
    const key = article?.imageKey ?? recipe?.imageKey
    const url = article?.imageUrl ?? recipe?.imageUrl

    return key && url ? { kind: "existing", key, url } : null
  })
  const [multiple, setMultiple] = useState(
    () => (article?.variants.filter((variant) => variant.isActive).length ?? 0) > 0
  )
  const [rows, setRows] = useState<PresentationRow[]>(() =>
    initialRows(article)
  )
  const [presentationMode, setPresentationMode] = useState<PresentationMode>(
    () => initialPresentationMode(article)
  )
  // Borradores por modo para no perder lo capturado al alternar las chips.
  const presentationDrafts = useRef<
    Record<PresentationMode, PresentationRow[] | null>
  >({ size: null, variant: null })
  const [groups, setGroups] = useState<OptionGroupDraft[]>(() =>
    optionGroupDrafts(article?.optionGroups)
  )
  const [optionsEnabled, setOptionsEnabled] = useState(
    () => (article?.optionGroups?.length ?? 0) > 0
  )
  const [recipeRows, setRecipeRows] = useState<RecipeRow[]>(() =>
    initialRecipeRows(recipe)
  )
  /** null = receta común; si no, id de presentación o `draft:<key>`. */
  const [recipeScope, setRecipeScope] = useState<string | null>(null)
  // El tab Receta arranca apagado; el switch solo muestra la captura.
  const [recipeEnabled, setRecipeEnabled] = useState(false)

  const storedYield = initialYield(recipe)
  const [yieldQuantity, setYieldQuantity] = useState(storedYield.quantity)
  const [yieldUnit, setYieldUnit] = useState<UnitCode>(storedYield.unit)

  // Confirmación al apagar «Múltiples presentaciones» de un artículo guardado.
  const [confirmDisableVariants, setConfirmDisableVariants] = useState(false)
  // Confirmación al apagar las opciones de un artículo ya guardado.
  const [confirmDisableOptions, setConfirmDisableOptions] = useState(false)
  // Confirmación al despublicar la receta (el artículo se elimina o desactiva).
  const [confirmDisableArticle, setConfirmDisableArticle] = useState(false)

  // Cada tab usa su propio catálogo: artículos -> categorías de artículo,
  // recetas -> categorías de receta. Si un artículo publicado heredó una
  // categoría de receta, se conserva visible al editarlo desde Artículos.
  const categoryOptions: Array<{ id: string; name: string }> =
    mode === "article"
      ? article?.category &&
        !categories.some((category) => category.id === article.category?.id)
        ? [
            { id: article.category.id, name: article.category.name },
            ...categories,
          ]
        : categories
      : recipeCategories

  const categoryValue =
    mode === "article" ? articleCategoryId : recipeCategoryId

  /** El precio solo se oculta cuando la receta también produce un insumo. */
  const priceVisible = !ingredientEnabled

  /** El nombre del artículo arrastra a las filas que no se editaron a mano. */
  function handleNameChange(value: string) {
    setName(value)
    setRows((current) =>
      current.map((row) => (row.linkedName ? { ...row, name: value } : row))
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

    if (!next) {
      clearDraftRecipeScopes(rows)
    }

    if (next && rows.length === 0) {
      setRows(defaultPresentationRows(name))
      setPresentationMode("variant")
      presentationDrafts.current = { size: null, variant: null }
    }
  }

  /** Quita las filas de receta ligadas a presentaciones que aún no se guardan. */
  function clearDraftRecipeScopes(sourceRows: PresentationRow[]) {
    const drafts = new Set(
      sourceRows
        .filter((presentation) => !presentation.variantId)
        .map((presentation) => `draft:${presentation.key}`)
    )

    if (drafts.size === 0) return

    setRecipeRows((current) =>
      current.filter((row) => !drafts.has(row.variantId ?? ""))
    )
  }

  function handlePresentationModeChange(next: PresentationMode) {
    if (next === presentationMode) return

    clearDraftRecipeScopes(rows)
    presentationDrafts.current[presentationMode] = rows

    const saved = presentationDrafts.current[next]
    setRows(
      saved && saved.length > 0
        ? saved
        : next === "size"
          ? sizePresentationRows()
          : [createPresentationRow()]
    )
    setPresentationMode(next)
  }

  /** Al quitar una presentación, se limpian sus filas de receta. */
  function handlePresentationRowsChange(next: PresentationRow[]) {
    const nextKeys = new Set(next.map((presentation) => presentation.key))
    const removed = rows.filter(
      (presentation) => !nextKeys.has(presentation.key)
    )

    if (removed.length > 0) {
      const scopes = new Set(
        removed.map(
          (presentation) =>
            presentation.variantId ?? `draft:${presentation.key}`
        )
      )

      setRecipeRows((current) =>
        current.filter((row) => !scopes.has(row.variantId ?? ""))
      )
    }

    setRows(next)
  }

  // Presentaciones activas para el alcance de la receta.
  const presentationScopes = rows
    .map((row, index) => ({
      scope: row.variantId ?? `draft:${row.key}`,
      name: row.name.trim() || `Presentación ${index + 1}`,
    }))
    .filter((_, index) => {
      const row = rows[index]
      return Boolean(row?.name.trim() || row?.variantId)
    })

  const showRecipeScopes = multiple && presentationScopes.length > 0

  const activeRecipeScope =
    showRecipeScopes &&
    presentationScopes.some((presentation) => presentation.scope === recipeScope)
      ? recipeScope
      : null

  const commonRecipeRows = recipeRows.filter(
    (row) => row.variantId === null
  )
  const scopedRecipeRows = activeRecipeScope
    ? recipeRows.filter((row) => row.variantId === activeRecipeScope)
    : []

  function setRecipeRowsForScope(
    scope: string | null,
    next: RecipeRow[]
  ) {
    setRecipeRows((current) => [
      ...current.filter((row) => (row.variantId ?? null) !== scope),
      ...next.map((row) => ({ ...row, variantId: scope })),
    ])
  }

  function handleMultipleChange(next: boolean) {
    if (!next && article?.variants.some((variant) => variant.isActive)) {
      setConfirmDisableVariants(true)
      return
    }

    applyMultipleChange(next)
  }

  function applyArticleChange(next: boolean) {
    setArticleEnabled(next)
  }

  function handleArticleChange(next: boolean) {
    if (next) {
      // Artículo e insumo son excluyentes.
      setIngredientEnabled(false)
      setConfirmDisableArticle(false)
      applyArticleChange(true)
      return
    }

    if (article) {
      setConfirmDisableArticle(true)
      return
    }

    applyArticleChange(false)
  }

  /** Apagar las opciones no borra el borrador: solo lo excluye al guardar. */
  function handleOptionsChange(next: boolean) {
    if (!next && (article?.optionGroups?.length ?? 0) > 0) {
      setConfirmDisableOptions(true)
      return
    }

    setOptionsEnabled(next)
  }

  /** El switch del tab Receta solo oculta la captura; el borrador se conserva. */
  function handleRecipeChange(next: boolean) {
    setRecipeEnabled(next)

    if (next) {
      setRecipeRows((current) =>
        current.length > 0 ? current : [emptyRecipeRow()]
      )
    }
  }

  /** Convertir en insumo requiere ver la receta para capturar sus insumos. */
  function handleIngredientChange(next: boolean) {
    setIngredientEnabled(next)

    if (next) {
      // Un insumo no puede ser artículo: al encenderlo se apaga la publicación.
      setArticleEnabled(false)
      setConfirmDisableArticle(false)
      setRecipeEnabled(true)
      setRecipeRows((current) =>
        current.length > 0 ? current : [emptyRecipeRow()]
      )
    }
  }

  function handleClear() {
    setName("")
    setDescription("")
    setArticleCategoryId("")
    setRecipeCategoryId("")
    setPrice("")
    setImage(null)
    setMultiple(false)
    setRows([])
    setPresentationMode("variant")
    presentationDrafts.current = { size: null, variant: null }
    setGroups([])
    setOptionsEnabled(false)
    setRecipeRows([emptyRecipeRow()])
    setRecipeEnabled(false)
    setArticleEnabled(mode === "article")
    setIngredientEnabled(false)
    setYieldQuantity("")
    setYieldUnit("KG")
    form.setError(null)
  }

  function buildRecipeIngredients(): {
    rows: RecipeIngredientInput[]
    error?: string
  } {
    const payload: RecipeIngredientInput[] = []
    const used = new Set<string>()

    for (const row of recipeRows) {
      const touched = Boolean(row.ingredientId) || row.quantity.trim() !== ""
      if (!touched) continue

      if (!row.ingredientId) {
        return { rows: [], error: "Elige el insumo de cada fila" }
      }

      const ingredient = ingredients.find((item) => item.id === row.ingredientId)

      if (!ingredient) {
        return { rows: [], error: "Hay un insumo que ya no está disponible" }
      }

      if (used.has(`${row.variantId ?? "common"}:${row.ingredientId}`)) {
        return {
          rows: [],
          error: `El insumo «${ingredient.name}» está repetido en el mismo alcance`,
        }
      }
      used.add(`${row.variantId ?? "common"}:${row.ingredientId}`)

      const quantity = toNumber(row.quantity)

      if (!Number.isFinite(quantity) || quantity <= 0) {
        return {
          rows: [],
          error: `Indica una cantidad válida para «${ingredient.name}»`,
        }
      }

      payload.push({
        ingredientId: row.ingredientId,
        quantity,
        ...(row.variantId ? { variantId: row.variantId } : {}),
        ...(row.unit ? { unit: row.unit as UnitCode } : {}),
        ...(row.label.trim() ? { label: row.label.trim() } : {}),
        ...(row.isOptional ? { isOptional: true } : {}),
        ...(row.alternatives.length > 0
          ? {
              alternatives: row.alternatives
                .filter(
                  (alternative) =>
                    alternative.ingredientId &&
                    Number(alternative.quantity) > 0
                )
                .map((alternative) => ({
                  ingredientId: alternative.ingredientId,
                  quantity: Number(alternative.quantity),
                  ...(alternative.unit
                    ? { unit: alternative.unit as UnitCode }
                    : {}),
                })),
            }
          : {}),
      })
    }

    return { rows: payload }
  }

  function save() {
    const trimmedName = name.trim()

    if (!trimmedName) {
      form.setError("El nombre es obligatorio")
      return
    }

    // Si el switch del tab Receta está apagado no se tocan los insumos.
    const recipeResult = recipeEnabled
      ? buildRecipeIngredients()
      : { rows: [] as RecipeIngredientInput[] }

    if (recipeResult.error) {
      form.setError(recipeResult.error)
      return
    }

    const recipeIngredients = recipeResult.rows
    const basePrice = toNumber(price)
    // Al ocultar el precio (receta que ya tiene artículo) se conserva el valor
    // actual para no recalcular presentaciones con NaN.
    const priceBase = Number.isFinite(basePrice) ? basePrice : 0
    const variants: NonNullable<ArticleInput["variants"]> = []

    if (mode === "article" && !articleCategoryId) {
      form.setError("La categoría es obligatoria")
      return
    }

    if (mode === "recipe" && !recipeCategoryId) {
      form.setError("La categoría es obligatoria")
      return
    }

    if (priceVisible && (!Number.isFinite(basePrice) || basePrice < 0)) {
      form.setError("Indica un precio válido")
      return
    }

    if (articleEnabled) {
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
            ? priceBase
            : row.price.trim()
              ? toNumber(row.price)
              : priceBase
          const rowPrice =
            Number.isFinite(rawPrice) && rawPrice >= 0 ? rawPrice : priceBase
          const rawFactor =
            row.recipeFactor.trim() ||
            row.recipeFactorPlaceholder ||
            "1"
          const parsedFactor = Number(rawFactor)
          const recipeFactor =
            Number.isFinite(parsedFactor) && parsedFactor > 0
              ? parsedFactor
              : 1

          variants.push({
            name: rowName,
            // La API guarda el ajuste; el precio del artículo es la principal.
            priceAdjust: round2(rowPrice - priceBase),
            recipeFactor,
            sortOrder: index,
            isPrimary: row.isPrimary,
          })
        }

        if (!variants.some((variant) => variant.isPrimary)) {
          variants[0].isPrimary = true
        }
      }
    }

    let yieldValue = 0

    if (ingredientEnabled) {
      if (recipeIngredients.length === 0) {
        form.setError("Añade al menos un insumo para convertir la receta en insumo")
        return
      }

      yieldValue = toNumber(yieldQuantity)

      if (!Number.isFinite(yieldValue) || yieldValue <= 0) {
        form.setError("Indica un rendimiento válido")
        return
      }
    }

    if (
      recipeEnabled &&
      !article &&
      !recipe &&
      recipeIngredients.length === 0 &&
      (mode === "recipe" || !articleEnabled)
    ) {
      form.setError("Añade al menos un insumo a la receta")
      return
    }

    const savedGroups = optionsEnabled ? groups : []

    for (const group of savedGroups) {
      if (
        group.isRequired &&
        group.values.length > 0 &&
        !group.values.some((item) => item.isActive)
      ) {
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

    const groupsChanged = articleEnabled
      ? article
        ? optionsEnabled
          ? optionGroupsSignature(savedGroups) !==
            optionGroupsSignature(optionGroupDrafts(article.optionGroups))
          : (article.optionGroups?.length ?? 0) > 0
        : savedGroups.length > 0
      : false

    const payload: ArticleInput = {
      name: trimmedName,
      description: description.trim() || null,
      categoryId: articleCategoryId,
      price: priceBase,
      variants,
      ...(optionsEnabled && savedGroups.length > 0
        ? { optionGroups: optionGroupPayload(savedGroups) }
        : {}),
    }

    const produceChanged =
      ingredientEnabled &&
      (!recipe?.producesIngredientId ||
        !sameNumber(yieldQuantity, storedYield.quantity) ||
        yieldUnit !== storedYield.unit)

    form.run(async () => {
      let itemId = article?.id
      let recipeId = recipe?.id ?? null
      let changed = false
      let articleVariants: ArticleListItem["variants"] =
        article?.variants ?? []

      // Resuelve los alcances de borrador (`draft:<key>`) contra las variantes
      // que acaban de crearse/actualizarse en el artículo.
      function resolveRecipeRows(): {
        rows: RecipeIngredientInput[]
        error?: string
      } {
        const active = articleVariants.filter((variant) => variant.isActive)

        const rowsResolved: RecipeIngredientInput[] = []

        for (const row of recipeIngredients) {
          if (!row.variantId || !row.variantId.startsWith("draft:")) {
            rowsResolved.push(row)
            continue
          }

          const key = row.variantId.slice("draft:".length)
          const index = rows.findIndex((presentation) => presentation.key === key)
          const variant = index >= 0 ? active[index] : undefined

          if (!variant) {
            return {
              rows: [],
              error:
                "No se pudieron vincular las presentaciones con la receta. Guarda de nuevo.",
            }
          }

          rowsResolved.push({ ...row, variantId: variant.id })
        }

        return { rows: rowsResolved }
      }

      // 1. Artículo existente: solo se envían los campos que cambiaron.
      if (articleEnabled && article) {
        const changes: Partial<ArticleInput> = {
          ...(sameText(article.name, trimmedName) ? {} : { name: trimmedName }),
          ...(sameText(article.description, payload.description)
            ? {}
            : { description: payload.description }),
          ...(mode === "article" &&
          (article.category?.id ?? null) !== articleCategoryId
            ? { categoryId: articleCategoryId }
            : {}),
          ...(priceVisible && !sameNumber(article.price, basePrice)
            ? { price: basePrice }
            : {}),
          ...(variantsChanged(article, variants) ? { variants } : {}),
          ...(groupsChanged
            ? { optionGroups: optionGroupPayload(savedGroups) }
            : {}),
        }

        if (!isEmptyPatch(changes)) {
          const updated = await updateArticle(article.id, changes)
          if (!updated.ok) return updated
          articleVariants = updated.data?.variants ?? articleVariants
          changed = true
        }
      }

      // 2. Artículo existente sin receta: se crea y vincula en este momento.
      if (
        mode === "article" &&
        recipeEnabled &&
        articleEnabled &&
        article &&
        !recipe &&
        (recipeIngredients.length > 0 || ingredientEnabled)
      ) {
        const scoped = resolveRecipeRows()
        if (scoped.error) return { ok: false, message: scoped.error }

        const created = await createRecipe({
          name: trimmedName,
          description: description.trim() || undefined,
          categoryId: null,
          ingredients: scoped.rows,
          itemId: article.id,
          ...(ingredientEnabled
            ? {
                produce: {
                  displayUnit: yieldUnit,
                  yieldQuantity: yieldValue,
                },
              }
            : {}),
        })

        if (!created.ok) return created
        recipeId = created.data?.id ?? null
        changed = true
      }

      // 3. Receta existente: nombre, categoría, ingredientes y producción.
      if (recipe) {
        const nextRecipeCategory = recipeCategoryId || null
        const unpublishing = !articleEnabled && Boolean(article)
        const scopedIngredients =
          recipeEnabled &&
          (unpublishing ||
            !sameRecipeIngredients(recipe, recipeIngredients))
            ? unpublishing
              ? {
                  rows: recipeIngredients.filter((row) => !row.variantId),
                }
              : resolveRecipeRows()
            : null

        if (scopedIngredients?.error) {
          return { ok: false, message: scopedIngredients.error }
        }

        const changes: Partial<RecipeInput> = {
          ...(sameText(recipe.name, trimmedName) ? {} : { name: trimmedName }),
          ...(sameText(recipe.description, description.trim() || null)
            ? {}
            : { description: description.trim() || null }),
          ...(mode === "recipe" &&
          (recipe.categoryId ?? null) !== nextRecipeCategory
            ? { categoryId: nextRecipeCategory }
            : {}),
          ...(scopedIngredients
            ? { ingredients: scopedIngredients.rows }
            : {}),
          ...(produceChanged
            ? {
                produce: {
                  displayUnit: yieldUnit,
                  yieldQuantity: yieldValue,
                },
              }
            : {}),
          ...(!ingredientEnabled && recipe.producesIngredientId
            ? { clearProduce: true }
            : {}),
        }

        if (!isEmptyPatch(changes)) {
          const updated = await updateRecipe(recipe.id, changes)
          if (!updated.ok) return updated
          changed = true
        }
      }

      // 4. Artículo nuevo + su receta (tab Artículos).
      if (mode === "article" && articleEnabled && !article && !recipe) {
        const created = await createArticle(payload)
        if (!created.ok) return created

        itemId = created.data?.id
        articleVariants = created.data?.variants ?? articleVariants
        changed = true

        if (
          recipeEnabled &&
          (recipeIngredients.length > 0 || ingredientEnabled)
        ) {
          const scoped = resolveRecipeRows()
          if (scoped.error) return { ok: false, message: scoped.error }

          const recipeCreated = await createRecipe({
            name: trimmedName,
            description: description.trim() || undefined,
            categoryId: null,
            ingredients: scoped.rows,
            ...(itemId ? { itemId } : {}),
            ...(ingredientEnabled
              ? {
                  produce: {
                    displayUnit: yieldUnit,
                    yieldQuantity: yieldValue,
                  },
                }
              : {}),
          })

          if (!recipeCreated.ok) return recipeCreated
          recipeId = recipeCreated.data?.id ?? null
        }
      }

      // 5. Receta nueva (tab Recetas o diálogo sin artículo).
      if (!article && !recipe && (mode === "recipe" || !articleEnabled)) {
        // Si se va a publicar, las filas por presentación se envían después de
        // crear las variantes; aquí solo se guarda la receta común.
        const commonRows = recipeIngredients.filter((row) => !row.variantId)
        const created = await createRecipe({
          name: trimmedName,
          description: description.trim() || undefined,
          categoryId: mode === "recipe" ? recipeCategoryId || null : null,
          ...(commonRows.length > 0 ? { ingredients: commonRows } : {}),
          ...(ingredientEnabled
            ? {
                produce: {
                  displayUnit: yieldUnit,
                  yieldQuantity: yieldValue,
                },
              }
            : {}),
        })

        if (!created.ok) return created
        recipeId = created.data?.id ?? null
        changed = true
      }

      // 6. Publicar la receta como artículo (tab Recetas). La categoría del
      // artículo se hereda de la receta porque aquí solo se ven categorías de
      // recetas.
      if (mode === "recipe" && articleEnabled && !article && recipeId) {
        const published = await publishRecipe(recipeId, {
          price: priceBase,
          ...(variants.length > 0
            ? {
                variants: variants.map((variant) => ({
                  name: variant.name ?? "",
                  priceAdjust: variant.priceAdjust,
                  recipeFactor: variant.recipeFactor ?? 1,
                  sortOrder: variant.sortOrder,
                  isActive: variant.isActive,
                })),
              }
            : {}),
        })

        if (!published.ok) return published

        itemId = published.data?.item?.id
        articleVariants = published.data?.item?.variants ?? []
        changed = true

        // La receta se creó solo con las filas comunes; ahora que existen las
        // variantes se guardan también las filas propias de cada presentación.
        if (recipeId && recipeIngredients.some((row) => row.variantId)) {
          const scoped = resolveRecipeRows()
          if (scoped.error) return { ok: false, message: scoped.error }

          const recipeSaved = await updateRecipe(recipeId, {
            ingredients: scoped.rows,
          })
          if (!recipeSaved.ok) return recipeSaved
        }

        // La publicación no admite opciones: se asignan al artículo recién creado.
        if (optionsEnabled && savedGroups.length > 0 && itemId) {
          const optionsSaved = await updateArticle(itemId, {
            optionGroups: optionGroupPayload(savedGroups),
          })
          if (!optionsSaved.ok) return optionsSaved
        }
      }

      // 7. Se apagó «Publicar como artículo»: se desvincula el artículo.
      if (!articleEnabled && article && recipe) {
        const unpublished = await unpublishRecipe(recipe.id)
        if (!unpublished.ok) return unpublished
        changed = true
      }

      // 8. Artículo sin receta que deja de publicarse: se desactiva para no
      // venderlo, conservando su historial de pedidos.
      if (mode === "article" && !articleEnabled && article && !recipe) {
        const deactivated = await deactivateItem(article.id)
        if (!deactivated.ok) return deactivated
        changed = true
      }

      // 9. Imagen: la receta y el artículo comparten una sola entrada, así que
      // se sube o se borra una sola vez. Se usa la receta si existe; si no, el
      // artículo.
      const imagePending = image?.kind === "pending"
      let imageWarning: string | null = null

      const imageRecipeId = recipeId
      const imageItemId = recipeId ? null : itemId
      const hasStoredImage = Boolean(recipe?.imageKey || article?.imageKey)

      if (imagePending && image) {
        const uploaded = imageRecipeId
          ? await uploadRecipeImage(imageRecipeId, image.file)
          : imageItemId
            ? await uploadItemImage(imageItemId, image.file)
            : null

        if (!uploaded) {
          imageWarning =
            "Guarda el artículo o la receta antes de subir la imagen."
        } else if (uploaded.ok) {
          const saved = imageRecipeId
            ? await updateRecipe(imageRecipeId, {
                imageKey: uploaded.key ?? null,
              })
            : await updateArticleImage(imageItemId!, uploaded.key ?? null)

          if (!saved.ok) return saved
          changed = true
        } else {
          imageWarning =
            uploaded.message ??
            "Los datos se guardaron, pero la imagen no se pudo subir."
        }
      } else if (!image && hasStoredImage) {
        const saved = imageRecipeId
          ? await updateRecipe(imageRecipeId, { imageKey: null })
          : await updateArticleImage(imageItemId!, null)

        if (!saved.ok) return saved
        changed = true
      }

      if (imageWarning) {
        toast.warning(imageWarning)
        router.refresh()
        onOpenChange(false)
        return { ok: true }
      }

      if (!changed && !imagePending) {
        toast.info("Sin cambios")
      }

      return { ok: true }
    })
  }

  const descriptionText =
    mode === "recipe"
      ? "Los ingredientes son insumos del inventario. Al vender el artículo, el stock se descuenta con esta receta."
      : "Los artículos se venden en el punto de venta y podrán usarse en menús. Crearlos aquí no modifica el inventario."

  // Los chips de alcance viven fuera del switch: se ven siempre que haya
  // presentaciones, incluso antes de encender la captura o publicar.
  const recipeScopesFieldset = showRecipeScopes ? (
    <fieldset className="min-w-0 rounded-lg border border-dashed px-2 pt-1 pb-2">
      <legend className="px-1 text-[10px] font-medium text-muted-foreground">
        Insumos por presentación
      </legend>
      <div className="flex flex-wrap items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-pressed={activeRecipeScope === null}
          className={cn(
            "h-6 gap-1 rounded-full px-2 text-[11px] shadow-none",
            activeRecipeScope === null
              ? "border-chart-2/60 bg-chart-2/10 text-chart-2 hover:bg-chart-2/20 hover:text-chart-2 dark:border-chart-2/50 dark:bg-chart-2/15 dark:hover:bg-chart-2/25"
              : "border-muted-foreground/30 text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
          onClick={() => setRecipeScope(null)}
        >
          Común
        </Button>
        {presentationScopes.map((presentation) => {
          const count = recipeRows.filter(
            (row) => row.variantId === presentation.scope
          ).length
          const active = activeRecipeScope === presentation.scope

          return (
            <Button
              key={presentation.scope}
              type="button"
              variant="outline"
              size="sm"
              aria-pressed={active}
              className={cn(
                "h-6 gap-1 rounded-full px-2 text-[11px] shadow-none",
                active
                  ? "border-chart-2/60 bg-chart-2/10 text-chart-2 hover:bg-chart-2/20 hover:text-chart-2 dark:border-chart-2/50 dark:bg-chart-2/15 dark:hover:bg-chart-2/25"
                  : "border-muted-foreground/30 text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              onClick={() => setRecipeScope(presentation.scope)}
            >
              {presentation.name}
              {count > 0 ? (
                <Badge
                  variant="outline"
                  className="ml-1 px-1.5 text-[10px]"
                >
                  {count}
                </Badge>
              ) : null}
            </Button>
          )
        })}
      </div>
    </fieldset>
  ) : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="no-scrollbar max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "recipe"
              ? recipe
                ? "Editar receta"
                : "Nueva receta"
              : article
                ? "Editar artículo"
                : "Nuevo artículo"}
          </DialogTitle>
          <DialogDescription>{descriptionText}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Grupo superior: imagen a la izquierda; switches, nombre, precio y categoría. */}
          <div className="grid gap-4 sm:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
            <ImageDropzone
              url={image?.url ?? null}
              onSelect={handleSelectImage}
              onRemove={handleRemoveImage}
              disabled={form.pending}
            />

            <div className="flex flex-col gap-3">
              {/* Interruptores: publicar como artículo y convertir en insumo. */}
              <div className="flex flex-wrap items-center gap-2">
                <Switch
                  id="article-published"
                  checked={articleEnabled}
                  disabled={form.pending}
                  onCheckedChange={handleArticleChange}
                />
                <Label htmlFor="article-published">Publicar como artículo</Label>

                <Separator orientation="vertical" className="mx-1 h-5" />

                <Switch
                  id="article-ingredient"
                  checked={ingredientEnabled}
                  disabled={form.pending}
                  onCheckedChange={handleIngredientChange}
                />
                <Label htmlFor="article-ingredient">Insumo</Label>
                <InfoHint text="Convierte la receta en un insumo del inventario: al producir un lote se suma stock con la unidad y el rendimiento indicados." />
              </div>

              <Field>
                <FieldLabel htmlFor="article-name">
                  Nombre <span className="text-destructive">*</span>
                </FieldLabel>
                <Input
                  id="article-name"
                  value={name}
                  maxLength={120}
                  onChange={(event) => handleNameChange(event.target.value)}
                  placeholder={
                    mode === "recipe" ? "Ej. Salsa verde" : "Ej. Café americano"
                  }
                />
              </Field>

              <div className="grid gap-3 sm:grid-cols-2">
                {priceVisible ? (
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
                ) : null}

                {ingredientEnabled ? (
                  <Field>
                    <div className="flex items-center gap-1.5">
                      <FieldLabel htmlFor="recipe-yield">Rendimiento</FieldLabel>
                      <InfoHint text="Cantidad de insumo que produce un lote de la receta." />
                    </div>
                    <div className="flex items-stretch gap-2">
                      <Input
                        id="recipe-yield"
                        type="number"
                        min="0.0001"
                        step="any"
                        value={yieldQuantity}
                        onChange={(event) =>
                          setYieldQuantity(event.target.value)
                        }
                        placeholder="0.00"
                        className="min-w-0 flex-1"
                      />
                      <Select
                        value={yieldUnit}
                        onValueChange={(value) =>
                          setYieldUnit((value ?? "UNIT") as UnitCode)
                        }
                        items={UNIT_DEFINITIONS.map((unit) => ({
                          value: unit.code,
                          label: unit.symbol,
                        }))}
                      >
                        <SelectTrigger className="w-24" aria-label="Unidad del rendimiento">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {UNIT_DEFINITIONS.map((unit) => (
                            <SelectItem key={unit.code} value={unit.code}>
                              {unit.symbol}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </Field>
                ) : null}

                <Field>
                  <FieldLabel htmlFor="article-category">
                    Categoría <span className="text-destructive">*</span>
                  </FieldLabel>
                  <Select
                    value={categoryValue || null}
                    onValueChange={(value) => {
                      const next = value ?? ""

                      if (mode === "article") {
                        setArticleCategoryId(next)
                      } else {
                        setRecipeCategoryId(next)
                      }
                    }}
                    items={categoryOptions.map((category) => ({
                      value: category.id,
                      label: category.name,
                    }))}
                  >
                    <SelectTrigger id="article-category" className="w-full">
                      <SelectValue placeholder="Selecciona una categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      {categoryOptions.map((category) => (
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
              placeholder={
                mode === "recipe"
                  ? "Preparación, notas o rendimiento esperado"
                  : "Descripción para el menú"
              }
            />
            {articleEnabled ? (
              <p className="text-xs text-muted-foreground">
                El SKU se genera solo a partir de la categoría.
              </p>
            ) : null}
          </Field>

          <Separator />

          <Tabs defaultValue="presentaciones" className="gap-4">
            <TabsList>
              <TabsTrigger type="button" value="presentaciones">
                Presentaciones
              </TabsTrigger>
              <TabsTrigger type="button" value="opciones">
                Opciones
              </TabsTrigger>
              <TabsTrigger type="button" value="receta">
                Receta
              </TabsTrigger>
            </TabsList>

            <TabsContent value="receta" keepMounted>
              <section className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <Label
                      htmlFor="article-recipe"
                      className="text-sm font-medium"
                    >
                      Insumos de la receta
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Los insumos comunes se descuentan en todas las
                      presentaciones; los de una presentación solo en esa.
                    </p>
                  </div>
                  <Switch
                    id="article-recipe"
                    checked={recipeEnabled}
                    disabled={form.pending}
                    onCheckedChange={handleRecipeChange}
                  />
                </div>

                {recipeScopesFieldset}

                {recipeEnabled ? (
                  <div className="flex flex-col gap-3">
                    {activeRecipeScope !== null ? (
                      <div className="rounded-md border bg-muted/30 p-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium">
                            Receta común
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setRecipeScope(null)}
                          >
                            Editar
                          </Button>
                        </div>

                        {commonRecipeRows.length > 0 ? (
                          <ul className="mt-1 flex flex-col gap-0.5 text-xs text-muted-foreground">
                            {commonRecipeRows.map((row) => {
                              const ingredient = ingredients.find(
                                (item) => item.id === row.ingredientId
                              )

                              return (
                                <li key={row.key}>
                                  {ingredient?.name ?? "Insumo"} ·{" "}
                                  {row.quantity || "—"} {row.unit}
                                </li>
                              )
                            })}
                          </ul>
                        ) : (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Sin insumos comunes.
                          </p>
                        )}
                      </div>
                    ) : null}

                    <RecipeRows
                      key={activeRecipeScope ?? "common"}
                      rows={
                        activeRecipeScope === null
                          ? commonRecipeRows
                          : scopedRecipeRows
                      }
                      ingredients={ingredients}
                      onChange={(next) =>
                        setRecipeRowsForScope(activeRecipeScope, next)
                      }
                      disabled={form.pending}
                      allowEmpty={activeRecipeScope !== null}
                    />

                    {activeRecipeScope !== null &&
                    scopedRecipeRows.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Esta presentación usa solo la receta común. Añade un
                        insumo para reemplazarlo o sumar consumo.
                      </p>
                    ) : null}
                  </div>
                ) : null}
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
                    onChange={handlePresentationRowsChange}
                    articleName={name}
                    articlePrice={price}
                    onArticlePriceChange={setPrice}
                    mode={presentationMode}
                    onModeChange={handlePresentationModeChange}
                    showRecipeFactor={recipeEnabled}
                    disabled={form.pending}
                  />
                ) : null}
              </section>
            </TabsContent>

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

                {optionsEnabled ? (
                  <OptionGroupsEditor
                    library={optionGroups}
                    presets={optionPresets}
                    value={groups}
                    onChange={setGroups}
                    disabled={form.pending}
                    ingredients={ingredients}
                    recipeRows={recipeRows}
                    hideHeader
                  />
                ) : null}
              </section>
            </TabsContent>
          </Tabs>

          {form.error ? <FieldError>{form.error}</FieldError> : null}
        </div>

        <DialogFooter>
          {!article && !recipe ? (
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
            {mode === "recipe"
              ? recipe
                ? "Guardar receta"
                : "Crear receta"
              : article
                ? "Guardar artículo"
                : "Crear artículo"}
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

        <AlertDialog
          open={confirmDisableArticle}
          onOpenChange={setConfirmDisableArticle}
        >
          <AlertDialogContent size="sm">
            <AlertDialogHeader>
              <AlertDialogMedia className="bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive">
                <TriangleAlertIcon />
              </AlertDialogMedia>
              <AlertDialogTitle>Dejar de publicar como artículo</AlertDialogTitle>
              <AlertDialogDescription>
                {recipe
                  ? "El artículo se eliminará o se desactivará si ya tiene pedidos. La receta y sus insumos seguirán existiendo. ¿Continuar?"
                  : "El artículo se desactivará y dejará de venderse, conservando su historial de pedidos. ¿Continuar?"}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => applyArticleChange(false)}
              >
                Despublicar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  )
}
