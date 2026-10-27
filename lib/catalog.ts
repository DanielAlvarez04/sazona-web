export type UnitDimension = "MASS" | "VOLUME" | "COUNT"

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
  { code: "TSP", symbol: "tsp", name: "cucharadita estándar", dimension: "VOLUME", factor: 5 },
  { code: "TBSP", symbol: "tbsp", name: "cucharada estándar", dimension: "VOLUME", factor: 15 },
  { code: "CUP", symbol: "cup", name: "taza métrica", dimension: "VOLUME", factor: 250 },
  { code: "FL_OZ", symbol: "fl oz", name: "onza líquida estadounidense", dimension: "VOLUME", factor: 29.5735295625 },
  { code: "GAL", symbol: "gal", name: "galón estadounidense", dimension: "VOLUME", factor: 3785.411784 },

  // Conteo (base: pieza)
  { code: "UNIT", symbol: "pieza", name: "pieza", dimension: "COUNT", factor: 1 },
  { code: "HALF_PIECE", symbol: "½ pieza", name: "media pieza", dimension: "COUNT", factor: 0.5 },
  { code: "PAIR", symbol: "par", name: "par", dimension: "COUNT", factor: 2 },
  { code: "HALF_DOZEN", symbol: "½ docena", name: "media docena", dimension: "COUNT", factor: 6 },
  { code: "DOZEN", symbol: "docena", name: "docena", dimension: "COUNT", factor: 12 },
]

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

export interface Category {
  id: string
  name: string
  description: string | null
  isActive: boolean
  sortOrder: number
  _count: { products: number }
}

export interface Variant {
  id: string
  name: string
  priceAdjust: string
  isActive: boolean
  sortOrder: number
}

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

export interface ProductListItem {
  id: string
  name: string
  description: string | null
  sku: string | null
  price: string
  taxRate: string | null
  isActive: boolean
  isCombo: boolean
  sortOrder: number
  category: { id: string; name: string } | null
  variants: Variant[]
  extras: Extra[]
  ingredientExclusions: Exclusion[]
  _count: { recipes: number }
}

export interface Exclusion {
  id: string
  label: string | null
  ingredient: { id: string; name: string; baseUnit: UnitCode }
}

export interface ComboComponent {
  id: string
  quantity: number
  component: { id: string; name: string; price: string; isActive: boolean }
  variant: { id: string; name: string } | null
}

export interface RecipeIngredient {
  id: string
  quantity: string
  ingredient: {
    id: string
    name: string
    baseUnit: UnitCode
    currentStock?: string
  }
}

export interface Recipe {
  id: string
  name: string
  isActive: boolean
  variantId: string | null
  variant: { id: string; name: string } | null
  ingredients: RecipeIngredient[]
  canComputeConsumption?: boolean
}

export interface ProductDetail extends ProductListItem {
  extras: Extra[]
  ingredientExclusions: Exclusion[]
  comboComponents: ComboComponent[]
  recipes: Recipe[]
}

export interface Ingredient {
  id: string
  name: string
  sku: string | null
  baseUnit: UnitCode
  currentStock: string
  minStock: string
  maxStock: string | null
  unitCost: string | null
  isActive: boolean
  isLowStock: boolean
  deficit: string
  category: { id: string; name: string; isCore: boolean } | null
  location: { id: string; name: string; isCore: boolean } | null
  _count?: { recipeIngredients: number }
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

export type MovementType = "ADJUSTMENT" | "CONSUMPTION" | "RETURN"

export interface InventoryMovement {
  id: string
  type: MovementType
  quantity: string
  stockAfter: string | null
  reason: string | null
  referenceType: string | null
  createdAt: string
  ingredient: { id: string; name: string; baseUnit: UnitCode }
  /** `null` cuando la cuenta que registró el movimiento ya no existe. */
  user: { id: string; name: string | null; email: string | null } | null
}

export const MOVEMENT_LABELS: Record<MovementType, string> = {
  ADJUSTMENT: "Ajuste",
  CONSUMPTION: "Consumo",
  RETURN: "Devolución",
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
