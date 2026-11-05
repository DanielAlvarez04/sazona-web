import {
  PROMOTION_TYPE_LABELS,
  type ArticleListItem,
  type ComboComponent,
  type ComboPromotion,
  type Recipe,
} from "@/lib/catalog"

/** Precio unitario de un componente (artículo + presentación). */
export function comboComponentPrice(component: ComboComponent): number {
  return (
    Number(component.componentItem.price) +
    Number(component.variant?.priceAdjust ?? 0)
  )
}

function recipeCostMap(recipes: Recipe[]) {
  const base = new Map<string, Recipe>()
  const variants = new Map<string, Recipe>()

  for (const recipe of recipes) {
    if (!recipe.itemId) continue

    const key = `${recipe.itemId}:${recipe.variantId ?? ""}`
    if (recipe.variantId) variants.set(key, recipe)
    else base.set(recipe.itemId, recipe)
  }

  return { base, variants }
}

/**
 * Costo real del combo: suma del costo de cada componente por su cantidad.
 * Devuelve `null` si algún componente no tiene costo calculable.
 */
export function comboCost(
  combo: ArticleListItem,
  recipes: Recipe[]
): number | null {
  const components = combo.comboComponents ?? []
  if (components.length === 0) return null

  const costs = recipeCostMap(recipes)
  let total = 0

  for (const component of components) {
    const itemId = component.componentItem.id
    const variantId = component.variant?.id ?? ""
    const exactVariantRecipe = variantId
      ? (costs.variants.get(`${itemId}:${variantId}`) ?? null)
      : null
    const recipe =
      exactVariantRecipe ??
      costs.base.get(itemId) ??
      (variantId ? (costs.variants.get(`${itemId}:${variantId}`) ?? null) : null)

    if (!recipe) return null

    let costPerUnit =
      recipe.estimatedCost === null ? null : Number(recipe.estimatedCost)

    if (!exactVariantRecipe && variantId) {
      const variantCost = recipe.variantCosts?.find(
        (candidate) => candidate.variantId === variantId
      )?.estimatedCost

      if (variantCost !== null && variantCost !== undefined) {
        costPerUnit = Number(variantCost)
      }
    }

    if (costPerUnit === null) return null

    total += costPerUnit * component.quantity
  }

  return total
}

export interface ComboPricing {
  normal: number
  effective: number
  promotion: ComboPromotion | null
  /** Descuento unitario respecto al precio normal. */
  discount: number
}

/**
 * Precio efectivo del combo. Para 2x1/3x2 se usa el promedio por unidad del
 * grupo de la promoción.
 *
 * El IVA ya está incluido en los precios de los artículos del combo: ni el
 * costo ni el margen vuelven a descontarlo.
 */
export function comboPricing(combo: ArticleListItem): ComboPricing {
  const normal = Number(combo.price)
  const promotion = combo.promotions?.[0] ?? null
  const empty: ComboPricing = {
    normal,
    effective: normal,
    promotion,
    discount: 0,
  }

  if (!promotion?.isActive || normal <= 0) return empty

  const components = combo.comboComponents ?? []
  const componentPrice = (itemId: string | null, variantId: string | null) => {
    if (!itemId) return null

    const component = components.find(
      (candidate) =>
        candidate.componentItem.id === itemId &&
        (candidate.variant?.id ?? null) === (variantId ?? null)
    )

    return component ? comboComponentPrice(component) : null
  }

  let effective = normal

  switch (promotion.type) {
    case "PERCENT":
      effective = normal * (1 - Number(promotion.value) / 100)
      break
    case "FIXED":
      effective = normal - Number(promotion.value)
      break
    case "SPECIAL_PRICE":
      effective = Number(promotion.specialPrice ?? normal)
      break
    case "BOGO": {
      effective = normal / 2
      break
    }
    case "PAY_X_GET_Y": {
      const pay = promotion.payQuantity ?? 1
      const receive = promotion.getQuantity ?? 2
      if (pay > 0 && receive > 0) {
        effective = (normal * pay) / receive
      }
      break
    }
    case "FREE_ITEM": {
      const price = componentPrice(
        promotion.freeItemId,
        promotion.freeVariantId
      )
      if (price !== null) effective = normal - price
      break
    }
    case "SECOND_HALF_PRICE": {
      const price = componentPrice(
        promotion.discountedItemId,
        promotion.discountedVariantId
      )
      if (price !== null) effective = normal - price / 2
      break
    }
  }

  effective = Math.min(normal, Math.max(0, effective))

  return {
    normal,
    effective,
    promotion,
    discount: normal - effective,
  }
}

export function promotionLabel(promotion: ComboPromotion | null): string {
  if (!promotion) return "Ninguna"
  return PROMOTION_TYPE_LABELS[promotion.type]
}
