export type UnitDimension = "MASS" | "VOLUME" | "COUNT"

/** Estrategia para resolver insumos repetidos al importar un CSV. */
export type ImportIngredientsMode = "exclude" | "duplicate" | "overwrite"

export type UnitCode =
  | "MG"
  | "G"
  | "KG"
  | "OZ"
  | "LB"
  | "ML"
  | "L"
  | "TSP"
  | "TBSP"
  | "CUP"
  | "FL_OZ"
  | "GAL"
  | "UNIT"
  | "HALF_PIECE"
  | "PAIR"
  | "HALF_DOZEN"
  | "DOZEN"

export interface UnitDefinition {
  code: UnitCode
  /** Símbolo corto que acompaña a las cantidades (g, tsp, pieza). */
  symbol: string
  /** Nombre completo en español. */
  name: string
  dimension: UnitDimension
  /** Cuántas unidades base de la dimensión (g, ml, pieza) representa 1 unidad. */
  factor: number
}

/**
 * Catálogo fijo de unidades de consumo. No se edita desde la aplicación:
 * las equivalencias dentro de una dimensión son estándar. Las conversiones
 * entre dimensiones se configuran por ingrediente en Inventario.
 */
export const UNIT_DEFINITIONS: UnitDefinition[] = [
  // Masa (base: gramo)
  { code: "MG", symbol: "mg", name: "miligramo", dimension: "MASS", factor: 0.001 },
  { code: "G", symbol: "g", name: "gramo", dimension: "MASS", factor: 1 },
  { code: "KG", symbol: "kg", name: "kilogramo", dimension: "MASS", factor: 1000 },
  { code: "OZ", symbol: "oz", name: "onza de masa", dimension: "MASS", factor: 28.349523125 },
  { code: "LB", symbol: "lb", name: "libra", dimension: "MASS", factor: 453.59237 },

  // Volumen (base: mililitro)
  { code: "ML", symbol: "ml", name: "mililitro", dimension: "VOLUME", factor: 1 },
  { code: "L", symbol: "L", name: "litro", dimension: "VOLUME", factor: 1000 },
  { code: "TSP", symbol: "tsp", name: "cucharadita", dimension: "VOLUME", factor: 5 },
  { code: "TBSP", symbol: "tbsp", name: "cucharada", dimension: "VOLUME", factor: 15 },
  { code: "CUP", symbol: "cup", name: "taza", dimension: "VOLUME", factor: 250 },
  { code: "FL_OZ", symbol: "fl oz", name: "onza líquida", dimension: "VOLUME", factor: 29.5735295625 },
  { code: "GAL", symbol: "gal", name: "galón", dimension: "VOLUME", factor: 3785.411784 },

  // Conteo (base: pieza)
  { code: "UNIT", symbol: "pz", name: "pieza", dimension: "COUNT", factor: 1 },
  { code: "HALF_PIECE", symbol: "½ pz", name: "media pieza", dimension: "COUNT", factor: 0.5 },
  { code: "PAIR", symbol: "par", name: "par", dimension: "COUNT", factor: 2 },
  { code: "HALF_DOZEN", symbol: "½ docena", name: "media docena", dimension: "COUNT", factor: 6 },
  { code: "DOZEN", symbol: "docena", name: "docena", dimension: "COUNT", factor: 12 },
]

/** Unidades de la misma dimensión que `unit`. */
export function unitsOfDimension(unit: UnitCode): UnitDefinition[] {
  const dimension = UNIT_DEFINITIONS.find((item) => item.code === unit)?.dimension
  return UNIT_DEFINITIONS.filter((item) => item.dimension === dimension)
}

/**
 * Convierte una cantidad entre unidades de la misma dimensión.
 * Devuelve `null` si alguna unidad no existe o la dimensión no coincide.
 */
export function convertUnitValue(
  value: number,
  from: UnitCode,
  to: UnitCode
): number | null {
  const source = UNIT_DEFINITIONS.find((item) => item.code === from)
  const target = UNIT_DEFINITIONS.find((item) => item.code === to)

  if (!source || !target || source.dimension !== target.dimension) return null

  return roundQuantity((value * source.factor) / target.factor)
}

/** Redondea a la escala de la base de datos (4 decimales). */
export function roundQuantity(value: number): number {
  return Math.round((value + Number.EPSILON) * 10000) / 10000
}

export const UNIT_LABELS: Record<UnitCode, string> = Object.fromEntries(
  UNIT_DEFINITIONS.map((unit) => [unit.code, unit.symbol])
) as Record<UnitCode, string>

export const UNIT_CODES: UnitCode[] = UNIT_DEFINITIONS.map((unit) => unit.code)

/** Opciones planas para el prop `items` de los Select de Base UI. */
export const UNIT_SELECT_ITEMS = UNIT_DEFINITIONS.map((unit) => ({
  value: unit.code,
  label: unit.symbol,
}))

/** Unidades agrupadas por dimensión, en el orden del catálogo. */
export const UNIT_GROUPS: Array<{
  dimension: UnitDimension
  label: string
  baseSymbol: string
  units: UnitDefinition[]
}> = [
  {
    dimension: "MASS",
    label: "Masa",
    baseSymbol: "g",
    units: UNIT_DEFINITIONS.filter((unit) => unit.dimension === "MASS"),
  },
  {
    dimension: "VOLUME",
    label: "Volumen",
    baseSymbol: "ml",
    units: UNIT_DEFINITIONS.filter((unit) => unit.dimension === "VOLUME"),
  },
  {
    dimension: "COUNT",
    label: "Conteo",
    baseSymbol: "pieza",
    units: UNIT_DEFINITIONS.filter((unit) => unit.dimension === "COUNT"),
  },
]

export type CategoryKind = "ARTICLE" | "RECIPE"

export interface Category {
  id: string
  /** Identificador estable de las categorías core (breakfast, sauces…). */
  code: string | null
  name: string
  description: string | null
  isCore: boolean
  kind: CategoryKind
  isActive: boolean
  sortOrder: number
  _count: { items?: number; recipes?: number }
}

export interface Variant {
  id: string
  name: string
  /** SKU propio: el del artículo más el sufijo de la presentación (XVA101A). */
  sku: string | null
  /** Presentación que el menú muestra por defecto. */
  isPrimary: boolean
  priceAdjust: string
  /** Multiplicador del consumo de la receta base. Regular = 1. */
  recipeFactor: string
  isActive: boolean
  sortOrder: number
}

/** Presentaciones base sugeridas al publicar una receta como artículo. */
export const PRESENTATION_PRESETS: Array<{
  name: string
  recipeFactor: string
}> = [
  { name: "Chico", recipeFactor: "0.8" },
  { name: "Regular", recipeFactor: "1" },
  { name: "Grande", recipeFactor: "1.3" },
]

export interface Unit {
  code: UnitCode
  label: string
  name: string
  dimension: UnitDimension
  factor: string
}

export interface ExtraIngredient {
  id: string
  quantity: string
  ingredient: {
    id: string
    name: string
    baseUnit: UnitCode
    displayUnit: UnitCode
    currentStock?: string
  }
}

export interface Extra {
  id: string
  name: string
  price: string
  isActive: boolean
  ingredients?: ExtraIngredient[]
}

export interface ItemListItem {
  id: string
  name: string
  description: string | null
  sku: string | null
  /** Clave del objeto en R2; se usa para reemplazar o quitar la imagen. */
  imageKey: string | null
  /** URL pública de la imagen en R2. */
  imageUrl: string | null
  /**
   * Nombre legible de la imagen (`snap` + nombre normalizado + fecha). En R2
   * el objeto va hasheado; esto es solo referencia para la futura galería.
   */
  imageName: string | null
  price: string
  taxRate: string | null
  isActive: boolean
  isCombo: boolean
  sortOrder: number
  category: { id: string; name: string } | null
  variants: Variant[]
  extras: Extra[]
  ingredientExclusions: Exclusion[]
  recipes?: Array<{
    id: string
    name: string
    variantId: string | null
    isActive: boolean
  }>
  _count: { recipes: number }
}

export interface Exclusion {
  id: string
  label: string | null
  ingredient: { id: string; name: string; baseUnit: UnitCode; displayUnit: UnitCode }
}

export interface ComboComponent {
  id: string
  quantity: number
  componentItem: { id: string; name: string; price: string; isActive: boolean }
  variant: { id: string; name: string } | null
}

export interface RecipeIngredientRef {
  id: string
  name: string
  baseUnit: UnitCode
  displayUnit: UnitCode
  currentStock?: string
  unitCost?: string | null
  isActive?: boolean
}

export interface RecipeIngredient {
  id: string
  quantity: string
  label: string | null
  isOptional: boolean
  sortOrder: number
  ingredient: RecipeIngredientRef
  options: RecipeIngredientOption[]
}

export interface RecipeIngredientOption {
  id: string
  quantity: string
  sortOrder: number
  ingredient: RecipeIngredientRef
}

export interface Recipe {
  id: string
  name: string
  description: string | null
  isActive: boolean
  itemId: string | null
  variantId: string | null
  variant?: { id: string; name: string } | null
  categoryId: string | null
  category: { id: string; name: string } | null
  item: {
    id: string
    name: string
    sku: string | null
    price: string
    isActive: boolean
  } | null
  producesIngredientId: string | null
  producesIngredient: RecipeIngredientRef | null
  yieldQuantity: string | null
  yieldUnit: UnitCode | null
  ingredients: RecipeIngredient[]
  /** Costo estimado del lote con los insumos default (en MXN). */
  estimatedCost: string | null
  hasCompleteCost: boolean
  canComputeConsumption?: boolean
}

export interface ItemDetail extends ItemListItem {
  extras: Extra[]
  ingredientExclusions: Exclusion[]
  comboComponents: ComboComponent[]
  recipes: Recipe[]
}

/** Alias semántico: en la UI un `Product` del catálogo es un artículo. */
export type ArticleListItem = ItemListItem
export type ArticleDetail = ItemDetail

export interface Ingredient {
  id: string
  name: string
  sku: string | null
  /** Unidad canónica de almacenamiento (G, ML o UNIT). */
  baseUnit: UnitCode
  /** Unidad con la que se muestran y capturan las cantidades. */
  displayUnit: UnitCode
  /** Existencia en la sucursal activa (o el total si no hay sucursal). */
  currentStock: string
  /** Existencia total de la organización (sólo con sucursal activa). */
  organizationStock?: string
  /** Sucursal de la vista actual; `null` = Modo Global (todas las sucursales). */
  branchId?: string | null
  /**
   * Stock por sucursal en la unidad visible. Solo llega con
   * `includeBranchStocks`; lo usa el resumen en Modo Global.
   */
  branchStocks?: Array<{
    branchId: string
    branch?: { id: string; name: string }
    quantity: string
  }>
  minStock: string
  maxStock: string | null
  unitCost: string | null
  isActive: boolean
  isLowStock: boolean
  deficit: string
  category: { id: string; name: string; isCore: boolean } | null
  location: { id: string; name: string; isCore: boolean } | null
  /** `inventoryMovements` cuenta solo los movimientos que bloquean el cambio
   *  de unidad base (excluye el alta con stock inicial). */
  _count?: { recipeIngredients: number; inventoryMovements?: number }
}

export interface IngredientVariant {
  id: string
  name: string
  sku: string
  sequence: number
  unitCost: string | null
  minStock: string
  maxStock: string | null
  isActive: boolean
}

export interface IngredientCategory {
  id: string
  name: string
  description: string | null
  isCore: boolean
  isActive: boolean
  sortOrder: number
}

export interface IngredientLocation {
  id: string
  name: string
  description: string | null
  isCore: boolean
  isActive: boolean
  sortOrder: number
}

export interface StockAlert {
  id: string
  name: string
  baseUnit: UnitCode
  displayUnit: UnitCode
  currentStock: string
  minStock: string
  deficit: string
}

export interface Equivalence {
  id: string
  fromUnit: UnitCode
  toUnit: UnitCode
  factor: string
  note: string | null
}

export type MovementType = "ADJUSTMENT" | "CONSUMPTION" | "RETURN" | "PRODUCTION"

export interface InventoryMovement {
  id: string
  type: MovementType
  quantity: string
  stockAfter: string | null
  reason: string | null
  referenceType: string | null
  createdAt: string
  /** Nombre del insumo en el momento del movimiento (snapshot). */
  ingredientName: string
  /** Unidad visible del insumo en ese momento. */
  displayUnit: UnitCode
  /** `null` si el producto se eliminó; el kardex se conserva. */
  ingredient: {
    id: string
    name: string
    baseUnit: UnitCode
    displayUnit: UnitCode
  } | null
  /** Sucursal afectada; `null` = movimiento consolidado de la organización. */
  branch?: { id: string; name: string } | null
  /** `null` cuando la cuenta que registró el movimiento ya no existe. */
  user: { id: string; name: string | null; email: string | null } | null
}

export const MOVEMENT_LABELS: Record<MovementType, string> = {
  ADJUSTMENT: "Ajuste",
  CONSUMPTION: "Consumo",
  RETURN: "Devolución",
  PRODUCTION: "Producción",
}

export interface ImportRowError {
  row: number
  column?: string
  message: string
}

export interface ImportResult {
  dryRun: boolean
  totalRows: number
  created: number
  updated: number
  skipped: number
  errors: ImportRowError[]
}

export function canManageCatalog(roles: string[]): boolean {
  return roles.includes("ADMIN") || roles.includes("INVENTORY_MANAGER")
}

export function canManageInventory(roles: string[]): boolean {
  return canManageCatalog(roles)
}

export function unitLabel(unit: UnitCode): string {
  return UNIT_LABELS[unit] ?? unit
}

const moneyFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
})

const quantityFormatter = new Intl.NumberFormat("es-MX", {
  maximumFractionDigits: 4,
})

const dateTimeFormatter = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "medium",
  timeStyle: "short",
})

const timeFormatter = new Intl.DateTimeFormat("es-MX", {
  hour: "2-digit",
  minute: "2-digit",
})

/** Solo la hora (`10:32`), para las líneas de tiempo de cocina. */
export function formatTime(value: string): string {
  return timeFormatter.format(new Date(value))
}

export function formatMoney(value: string | number): string {
  return moneyFormatter.format(Number(value))
}

export function formatQuantity(value: string | number): string {
  return quantityFormatter.format(Number(value))
}

export function formatPercent(value: string | null): string {
  if (value === null) return "Sin IVA"
  return `${quantityFormatter.format(Number(value) * 100)} %`
}

export function formatDateTime(value: string): string {
  return dateTimeFormatter.format(new Date(value))
}



