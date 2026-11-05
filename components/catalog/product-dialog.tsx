"use client"

import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import {
  BlenderIcon,
  GroupIcon,
  Loader2Icon,
  PackageIcon,
  SaveIcon,
  SoupIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { toast } from "sonner"

import {
  createArticle,
  createRecipe,
  publishRecipe,
  replaceComboComponents,
  replaceComboPromotions,
  saveRecipeDraftItem,
  unpublishRecipe,
  updateArticle,
  updateArticleImage,
  updateRecipe,
  updateVariant,
  type ArticleInput,
  type ComboComponentInput,
  type ComboPromotionInput,
  type RecipeIngredientInput,
  type RecipeInput,
} from "@/app/(app)/catalog/actions"
import { ImageDropzone } from "@/components/catalog/image-dropzone"
import {
  ComboComponentsPicker,
  type ComboComponentRow,
} from "@/components/catalog/combo-components-picker"
import { ComboPromotionFields } from "@/components/catalog/combo-promotion-fields"
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
  PROMOTION_TYPE_LABELS,
  UNIT_DEFINITIONS,
  convertUnitValue,
  isNoPriceOptionGroup,
  roundQuantity,
} from "@/lib/catalog"
import type {
  ArticleListItem,
  Category,
  Ingredient,
  IngredientCategory,
  OptionGroup,
  OptionGroupPreset,
  PromotionType,
  Recipe,
  UnitCode,
} from "@/lib/catalog"
import { isEmptyPatch, sameNumber, sameText } from "@/lib/diff"
import {
  uploadItemImage,
  uploadRecipeImage,
  uploadVariantImage,
} from "@/lib/uploads"

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
      imageKey: variant.imageKey,
      imageUrl: variant.imageUrl,
      imageFile: null,
      imagePreviewUrl: null,
    }
  })
}

/** Preferencia del switch «Insumos de la receta». */
const RECIPE_SWITCH_KEY = "np:catalog:recipe-enabled"

function initialRecipeEnabled(): boolean {
  if (typeof window === "undefined") return false

  try {
    return window.localStorage.getItem(RECIPE_SWITCH_KEY) === "1"
  } catch {
    return false
  }
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

export type ProductSaveAs = "article" | "recipe" | "ingredient" | "combo"

const SAVE_AS_OPTIONS: Array<{
  value: ProductSaveAs
  label: string
  icon: typeof SoupIcon
}> = [
  { value: "article", label: "Artículo", icon: SoupIcon },
  { value: "recipe", label: "Receta", icon: BlenderIcon },
  { value: "ingredient", label: "Insumo", icon: PackageIcon },
  { value: "combo", label: "Combo", icon: GroupIcon },
]

function saveAsChipClass(active: boolean): string {
  return cn(
    "h-7 gap-1.5 rounded-full px-2.5 text-xs shadow-none",
    active
      ? "border-chart-2/60 bg-chart-2/10 text-chart-2 hover:bg-chart-2/20 hover:text-chart-2 dark:border-chart-2/50 dark:bg-chart-2/15 dark:hover:bg-chart-2/25"
      : "border-muted-foreground/30 text-muted-foreground hover:bg-muted hover:text-foreground"
  )
}

function initialProductSaveAs(
  recipe: Recipe | null,
  article: ArticleListItem | null,
  requested?: ProductSaveAs
): ProductSaveAs {
  if (article?.isCombo) return "combo"
  if (recipe?.producesIngredientId) return "ingredient"
  if (requested) return requested
  if (recipe?.itemId || (article && !article.isArchived)) return "article"
  if (recipe) return "recipe"
  return "article"
}

function initialIngredientCategoryId(recipe: Recipe | null): string {
  return recipe?.producesIngredient?.category?.id ?? ""
}

function comboKey(itemId: string, variantId?: string | null) {
  return `${itemId}:${variantId ?? ""}`
}

function initialComboComponents(
  article: ArticleListItem | null
): ComboComponentRow[] {
  return (article?.comboComponents ?? []).map((component) => ({
    key: comboKey(component.componentItem.id, component.variant?.id),
    itemId: component.componentItem.id,
    variantId: component.variant?.id ?? "",
    quantity: component.quantity,
  }))
}

const COMBO_PROMOTION_OPTIONS: Array<{
  value: "NONE" | PromotionType
  label: string
}> = [
  { value: "NONE", label: "Ninguna" },
  { value: "PAY_X_GET_Y", label: PROMOTION_TYPE_LABELS.PAY_X_GET_Y },
  { value: "PERCENT", label: PROMOTION_TYPE_LABELS.PERCENT },
  { value: "FIXED", label: PROMOTION_TYPE_LABELS.FIXED },
  { value: "SPECIAL_PRICE", label: PROMOTION_TYPE_LABELS.SPECIAL_PRICE },
  { value: "FREE_ITEM", label: PROMOTION_TYPE_LABELS.FREE_ITEM },
  {
    value: "SECOND_HALF_PRICE",
    label: PROMOTION_TYPE_LABELS.SECOND_HALF_PRICE,
  },
]

export function ProductDialog({
  open,
  onOpenChange,
  article,
  recipe,
  initialSaveAs,
  categories,
  recipeCategories,
  ingredientCategories,
  ingredients,
  optionGroups,
  optionPresets,
  products,
  taxRate,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  article: ArticleListItem | null
  recipe: Recipe | null
  initialSaveAs?: ProductSaveAs
  categories: Category[]
  recipeCategories: Category[]
  ingredientCategories: IngredientCategory[]
  ingredients: Ingredient[]
  optionGroups: OptionGroup[]
  optionPresets: OptionGroupPreset[]
  /** Artículos disponibles para armar un combo. */
  products: ArticleListItem[]
  /** Tasa de IVA por defecto de la organización (fracción). */
  taxRate: string
  /** Se llama tras crear un producto, para abrir el tab donde aparece. */
  onSaved?: (saveAs: ProductSaveAs) => void
}) {
  const router = useRouter()
  const isNew = !article && !recipe
  const [saveAs, setSaveAs] = useState<ProductSaveAs>(() =>
    initialProductSaveAs(recipe, article, initialSaveAs)
  )
  // Un insumo es terminal: no puede convertirse en artículo ni receta.
  const locked = Boolean(recipe?.producesIngredientId)
  const isComboProduct = Boolean(article?.isCombo)
  const [pendingSaveAs, setPendingSaveAs] = useState<ProductSaveAs | null>(null)

  const form = useActionForm(() => {
    toast.success(
      saveAs === "article"
        ? article
          ? "Artículo actualizado"
          : "Artículo creado"
        : saveAs === "combo"
          ? article
            ? "Combo actualizado"
            : "Combo creado"
          : saveAs === "ingredient"
            ? recipe
              ? "Insumo actualizado"
              : "Insumo creado"
            : recipe
              ? "Receta actualizada"
              : "Receta creada"
    )
    router.refresh()
    if (isNew) onSaved?.(saveAs)
    onOpenChange(false)
  })

  // Campos marcados con `aria-invalid`/`data-invalid` en lugar de mostrar un
  // texto rojo cuando falta un valor obligatorio.
  const [invalidFields, setInvalidFields] = useState<Set<string>>(
    () => new Set()
  )

  function markInvalid(...fields: string[]) {
    setInvalidFields(new Set(fields))
    form.setError(null)

    const first = fields[0]
    if (!first) return

    window.requestAnimationFrame(() => {
      document.getElementById(`product-${first}`)?.focus()
    })
  }

  function clearInvalid(...fields: string[]) {
    setInvalidFields((current) => {
      if (!fields.some((field) => current.has(field))) return current

      const next = new Set(current)
      for (const field of fields) next.delete(field)
      return next
    })
  }

  const [name, setName] = useState(article?.name ?? recipe?.name ?? "")
  const [description, setDescription] = useState(
    article?.description ?? recipe?.description ?? ""
  )
  const [notes, setNotes] = useState(recipe?.notes ?? "")
  const [articleCategoryId, setArticleCategoryId] = useState(
    article?.category?.id ?? recipe?.item?.category?.id ?? ""
  )
  const [recipeCategoryId, setRecipeCategoryId] = useState(
    recipe?.categoryId ?? ""
  )
  const [ingredientCategoryId, setIngredientCategoryId] = useState(() =>
    initialIngredientCategoryId(recipe)
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
  // El switch solo muestra la captura. Si el registro ya trae insumos, arranca
  // encendido; si no, se recuerda la última preferencia del usuario.
  const [recipeEnabled, setRecipeEnabled] = useState(
    () => Boolean(recipe?.ingredients.length) || initialRecipeEnabled()
  )
  const effectiveRecipeEnabled = saveAs === "article" ? recipeEnabled : true
  const [dialogTab, setDialogTab] = useState("presentaciones")

  useEffect(() => {
    // La preferencia solo aplica a la chip Artículo; en Receta/Insumo la
    // receta siempre está activa.
    if (saveAs !== "article") return

    try {
      window.localStorage.setItem(
        RECIPE_SWITCH_KEY,
        recipeEnabled ? "1" : "0"
      )
    } catch {
      // Sin localStorage (modo privado) el switch solo vive en la sesión.
    }
  }, [recipeEnabled, saveAs])

  const storedYield = initialYield(recipe)
  const [yieldQuantity, setYieldQuantity] = useState(storedYield.quantity)
  const [yieldUnit, setYieldUnit] = useState<UnitCode>(storedYield.unit)

  const existingComboPromotion = article?.promotions?.[0] ?? null
  const [comboPriceAuto, setComboPriceAuto] = useState(isNew)
  const [comboComponents, setComboComponents] = useState<ComboComponentRow[]>(
    () => initialComboComponents(article)
  )
  const [comboPromotionType, setComboPromotionType] = useState<
    "NONE" | PromotionType
  >(() => existingComboPromotion?.type ?? "NONE")
  const [comboPromotionActive, setComboPromotionActive] = useState(
    () => existingComboPromotion?.isActive ?? true
  )
  const [comboPayQuantity, setComboPayQuantity] = useState(
    () => String(existingComboPromotion?.payQuantity ?? 1)
  )
  const [comboGetQuantity, setComboGetQuantity] = useState(
    () => String(existingComboPromotion?.getQuantity ?? 2)
  )
  const [comboPercent, setComboPercent] = useState(() =>
    existingComboPromotion?.type === "PERCENT"
      ? String(Number(existingComboPromotion.value))
      : ""
  )
  const [comboFixed, setComboFixed] = useState(() =>
    existingComboPromotion?.type === "FIXED"
      ? String(Number(existingComboPromotion.value))
      : ""
  )
  const [comboSpecialPrice, setComboSpecialPrice] = useState(() =>
    existingComboPromotion?.type === "SPECIAL_PRICE"
      ? String(Number(existingComboPromotion.specialPrice ?? 0))
      : ""
  )
  const [comboFreeKey, setComboFreeKey] = useState(() =>
    existingComboPromotion?.freeItemId
      ? comboKey(
          existingComboPromotion.freeItemId,
          existingComboPromotion.freeVariantId
        )
      : ""
  )
  const [comboSecondKey, setComboSecondKey] = useState(() =>
    existingComboPromotion?.discountedItemId
      ? comboKey(
          existingComboPromotion.discountedItemId,
          existingComboPromotion.discountedVariantId
        )
      : ""
  )

  // Confirmación al apagar «Múltiples presentaciones» de un producto guardado.
  const [confirmDisableVariants, setConfirmDisableVariants] = useState(false)
  // Confirmación al apagar las opciones de un producto ya guardado.
  const [confirmDisableOptions, setConfirmDisableOptions] = useState(false)

  // Cada chip usa su propio catálogo de categorías.
  const articleCategoryOptions: Array<{ id: string; name: string }> =
    article?.category &&
    !categories.some((category) => category.id === article.category?.id)
      ? [article.category, ...categories]
      : categories
  const recipeCategoryOptions: Array<{ id: string; name: string }> =
    recipe?.category &&
    !recipeCategories.some((category) => category.id === recipe.category?.id)
      ? [recipe.category, ...recipeCategories]
      : recipeCategories
  const producedCategory = recipe?.producesIngredient?.category ?? null
  const activeIngredientCategories = ingredientCategories.filter(
    (category) => category.isActive
  )
  const ingredientCategoryOptions: Array<{ id: string; name: string }> =
    producedCategory &&
    !activeIngredientCategories.some(
      (category) => category.id === producedCategory.id
    )
      ? [producedCategory, ...activeIngredientCategories]
      : activeIngredientCategories

  const categoryOptions =
    saveAs === "article"
      ? articleCategoryOptions
      : saveAs === "recipe"
        ? recipeCategoryOptions
        : ingredientCategoryOptions

  const categoryValue =
    saveAs === "article"
      ? articleCategoryId
      : saveAs === "recipe"
        ? recipeCategoryId
        : ingredientCategoryId

  const categoryLabel =
    saveAs === "article"
      ? "Categoría del artículo"
      : saveAs === "recipe"
        ? "Categoría de la receta"
        : "Categoría de inventario"

  function setCategoryValue(next: string) {
    clearInvalid("category")

    if (saveAs === "article") {
      setArticleCategoryId(next)
    } else if (saveAs === "recipe") {
      setRecipeCategoryId(next)
    } else {
      setIngredientCategoryId(next)
    }
  }

  // El precio es opcional en una receta; solo el artículo lo exige.
  const priceVisible = saveAs !== "ingredient"
  const priceRequired = saveAs === "article" || saveAs === "combo"
  const yieldVisible = saveAs === "ingredient"
  const notesVisible =
    saveAs !== "combo" && (saveAs !== "article" || effectiveRecipeEnabled)

  /** El nombre arrastra a las filas que no se editaron a mano. */
  function handleNameChange(value: string) {
    clearInvalid("name")
    setName(value)
    setRows((current) =>
      current.map((row) => (row.linkedName ? { ...row, name: value } : row))
    )
  }

  /** Vista previa local: la imagen se sube a R2 al guardar. */
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

  /** Aplica el cambio del interruptor de presentaciones. */
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

  const showRecipeScopes =
    saveAs !== "ingredient" && multiple && presentationScopes.length > 0

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
    if (!next && (article?.variants.some((variant) => variant.isActive) ?? false)) {
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

  /** El switch del tab Receta solo aplica a la chip Artículo. */
  function handleRecipeChange(next: boolean) {
    if (saveAs !== "article") return

    setRecipeEnabled(next)

    if (next) {
      setRecipeRows((current) =>
        current.length > 0 ? current : [emptyRecipeRow()]
      )
    }
  }

  function applySaveAs(next: ProductSaveAs) {
    setSaveAs(next)
    setPendingSaveAs(null)
    setInvalidFields(new Set())
    form.setError(null)

    if (next === "ingredient") {
      setDialogTab("receta")
    } else if (next === "combo") {
      setDialogTab("articulos")
    }

    if (next !== "article") {
      setRecipeEnabled(true)
      setRecipeRows((current) =>
        current.length > 0 ? current : [emptyRecipeRow()]
      )
    }
  }

  function handleSaveAsChange(next: ProductSaveAs) {
    if (next === saveAs || locked) return
    if (isComboProduct && next !== "combo") return

    // Salir de Artículo archiva el artículo: se pide confirmación.
    if (next !== "article" && article && !article.isArchived) {
      setPendingSaveAs(next)
      return
    }

    applySaveAs(next)
  }

  function handleClear() {
    clearInvalid()
    setName("")
    setDescription("")
    setNotes("")
    setArticleCategoryId("")
    setRecipeCategoryId("")
    setIngredientCategoryId("")
    setPrice("")
    setImage(null)
    setMultiple(false)
    setRows([])
    setPresentationMode("variant")
    presentationDrafts.current = { size: null, variant: null }
    setGroups([])
    setOptionsEnabled(false)
    setRecipeRows([emptyRecipeRow()])
    setRecipeEnabled(saveAs !== "article")
    setYieldQuantity("")
    setYieldUnit("KG")
    setComboComponents([])
    setComboPriceAuto(isNew)
    setComboPromotionType("NONE")
    setComboPromotionActive(true)
    setComboPayQuantity("1")
    setComboGetQuantity("2")
    setComboPercent("")
    setComboFixed("")
    setComboSpecialPrice("")
    setComboFreeKey("")
    setComboSecondKey("")
    setDialogTab(
      saveAs === "ingredient"
        ? "receta"
        : saveAs === "combo"
          ? "articulos"
          : "presentaciones"
    )
    form.setError(null)
  }

  function buildRecipeIngredients(scope: "all" | "common" = "all"): {
    rows: RecipeIngredientInput[]
    error?: string
  } {
    const payload: RecipeIngredientInput[] = []
    const used = new Set<string>()
    const source =
      scope === "common"
        ? recipeRows.filter((row) => !row.variantId)
        : recipeRows

    for (const row of source) {
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

  const comboComponentOptions = comboComponents.map((row) => {
    const product = products.find((candidate) => candidate.id === row.itemId)
    const variant = product?.variants.find(
      (candidate) => candidate.id === row.variantId
    )

    return {
      key: row.key,
      label: `${product?.name ?? "Artículo"}${
        variant ? ` · ${variant.name}` : ""
      }`,
      itemId: row.itemId,
      variantId: row.variantId,
    }
  })

  const comboAutoPrice = comboComponents.reduce((total, row) => {
    const product = products.find((candidate) => candidate.id === row.itemId)
    const variant = product?.variants.find(
      (candidate) => candidate.id === row.variantId
    )

    return (
      total +
      (Number(product?.price ?? 0) + Number(variant?.priceAdjust ?? 0)) *
        row.quantity
    )
  }, 0)
  const comboAutoPriceString = String(round2(comboAutoPrice))

  function handleComboPriceAuto(next: boolean) {
    setComboPriceAuto(next)
    if (!next) setPrice(comboAutoPriceString)
  }

  function promotionSignature(promotion: ComboPromotionInput | null): string {
    if (!promotion) return "none"

    const usesValue =
      promotion.type === "PERCENT" || promotion.type === "FIXED"

    return JSON.stringify({
      type: promotion.type,
      value: usesValue ? (promotion.value ?? null) : null,
      payQuantity: promotion.payQuantity ?? null,
      getQuantity: promotion.getQuantity ?? null,
      specialPrice: promotion.specialPrice ?? null,
      freeItemId: promotion.freeItemId ?? null,
      freeVariantId: promotion.freeVariantId ?? null,
      discountedItemId: promotion.discountedItemId ?? null,
      discountedVariantId: promotion.discountedVariantId ?? null,
      isActive: promotion.isActive ?? true,
    })
  }

  function buildComboPromotion(): ComboPromotionInput | null {
    if (comboPromotionType === "NONE") return null

    const freeParts = comboFreeKey.split(":")
    const secondParts = comboSecondKey.split(":")

    return {
      type: comboPromotionType,
      isActive: comboPromotionActive,
      ...(comboPromotionType === "PERCENT"
        ? { value: toNumber(comboPercent) }
        : {}),
      ...(comboPromotionType === "FIXED"
        ? { value: toNumber(comboFixed) }
        : {}),
      ...(comboPromotionType === "PAY_X_GET_Y"
        ? {
            payQuantity: Math.trunc(Number(comboPayQuantity)),
            getQuantity: Math.trunc(Number(comboGetQuantity)),
          }
        : {}),
      ...(comboPromotionType === "SPECIAL_PRICE"
        ? { specialPrice: toNumber(comboSpecialPrice) }
        : {}),
      ...(comboPromotionType === "FREE_ITEM" && comboFreeKey
        ? {
            freeItemId: freeParts[0],
            freeVariantId: freeParts[1] || null,
          }
        : {}),
      ...(comboPromotionType === "SECOND_HALF_PRICE" && comboSecondKey
        ? {
            discountedItemId: secondParts[0],
            discountedVariantId: secondParts[1] || null,
          }
        : {}),
    }
  }

  function saveCombo() {
    const trimmedName = name.trim()
    const numericPrice = comboPriceAuto ? comboAutoPrice : toNumber(price)
    const components = comboComponents
      .filter((row) => row.itemId)
      .map<ComboComponentInput>((row) => ({
        itemId: row.itemId,
        ...(row.variantId ? { variantId: row.variantId } : {}),
        quantity: row.quantity,
      }))

    if (!trimmedName) {
      form.setError("El nombre del combo es obligatorio")
      return
    }
    if (
      (!comboPriceAuto && !price.trim()) ||
      !Number.isFinite(numericPrice) ||
      numericPrice < 0
    ) {
      form.setError("Indica un precio válido")
      return
    }
    if (components.length === 0) {
      form.setError("Selecciona al menos un artículo para el combo")
      return
    }

    if (comboPromotionType === "PERCENT") {
      const value = toNumber(comboPercent)
      if (!Number.isFinite(value) || value <= 0 || value > 100) {
        form.setError("Indica un porcentaje entre 1 y 100")
        return
      }
    }
    if (comboPromotionType === "FIXED") {
      const value = toNumber(comboFixed)
      if (!Number.isFinite(value) || value <= 0) {
        form.setError("Indica un descuento fijo mayor que cero")
        return
      }
    }
    if (comboPromotionType === "SPECIAL_PRICE") {
      const value = toNumber(comboSpecialPrice)
      if (!Number.isFinite(value) || value <= 0 || value >= numericPrice) {
        form.setError("El precio especial debe ser mayor que cero y menor que el precio normal")
        return
      }
    }
    if (comboPromotionType === "PAY_X_GET_Y") {
      const pay = Math.trunc(Number(comboPayQuantity))
      const get = Math.trunc(Number(comboGetQuantity))
      if (pay < 1 || get < 1 || get <= pay) {
        form.setError("La cantidad que se recibe debe ser mayor que la que se paga")
        return
      }
    }
    if (
      (comboPromotionType === "FREE_ITEM" ||
        comboPromotionType === "SECOND_HALF_PRICE") &&
      !comboComponentOptions.some((option) =>
        option.key ===
        (comboPromotionType === "FREE_ITEM" ? comboFreeKey : comboSecondKey)
      )
    ) {
      form.setError("Selecciona uno de los artículos del combo")
      return
    }

    const promotion = buildComboPromotion()

    form.run(async () => {
      let itemId = article?.id ?? null
      let changed = false

      if (!itemId) {
        const created = await createArticle({
          name: trimmedName,
          description: description.trim() || null,
          price: numericPrice,
          isCombo: true,
          categoryId: null,
          comboComponents: components,
          promotions: promotion ? [promotion] : [],
        })

        if (!created.ok) return created

        itemId = created.data?.id ?? null
        if (!itemId) {
          return { ok: false, message: "No se pudo crear el combo" }
        }
        changed = true
      } else {
        if (!article) {
          return { ok: false, message: "No se encontró el combo" }
        }

        const changes: Partial<ArticleInput> = {
          ...(sameText(article.name, trimmedName) ? {} : { name: trimmedName }),
          ...(sameText(article.description, description.trim() || null)
            ? {}
            : { description: description.trim() || null }),
          ...(sameNumber(article.price, numericPrice)
            ? {}
            : { price: numericPrice }),
          ...(article.category ? { categoryId: null } : {}),
        }

        if (!isEmptyPatch(changes)) {
          const updated = await updateArticle(itemId, changes)
          if (!updated.ok) return updated
          changed = true
        }

        const currentComponents = (article.comboComponents ?? [])
          .map(
            (component) =>
              `${component.componentItem.id}:${component.variant?.id ?? ""}:${component.quantity}`
          )
          .sort()
          .join("|")
        const nextComponents = components
          .map(
            (component) =>
              `${component.itemId}:${component.variantId ?? ""}:${component.quantity}`
          )
          .sort()
          .join("|")

        if (currentComponents !== nextComponents) {
          const replaced = await replaceComboComponents(itemId, components)
          if (!replaced.ok) return replaced
          changed = true
        }

        const currentPromotion = article.promotions?.[0] ?? null
        const currentSignature = currentPromotion
          ? promotionSignature({
              type: currentPromotion.type,
              value: Number(currentPromotion.value),
              payQuantity: currentPromotion.payQuantity ?? undefined,
              getQuantity: currentPromotion.getQuantity ?? undefined,
              specialPrice:
                currentPromotion.specialPrice === null
                  ? undefined
                  : Number(currentPromotion.specialPrice),
              freeItemId: currentPromotion.freeItemId,
              freeVariantId: currentPromotion.freeVariantId,
              discountedItemId: currentPromotion.discountedItemId,
              discountedVariantId: currentPromotion.discountedVariantId,
              isActive: currentPromotion.isActive,
            })
          : "none"

        if (currentSignature !== promotionSignature(promotion)) {
          const replaced = await replaceComboPromotions(
            itemId,
            promotion ? [promotion] : []
          )
          if (!replaced.ok) return replaced
          changed = true
        }
      }

      const imagePending = image?.kind === "pending"
      const hasStoredImage = Boolean(article?.imageKey)

      if (imagePending && image) {
        const uploaded = await uploadItemImage(itemId, image.file)

        if (uploaded.ok) {
          const saved = await updateArticleImage(itemId, uploaded.key ?? null)
          if (!saved.ok) return saved
          changed = true
        } else {
          toast.error(
            uploaded.message ?? "Los datos se guardaron, pero la imagen no se pudo subir."
          )
        }
      } else if (!image && hasStoredImage) {
        const saved = await updateArticleImage(itemId, null)
        if (!saved.ok) return saved
        changed = true
      }

      if (!changed && !imagePending) {
        toast.info("Sin cambios")
      }

      return { ok: true }
    })
  }

  function save() {
    if (saveAs === "combo") {
      saveCombo()
      return
    }

    const trimmedName = name.trim()

    setInvalidFields(new Set())
    form.setError(null)

    if (!trimmedName) {
      markInvalid("name")
      return
    }

    const recipeScopeToSave =
      saveAs === "ingredient" || !multiple ? "common" : "all"
    const recipeResult = effectiveRecipeEnabled
      ? buildRecipeIngredients(recipeScopeToSave)
      : { rows: [] as RecipeIngredientInput[] }

    if (recipeResult.error) {
      form.setError(recipeResult.error)
      return
    }

    const recipeIngredients = recipeResult.rows
    const basePrice = toNumber(price)
    const priceBase = Number.isFinite(basePrice) ? basePrice : 0
    const variants: NonNullable<ArticleInput["variants"]> = []

    if (saveAs === "article" && !articleCategoryId) {
      markInvalid("category")
      return
    }

    if (saveAs === "recipe" && !recipeCategoryId) {
      markInvalid("category")
      return
    }

    if (saveAs === "ingredient" && !ingredientCategoryId) {
      markInvalid("category")
      return
    }

    if (
      saveAs === "article" &&
      (!price.trim() || !Number.isFinite(basePrice) || basePrice < 0)
    ) {
      markInvalid("price")
      return
    }

    if (
      saveAs === "recipe" &&
      price.trim() !== "" &&
      (!Number.isFinite(basePrice) || basePrice < 0)
    ) {
      markInvalid("price")
      return
    }

    if (
      saveAs !== "article" &&
      saveAs !== "ingredient" &&
      recipeIngredients.length === 0
    ) {
      form.setError("Añade al menos un insumo a la receta")
      return
    }

    if (saveAs === "ingredient" && recipeIngredients.length === 0) {
      form.setError("Añade al menos un insumo para crear el insumo")
      return
    }

    let yieldValue = 0

    if (saveAs === "ingredient") {
      yieldValue = toNumber(yieldQuantity)

      if (!Number.isFinite(yieldValue) || yieldValue <= 0) {
        markInvalid("yield")
        return
      }
    }

    const needsPresentations =
      saveAs === "article" || saveAs === "recipe"

    if (needsPresentations && multiple) {
      if (rows.length === 0) {
        form.setError("Agrega al menos una presentación")
        return
      }

      const used = new Set<string>()

      for (const [index, row] of rows.entries()) {
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
          ...(row.variantId ? { id: row.variantId } : {}),
          name: rowName,
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

    const groupsChanged =
      saveAs !== "ingredient" &&
      (article
        ? optionsEnabled
          ? optionGroupsSignature(savedGroups) !==
            optionGroupsSignature(optionGroupDrafts(article.optionGroups))
          : (article.optionGroups?.length ?? 0) > 0
        : savedGroups.length > 0)

    form.run(async () => {
      let itemId = article?.id ?? null
      let recipeId = recipe?.id ?? null
      let articleVariants: ArticleListItem["variants"] =
        article?.variants ?? []
      let changed = false
      const isActiveArticle = Boolean(article && !article.isArchived)

      function resolveRecipeRows(
        sourceRows: RecipeIngredientInput[]
      ): {
        rows: RecipeIngredientInput[]
        error?: string
      } {
        const active = articleVariants.filter((variant) => variant.isActive)
        const rowsResolved: RecipeIngredientInput[] = []

        for (const row of sourceRows) {
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

      function recipeChanges(
        ingredientsToSave: RecipeIngredientInput[] | undefined
      ): Partial<RecipeInput> {
        return {
          ...(recipe && sameText(recipe.name, trimmedName)
            ? {}
            : { name: trimmedName }),
          ...(recipe &&
          sameText(recipe.description, description.trim() || null)
            ? {}
            : { description: description.trim() || null }),
          ...(effectiveRecipeEnabled &&
          sameText(recipe?.notes, notes.trim() || null)
            ? {}
            : effectiveRecipeEnabled
              ? { notes: notes.trim() || null }
              : {}),
          ...(recipe &&
          (recipe.categoryId ?? null) !== (recipeCategoryId || null)
            ? { categoryId: recipeCategoryId || null }
            : {}),
          ...(ingredientsToSave ? { ingredients: ingredientsToSave } : {}),
          ...(recipe?.producesIngredientId && saveAs === "article"
            ? { clearProduce: true }
            : {}),
        }
      }

      async function updateItemData(
        targetItemId: string,
        includeArticleFields: boolean
      ) {
        if (!article) return { ok: true as const }

        const changes: Partial<ArticleInput> = {
          ...(sameText(article.name, trimmedName) ? {} : { name: trimmedName }),
          ...(sameText(article.description, description.trim() || null)
            ? {}
            : { description: description.trim() || null }),
          ...(includeArticleFields &&
          (article.category?.id ?? null) !== articleCategoryId
            ? { categoryId: articleCategoryId }
            : {}),
          ...(saveAs !== "ingredient" &&
          price.trim() !== "" &&
          !sameNumber(article.price, priceBase)
            ? { price: priceBase }
            : {}),
          ...(saveAs !== "ingredient" && variantsChanged(article, variants)
            ? { variants }
            : {}),
          ...(saveAs !== "ingredient" && groupsChanged
            ? {
                optionGroups: optionsEnabled
                  ? optionGroupPayload(savedGroups)
                  : [],
              }
            : {}),
        }

        if (isEmptyPatch(changes)) return { ok: true as const }

        const updated = await updateArticle(targetItemId, changes)
        if (!updated.ok) return updated

        articleVariants = updated.data?.variants ?? articleVariants
        changed = true
        return { ok: true as const }
      }

      // -------------------------------------------------------------------
      // Guardar como artículo
      // -------------------------------------------------------------------
      if (saveAs === "article") {
        if (isActiveArticle && itemId) {
          const itemUpdate = await updateItemData(itemId, true)
          if (!itemUpdate.ok) return itemUpdate

          if (recipeId) {
            const scoped = effectiveRecipeEnabled
              ? resolveRecipeRows(recipeIngredients)
              : null
            if (scoped?.error) return { ok: false, message: scoped.error }

            const changes = recipeChanges(scoped?.rows)
            if (!isEmptyPatch(changes)) {
              const updated = await updateRecipe(recipeId, changes)
              if (!updated.ok) return updated
              changed = true
            }
          } else if (
            effectiveRecipeEnabled &&
            (recipeIngredients.length > 0 ||
              notes.trim() !== "" ||
              recipeCategoryId.trim() !== "") &&
            itemId
          ) {
            const scoped = resolveRecipeRows(recipeIngredients)
            if (scoped.error) return { ok: false, message: scoped.error }

            const created = await createRecipe({
              name: trimmedName,
              description: description.trim() || undefined,
              ...(notes.trim() ? { notes: notes.trim() } : {}),
              categoryId: recipeCategoryId || null,
              ...(scoped.rows.length > 0 ? { ingredients: scoped.rows } : {}),
              itemId,
            })

            if (!created.ok) return created
            recipeId = created.data?.id ?? null
            changed = true
          }
        } else if (recipeId) {
          // Receta sin artículo activo: puede tener un borrador archivado.
          if (article?.isArchived && itemId) {
            const itemUpdate = await updateItemData(itemId, true)
            if (!itemUpdate.ok) return itemUpdate
          }

          const hasItem = Boolean(itemId)
          const scoped = effectiveRecipeEnabled
            ? resolveRecipeRows(
                hasItem
                  ? recipeIngredients
                  : recipeIngredients.filter((row) => !row.variantId)
              )
            : null
          if (scoped?.error) return { ok: false, message: scoped.error }

          const changes = recipeChanges(scoped?.rows)
          if (!isEmptyPatch(changes)) {
            const updated = await updateRecipe(recipeId, changes)
            if (!updated.ok) return updated
            changed = true
          }

          const published = await publishRecipe(recipeId, {
            price: priceBase,
            categoryId: articleCategoryId,
            ...(variants.length > 0 ? { variants } : {}),
          })

          if (!published.ok) return published

          itemId = published.data?.item?.id ?? itemId
          articleVariants = published.data?.item?.variants ?? articleVariants
          changed = true

          if (
            !hasItem &&
            effectiveRecipeEnabled &&
            recipeIngredients.some((row) => row.variantId)
          ) {
            const resolved = resolveRecipeRows(recipeIngredients)
            if (resolved.error) {
              return { ok: false, message: resolved.error }
            }

            const saved = await updateRecipe(recipeId, {
              ingredients: resolved.rows,
            })
            if (!saved.ok) return saved
          }

          if (groupsChanged && itemId) {
            const optionsSaved = await updateArticle(itemId, {
              optionGroups: optionsEnabled
                ? optionGroupPayload(savedGroups)
                : [],
            })
            if (!optionsSaved.ok) return optionsSaved
            changed = true
          }
        } else {
          const created = await createArticle({
            name: trimmedName,
            description: description.trim() || null,
            categoryId: articleCategoryId,
            price: priceBase,
            variants,
            ...(optionsEnabled && savedGroups.length > 0
              ? { optionGroups: optionGroupPayload(savedGroups) }
              : {}),
          })

          if (!created.ok) return created

          itemId = created.data?.id ?? null
          articleVariants = created.data?.variants ?? []
          changed = true

          if (
            effectiveRecipeEnabled &&
            (recipeIngredients.length > 0 ||
              notes.trim() !== "" ||
              recipeCategoryId.trim() !== "") &&
            itemId
          ) {
            const scoped = resolveRecipeRows(recipeIngredients)
            if (scoped.error) return { ok: false, message: scoped.error }

            const createdRecipe = await createRecipe({
              name: trimmedName,
              description: description.trim() || undefined,
              ...(notes.trim() ? { notes: notes.trim() } : {}),
              categoryId: recipeCategoryId || null,
              ...(scoped.rows.length > 0 ? { ingredients: scoped.rows } : {}),
              itemId,
            })

            if (!createdRecipe.ok) return createdRecipe
            recipeId = createdRecipe.data?.id ?? null
          }
        }
      }

      // -------------------------------------------------------------------
      // Guardar como receta
      // -------------------------------------------------------------------
      if (saveAs === "recipe") {
        if (recipeId) {
          if (itemId) {
            const itemUpdate = await updateItemData(itemId, true)
            if (!itemUpdate.ok) return itemUpdate

            const scoped = resolveRecipeRows(recipeIngredients)
            if (scoped.error) return { ok: false, message: scoped.error }

            const changes = recipeChanges(scoped.rows)
            if (!isEmptyPatch(changes)) {
              const updated = await updateRecipe(recipeId, changes)
              if (!updated.ok) return updated
              changed = true
            }

            if (isActiveArticle) {
              const unpublished = await unpublishRecipe(recipeId)
              if (!unpublished.ok) return unpublished
              changed = true
            }
          } else {
            const needsDraft =
              multiple ||
              optionsEnabled ||
              price.trim() !== "" ||
              articleCategoryId.trim() !== ""

            if (needsDraft) {
              const commonRows = recipeIngredients.filter(
                (row) => !row.variantId
              )
              const changes = recipeChanges(commonRows)
              if (!isEmptyPatch(changes)) {
                const updated = await updateRecipe(recipeId, changes)
                if (!updated.ok) return updated
                changed = true
              }

              const draft = await saveRecipeDraftItem(recipeId, {
                ...(price.trim() ? { price: priceBase } : {}),
                ...(articleCategoryId
                  ? { categoryId: articleCategoryId }
                  : {}),
                variants: multiple ? variants : [],
                optionGroups: optionsEnabled
                  ? optionGroupPayload(savedGroups)
                  : [],
              })
              if (!draft.ok) return draft

              itemId = draft.data?.id ?? null
              articleVariants = draft.data?.variants ?? articleVariants
              changed = true

              if (recipeIngredients.some((row) => row.variantId)) {
                const scoped = resolveRecipeRows(recipeIngredients)
                if (scoped.error) {
                  return { ok: false, message: scoped.error }
                }

                const saved = await updateRecipe(recipeId, {
                  ingredients: scoped.rows,
                })
                if (!saved.ok) return saved
              }
            } else {
              const scoped = resolveRecipeRows(recipeIngredients)
              if (scoped.error) return { ok: false, message: scoped.error }

              const changes = recipeChanges(scoped.rows)
              if (!isEmptyPatch(changes)) {
                const updated = await updateRecipe(recipeId, changes)
                if (!updated.ok) return updated
                changed = true
              }
            }
          }
        } else if (itemId) {
          // Artículo existente sin receta: se crea la receta vinculada y se
          // archiva el artículo al guardar como receta.
          const itemUpdate = await updateItemData(itemId, true)
          if (!itemUpdate.ok) return itemUpdate

          const scoped = resolveRecipeRows(recipeIngredients)
          if (scoped.error) return { ok: false, message: scoped.error }

          const created = await createRecipe({
            name: trimmedName,
            description: description.trim() || undefined,
            ...(notes.trim() ? { notes: notes.trim() } : {}),
            categoryId: recipeCategoryId || null,
            ingredients: scoped.rows,
            itemId,
          })

          if (!created.ok) return created

          const createdRecipeId = created.data?.id
          if (!createdRecipeId) {
            return { ok: false, message: "No se pudo crear la receta" }
          }

          recipeId = createdRecipeId
          changed = true

          if (isActiveArticle) {
            const unpublished = await unpublishRecipe(createdRecipeId)
            if (!unpublished.ok) return unpublished
            changed = true
          }
        } else {
          const commonRows = recipeIngredients.filter((row) => !row.variantId)
          const created = await createRecipe({
            name: trimmedName,
            description: description.trim() || undefined,
            ...(notes.trim() ? { notes: notes.trim() } : {}),
            categoryId: recipeCategoryId || null,
            ...(commonRows.length > 0 ? { ingredients: commonRows } : {}),
          })

          if (!created.ok) return created

          const createdRecipeId = created.data?.id
          if (!createdRecipeId) {
            return { ok: false, message: "No se pudo crear la receta" }
          }

          recipeId = createdRecipeId
          changed = true

          if (
            multiple ||
            optionsEnabled ||
            price.trim() !== "" ||
            articleCategoryId.trim() !== ""
          ) {
            const draft = await saveRecipeDraftItem(createdRecipeId, {
              ...(price.trim() ? { price: priceBase } : {}),
              ...(articleCategoryId
                ? { categoryId: articleCategoryId }
                : {}),
              variants: multiple ? variants : [],
              optionGroups: optionsEnabled
                ? optionGroupPayload(savedGroups)
                : [],
            })
            if (!draft.ok) return draft

            itemId = draft.data?.id ?? null
            articleVariants = draft.data?.variants ?? articleVariants
            changed = true

            if (recipeIngredients.some((row) => row.variantId)) {
              const scoped = resolveRecipeRows(recipeIngredients)
              if (scoped.error) {
                return { ok: false, message: scoped.error }
              }

              const saved = await updateRecipe(createdRecipeId, {
                ingredients: scoped.rows,
              })
              if (!saved.ok) return saved
            }
          }
        }
      }

      // -------------------------------------------------------------------
      // Guardar como insumo
      // -------------------------------------------------------------------
      if (saveAs === "ingredient") {
        const produce = {
          displayUnit: yieldUnit,
          yieldQuantity: yieldValue,
          categoryId: ingredientCategoryId,
        }

        if (recipeId) {
          const changes = recipeChanges(recipeIngredients)
          const withProduction: Partial<RecipeInput> = {
            ...changes,
            produce,
          }

          if (!isEmptyPatch(withProduction)) {
            const updated = await updateRecipe(recipeId, withProduction)
            if (!updated.ok) return updated
            changed = true
          }

          if (isActiveArticle) {
            const unpublished = await unpublishRecipe(recipeId)
            if (!unpublished.ok) return unpublished
            changed = true
          }
        } else {
          const created = await createRecipe({
            name: trimmedName,
            description: description.trim() || undefined,
            ...(notes.trim() ? { notes: notes.trim() } : {}),
            categoryId: null,
            ...(article?.id ? { itemId: article.id } : {}),
            ingredients: recipeIngredients,
            produce,
          })

          if (!created.ok) return created

          const createdRecipeId = created.data?.id
          if (!createdRecipeId) {
            return { ok: false, message: "No se pudo crear la receta" }
          }

          recipeId = createdRecipeId
          changed = true

          if (isActiveArticle) {
            const unpublished = await unpublishRecipe(createdRecipeId)
            if (!unpublished.ok) return unpublished
          }
        }
      }

      // -------------------------------------------------------------------
      // Imagen: receta y artículo comparten una sola entrada.
      // -------------------------------------------------------------------
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
            "Guarda el producto antes de subir la imagen."
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

      // -------------------------------------------------------------------
      // Imágenes propias de cada presentación.
      // -------------------------------------------------------------------
      if (multiple && itemId && rows.length > 0) {
        const activeVariants = articleVariants.filter(
          (variant) => variant.isActive
        )

        for (const [index, row] of rows.entries()) {
          const variant = row.variantId
            ? (activeVariants.find(
                (candidate) => candidate.id === row.variantId
              ) ?? activeVariants[index])
            : activeVariants[index]

          if (!variant) continue

          if (row.imageFile) {
            const uploaded = await uploadVariantImage(
              itemId,
              variant.id,
              row.imageFile
            )

            if (!uploaded.ok) {
              imageWarning = [
                imageWarning,
                uploaded.message ??
                  `No se pudo subir la imagen de «${row.name.trim() || "la presentación"}».`,
              ]
                .filter(Boolean)
                .join(" ")
              continue
            }

            const saved = await updateVariant(itemId, variant.id, {
              imageKey: uploaded.key ?? null,
            })

            if (!saved.ok) return saved
            changed = true
            continue
          }

          // Imagen quitada: el PATCH la limpia (y borra el objeto anterior).
          if ((row.imageKey ?? null) !== (variant.imageKey ?? null)) {
            const saved = await updateVariant(itemId, variant.id, {
              imageKey: row.imageKey ?? null,
            })

            if (!saved.ok) return saved
            changed = true
          }
        }
      }

      if (imageWarning) {
        toast.warning(imageWarning)
        router.refresh()
        if (isNew) onSaved?.(saveAs)
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
    saveAs === "combo"
      ? "Se venderá en el punto de venta como un paquete de artículos. Puedes asignarle una promoción opcional."
      : saveAs === "ingredient"
        ? "Se guardará en Inventario como insumo producido y también aparecerá en Recetas. El costo unitario se calcula con el costo de los insumos y el rendimiento."
        : saveAs === "recipe"
          ? "Se guardará como receta y aparecerá en Recetas. Las presentaciones y opciones que configures se conservan para cuando la publiques como artículo."
          : "Se venderá en el punto de venta y podrá usarse en menús. Si activas los insumos de la receta, también aparecerá en Recetas."

  const entityLabel =
    saveAs === "article"
      ? "artículo"
      : saveAs === "recipe"
        ? "receta"
        : saveAs === "combo"
          ? "combo"
          : "insumo";
  const dialogTitle = isNew
    ? saveAs === "recipe"
      ? `Nueva ${entityLabel}`
      : `Nuevo ${entityLabel}`
    : `Editar ${entityLabel}`;

  const saveLabel = `${isNew ? "Crear" : "Guardar"} ${
    saveAs === "article"
      ? "artículo"
      : saveAs === "recipe"
        ? "receta"
        : saveAs === "combo"
          ? "combo"
          : "insumo"
  }`

  const visibleTabs: string[] =
    saveAs === "combo"
      ? comboPromotionType === "NONE"
        ? ["articulos"]
        : ["articulos", "promocion"]
      : saveAs === "ingredient"
        ? ["receta", "notas"]
        : [
            "presentaciones",
            "opciones",
            "receta",
            ...(notesVisible ? ["notas"] : []),
          ]
  const activeTab = visibleTabs.includes(dialogTab)
    ? dialogTab
    : visibleTabs[0]

  // Los chips de alcance viven dentro del switch de Receta: sin captura activa
  // no tiene sentido elegir a qué presentación pertenece cada insumo.
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
      <DialogContent className="max-h-[90vh] overflow-hidden p-0! sm:max-w-3xl">
        <div className="scroll-fade-y no-scrollbar max-h-[90vh] overflow-y-auto p-6">
          <div className="grid gap-6">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{descriptionText}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Grupo superior: imagen a la izquierda; chip, nombre, precio y categoría. */}
          <div className="grid gap-4 sm:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
            <ImageDropzone
              url={image?.url ?? null}
              onSelect={handleSelectImage}
              onRemove={handleRemoveImage}
              disabled={form.pending}
            />

            <div className="flex flex-col gap-3">
              <fieldset className="min-w-0 rounded-lg border border-dashed px-2 pt-1 pb-2">
                <legend className="px-1 text-[10px] font-medium text-muted-foreground">
                  Guardar como
                </legend>
                <div className="flex flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-1">
                    {SAVE_AS_OPTIONS.map((option) => {
                      const Icon = option.icon
                      return (
                        <Button
                          key={option.value}
                          type="button"
                          variant="outline"
                          size="sm"
                          aria-pressed={saveAs === option.value}
                          disabled={
                            form.pending ||
                            (locked && option.value !== "ingredient") ||
                            (isComboProduct && option.value !== "combo")
                          }
                          className={saveAsChipClass(saveAs === option.value)}
                          onClick={() => handleSaveAsChange(option.value)}
                        >
                          <Icon className="size-3.5" />
                          {option.label}
                        </Button>
                      )
                    })}
                  </div>
                  {locked ? (
                    <p className="text-xs text-muted-foreground">
                      Un insumo no puede convertirse en artículo ni receta.
                    </p>
                  ) : isComboProduct ? (
                    <p className="text-xs text-muted-foreground">
                      Un combo no puede convertirse en artículo, receta ni insumo.
                    </p>
                  ) : saveAs === "ingredient" ? (
                    <p className="text-xs text-muted-foreground">
                      Una vez creado, un insumo no puede convertirse en artículo
                      ni receta.
                    </p>
                  ) : null}
                </div>
              </fieldset>

              <Field
                data-invalid={invalidFields.has("name") ? "true" : undefined}
              >
                <FieldLabel htmlFor="product-name">
                  Nombre <span className="text-destructive">*</span>
                </FieldLabel>
                <Input
                  id="product-name"
                  value={name}
                  maxLength={120}
                  aria-invalid={invalidFields.has("name") || undefined}
                  onChange={(event) => handleNameChange(event.target.value)}
                  placeholder={
                    saveAs === "article"
                      ? "Ej. Café americano"
                      : saveAs === "recipe"
                        ? "Ej. Salsa verde"
                        : saveAs === "combo"
                          ? "Ej. Combo chilaquiles + café"
                          : "Ej. Salsa verde"
                  }
                />
              </Field>

              <div className="grid gap-3 sm:grid-cols-2">
                {priceVisible ? (
                  <Field
                    data-invalid={
                      invalidFields.has("price") ? "true" : undefined
                    }
                  >
                    <div className="flex items-center gap-1.5">
                      <FieldLabel htmlFor="product-price">
                        Precio{" "}
                        {priceRequired ? (
                          <span className="text-destructive">*</span>
                        ) : null}
                      </FieldLabel>
                      <InfoHint
                        text={
                          saveAs === "combo"
                            ? "Precio normal del combo, con IVA incluido. La promoción puede reemplazarlo temporalmente."
                            : priceRequired
                              ? "Precio final con IVA incluido. Con varias presentaciones, es el de la presentación principal."
                              : "Opcional. Si lo indicas, se conserva para cuando publiques la receta como artículo."
                        }
                      />
                      {saveAs === "combo" ? (
                        <div className="ml-auto flex items-center gap-1.5">
                          <Label
                            htmlFor="product-price-auto"
                            className="text-xs text-muted-foreground"
                          >
                            Auto
                          </Label>
                          <Switch
                            id="product-price-auto"
                            checked={comboPriceAuto}
                            onCheckedChange={handleComboPriceAuto}
                            disabled={form.pending}
                          />
                        </div>
                      ) : null}
                    </div>
                    <InputGroup>
                      <InputGroupAddon align="inline-start">
                        <InputGroupText>$</InputGroupText>
                      </InputGroupAddon>
                      <InputGroupInput
                        id="product-price"
                        type="number"
                        min="0"
                        step="0.01"
                        value={
                          saveAs === "combo" && comboPriceAuto
                            ? comboAutoPriceString
                            : price
                        }
                        disabled={saveAs === "combo" && comboPriceAuto}
                        aria-invalid={invalidFields.has("price") || undefined}
                        onChange={(event) => {
                          clearInvalid("price")
                          setPrice(event.target.value)
                        }}
                        placeholder="0.00"
                      />
                      <InputGroupAddon align="inline-end">
                        <InputGroupText>MXN</InputGroupText>
                      </InputGroupAddon>
                    </InputGroup>
                  </Field>
                ) : null}

                {yieldVisible ? (
                  <Field
                    data-invalid={
                      invalidFields.has("yield") ? "true" : undefined
                    }
                  >
                    <div className="flex items-center gap-1.5">
                      <FieldLabel htmlFor="product-yield">Rendimiento</FieldLabel>
                      <InfoHint text="Cantidad de insumo que produce un lote de la receta." />
                    </div>
                    <div className="flex items-stretch gap-2">
                      <Input
                        id="product-yield"
                        type="number"
                        min="0.0001"
                        step="any"
                        value={yieldQuantity}
                        aria-invalid={invalidFields.has("yield") || undefined}
                        onChange={(event) => {
                          clearInvalid("yield")
                          setYieldQuantity(event.target.value)
                        }}
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

                {saveAs === "combo" ? (
                  <Field>
                    <FieldLabel htmlFor="product-promotion">Promoción</FieldLabel>
                    <Select
                      value={comboPromotionType}
                      onValueChange={(value) => {
                        const next = (value ?? "NONE") as
                          | "NONE"
                          | PromotionType
                        setComboPromotionType(next)
                        if (next === "NONE") {
                          setDialogTab("articulos")
                        } else {
                          setDialogTab("promocion")
                        }
                        if (next !== "FREE_ITEM") setComboFreeKey("")
                        if (next !== "SECOND_HALF_PRICE") setComboSecondKey("")
                      }}
                      items={COMBO_PROMOTION_OPTIONS.map((option) => ({
                        value: option.value,
                        label: option.label,
                      }))}
                    >
                      <SelectTrigger id="product-promotion" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COMBO_PROMOTION_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                ) : (
                  <Field
                    data-invalid={
                      invalidFields.has("category") ? "true" : undefined
                    }
                  >
                    <FieldLabel htmlFor="product-category">
                      {categoryLabel}{" "}
                      <span className="text-destructive">*</span>
                    </FieldLabel>
                    <Select
                      value={categoryValue || null}
                      onValueChange={(value) => setCategoryValue(value ?? "")}
                      items={categoryOptions.map((category) => ({
                        value: category.id,
                        label: category.name,
                      }))}
                    >
                      <SelectTrigger
                        id="product-category"
                        className="w-full"
                        aria-invalid={
                          invalidFields.has("category") || undefined
                        }
                      >
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
                )}

              </div>
            </div>
          </div>

          <Field>
            <FieldLabel htmlFor="product-description">Descripción</FieldLabel>
            <Textarea
              id="product-description"
              value={description}
              maxLength={500}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={
                saveAs === "article"
                  ? "Ej. Café espresso con leche vaporizada y un toque de canela."
                  : saveAs === "recipe"
                    ? "Ej. Salsa de tomate cocida a fuego lento con albahaca fresca."
                    : saveAs === "combo"
                      ? "Ej. Chilaquiles verdes con café y postre."
                      : "Ej. Tomate rojo fresco para salsas y guisos."
              }
            />
            {saveAs === "article" ? (
              <p className="text-xs text-muted-foreground">
                El SKU se genera solo a partir de la categoría.
              </p>
            ) : null}
          </Field>

          <Separator />

          <Tabs value={activeTab} onValueChange={setDialogTab} className="gap-4">
            <TabsList>
              {saveAs === "combo" ? (
                <>
                  <TabsTrigger type="button" value="articulos">
                    Artículos del combo
                  </TabsTrigger>
                  {comboPromotionType !== "NONE" ? (
                    <TabsTrigger type="button" value="promocion">
                      Promoción
                    </TabsTrigger>
                  ) : null}
                </>
              ) : (
                <>
                  {saveAs !== "ingredient" ? (
                    <TabsTrigger type="button" value="presentaciones">
                      Presentaciones
                    </TabsTrigger>
                  ) : null}
                  {saveAs !== "ingredient" ? (
                    <TabsTrigger type="button" value="opciones">
                      Opciones
                    </TabsTrigger>
                  ) : null}
                  <TabsTrigger type="button" value="receta">
                    Receta
                  </TabsTrigger>
                  {notesVisible ? (
                    <TabsTrigger type="button" value="notas">
                      Notas
                    </TabsTrigger>
                  ) : null}
                </>
              )}
            </TabsList>

            {saveAs === "combo" ? (
              <>
                <TabsContent value="articulos" keepMounted>
                  <ComboComponentsPicker
                    products={products}
                    value={comboComponents}
                    onChange={setComboComponents}
                    disabled={form.pending}
                  />
                </TabsContent>

                {comboPromotionType !== "NONE" ? (
                  <TabsContent value="promocion" keepMounted>
                    <ComboPromotionFields
                      type={comboPromotionType}
                      active={comboPromotionActive}
                      onActiveChange={setComboPromotionActive}
                      payQuantity={comboPayQuantity}
                      onPayQuantityChange={setComboPayQuantity}
                      getQuantity={comboGetQuantity}
                      onGetQuantityChange={setComboGetQuantity}
                      percent={comboPercent}
                      onPercentChange={setComboPercent}
                      fixed={comboFixed}
                      onFixedChange={setComboFixed}
                      specialPrice={comboSpecialPrice}
                      onSpecialPriceChange={setComboSpecialPrice}
                      freeKey={
                        comboComponentOptions.some(
                          (option) => option.key === comboFreeKey
                        )
                          ? comboFreeKey
                          : ""
                      }
                      onFreeKeyChange={setComboFreeKey}
                      secondKey={
                        comboComponentOptions.some(
                          (option) => option.key === comboSecondKey
                        )
                          ? comboSecondKey
                          : ""
                      }
                      onSecondKeyChange={setComboSecondKey}
                      components={comboComponentOptions}
                      disabled={form.pending}
                    />
                  </TabsContent>
                ) : null}
              </>
            ) : (
              <>

            <TabsContent value="receta" keepMounted>
              <section className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <Label
                      htmlFor="product-recipe"
                      className="text-sm font-medium"
                    >
                      Insumos de la receta
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Los insumos comunes se descuentan en todas las
                      presentaciones; los de una presentación solo en esa.
                    </p>
                  </div>
                  {saveAs === "article" ? (
                    <Switch
                      id="product-recipe"
                      checked={recipeEnabled}
                      disabled={form.pending}
                      onCheckedChange={handleRecipeChange}
                    />
                  ) : null}
                </div>

                {effectiveRecipeEnabled ? recipeScopesFieldset : null}

                {effectiveRecipeEnabled ? (
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

            {notesVisible ? (
              <TabsContent value="notas" keepMounted>
                <section className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1">
                    <Label
                      htmlFor="product-notes"
                      className="text-sm font-medium"
                    >
                      Notas
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Notas de preparación, tiempos, temperaturas o
                      conservación. No se muestran al cliente.
                    </p>
                  </div>
                  <Textarea
                    id="product-notes"
                    value={notes}
                    maxLength={2000}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Ej. Cocinar a fuego medio 8 min; conservar en refrigeración hasta 3 días."
                  />
                </section>
              </TabsContent>
            ) : null}

            {saveAs !== "ingredient" ? (
              <TabsContent value="presentaciones" keepMounted>
                <section className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      <Label
                        htmlFor="product-multiple"
                        className="text-sm font-medium"
                      >
                        Múltiples presentaciones
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Crea más presentaciones y elige cuál es la principal. Si
                        no indicas un precio propio, cada presentación conserva
                        el de la principal.
                      </p>
                    </div>
                    <Switch
                      id="product-multiple"
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
                      showRecipeFactor={effectiveRecipeEnabled}
                      fallbackImageUrl={image?.url ?? null}
                      disabled={form.pending}
                    />
                  ) : null}
                </section>
              </TabsContent>
            ) : null}

            {saveAs !== "ingredient" ? (
              <TabsContent value="opciones" keepMounted>
                <section className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      <Label
                        htmlFor="product-options"
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
                      id="product-options"
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
                      taxRate={article?.taxRate ?? taxRate}
                      effectsEnabled={effectiveRecipeEnabled}
                      hideHeader
                    />
                  ) : null}
                </section>
              </TabsContent>
            ) : null}
              </>
            )}
          </Tabs>

          {form.error ? <FieldError>{form.error}</FieldError> : null}
        </div>

        <DialogFooter>
          {isNew ? (
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
            {saveLabel}
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
                Se desactivarán las presentaciones actuales del producto.
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
                Se quitarán los grupos configurados de este producto. Los grupos
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
          open={pendingSaveAs !== null}
          onOpenChange={(next) => {
            if (!next) setPendingSaveAs(null)
          }}
        >
          <AlertDialogContent size="sm">
            <AlertDialogHeader>
              <AlertDialogMedia className="bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive">
                <TriangleAlertIcon />
              </AlertDialogMedia>
              <AlertDialogTitle>
                Guardar como{" "}
                {pendingSaveAs === "recipe" ? "receta" : "insumo"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                El producto saldrá del catálogo de artículos y de los menús. La
                receta, sus presentaciones y sus opciones se conservan, y podrás
                volver a publicarlo como artículo.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => {
                  if (pendingSaveAs) applySaveAs(pendingSaveAs)
                }}
              >
                Continuar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
