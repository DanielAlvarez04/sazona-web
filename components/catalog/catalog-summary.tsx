"use client"

import * as React from "react"
import {
  CircleDollarSignIcon,
  FlaskConicalIcon,
  PackageIcon,
  PercentIcon,
  TagsIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  formatMarginPercent,
  formatMoney,
  type ArticleListItem,
  type Recipe,
} from "@/lib/catalog"
import { Separator } from "@/components/ui/separator"

export function CatalogSummary({
  mode,
  recipes,
  articles,
}: {
  mode: "recipes" | "articles"
  recipes: Recipe[]
  articles: ArticleListItem[]
}) {
  const metrics = React.useMemo(() => {
    const activeRecipes = recipes.filter((recipe) => recipe.isActive)
    const published = recipes.filter((recipe) => recipe.itemId)
    const produces = recipes.filter((recipe) => recipe.producesIngredient)
    const withCost = recipes.filter(
      (recipe) => recipe.estimatedCost !== null && recipe.estimatedCost !== undefined
    )
    const averageCost =
      withCost.length > 0
        ? withCost.reduce(
            (total, recipe) => total + Number(recipe.estimatedCost),
            0
          ) / withCost.length
        : null

    const activeArticles = articles.filter((article) => article.isActive)
    const withRecipe = articles.filter(
      (article) => (article.recipes?.length ?? article._count.recipes) > 0
    )
    const withoutRecipe = articles.length - withRecipe.length

    const costByProduct = new Map(
      recipes
        .filter(
          (recipe) =>
            recipe.itemId &&
            recipe.variantId === null
        )
        .map((recipe) => [recipe.itemId as string, recipe])
    )

    const margins = articles
      .filter((article) => article.isActive)
      .flatMap((article) => {
        const recipe = costByProduct.get(article.id)
        if (!recipe) return []

        const variants = article.variants.filter((variant) => variant.isActive)
        const costByVariant = new Map(
          (recipe.variantCosts ?? []).map((cost) => [
            cost.variantId,
            cost.estimatedCost,
          ])
        )

        if (variants.length === 0) {
          if (recipe.estimatedCost === null) return []
          const price = Number(article.price)
          if (price <= 0) return []
          return [
            {
              price,
              amount: price - Number(recipe.estimatedCost),
            },
          ]
        }

        return variants.flatMap((variant) => {
          const cost =
            costByVariant.get(variant.id) ?? recipe.estimatedCost
          if (cost === null || cost === undefined) return []
          const price = Number(article.price) + Number(variant.priceAdjust)
          if (price <= 0) return []
          return [{ price, amount: price - Number(cost) }]
        })
      })

    const averageMargin =
      margins.length > 0
        ? margins.reduce((total, margin) => total + margin.amount, 0) /
          margins.length
        : null
    const totalMargin = margins.reduce(
      (total, margin) => total + margin.amount,
      0
    )
    const totalPrice = margins.reduce(
      (total, margin) => total + margin.price,
      0
    )
    const averageMarginPercent =
      margins.length > 0 && totalPrice > 0 ? totalMargin / totalPrice : null

    return {
      activeRecipes: activeRecipes.length,
      inactiveRecipes: recipes.length - activeRecipes.length,
      published: published.length,
      standalone: recipes.length - published.length,
      produces: produces.length,
      averageCost,
      activeArticles: activeArticles.length,
      inactiveArticles: articles.length - activeArticles.length,
      withRecipe: withRecipe.length,
      withoutRecipe,
      averageMargin,
      averageMarginPercent,
    }
  }, [recipes, articles])

  if (mode === "recipes") {
    return (
      <div className="grid gap-4 sm:grid-cols-4">
        <Card size="sm">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <FlaskConicalIcon className="size-4" />
              Recetas
            </CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {metrics.activeRecipes} activa
              {metrics.activeRecipes === 1 ? "" : "s"}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-row flex-wrap gap-1.5">
            <Badge variant="secondary">{recipes.length} en total</Badge>
            <Badge variant="outline">
              {metrics.inactiveRecipes} inactiva
              {metrics.inactiveRecipes === 1 ? "" : "s"}
            </Badge>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <PackageIcon className="size-4" />
              Publicadas como artículo
            </CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {metrics.published}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {metrics.standalone} solo existen como receta.
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <TagsIcon className="size-4" />
              Producen insumo
            </CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {metrics.produces}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Pueden producirse por lote y usarse en otras recetas.
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <CircleDollarSignIcon className="size-4" />
              Costo promedio
            </CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {metrics.averageCost === null
                ? "—"
                : formatMoney(metrics.averageCost)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Insumos default con costo registrado.
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-4">
      <Card size="sm">
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center gap-1.5">
            <PackageIcon className="size-4" />
            Artículos
          </CardDescription>
          <CardTitle className="text-2xl tabular-nums">
            {metrics.activeArticles} activo
            {metrics.activeArticles === 1 ? "" : "s"}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-row flex-wrap gap-1.5">
          <Badge variant="secondary">{articles.length} en total</Badge>
          <Badge variant="outline">
            {metrics.inactiveArticles} inactivo
            {metrics.inactiveArticles === 1 ? "" : "s"}
          </Badge>
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center gap-1.5">
            <FlaskConicalIcon className="size-4" />
            Con receta
          </CardDescription>
          <CardTitle className="text-2xl tabular-nums">
            {metrics.withRecipe}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          Descuentan inventario al venderse.
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center gap-1.5">
            <TagsIcon className="size-4" />
            Sin receta
          </CardDescription>
          <CardTitle className="text-2xl tabular-nums">
            {metrics.withoutRecipe}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          No modifican el inventario.
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center gap-1.5">
            <PercentIcon className="size-4" />
            Margen promedio
          </CardDescription>
          <CardTitle className="flex items-center gap-2 text-xl tabular-nums">
            {metrics.averageMargin === null
              ? "—"
              : formatMoney(metrics.averageMargin)}
            <Separator orientation="vertical" className="h-5 self-center" />
            {metrics.averageMarginPercent === null
              ? "—"
              : formatMarginPercent(metrics.averageMarginPercent)}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          Precio menos costo de cada presentación, promedio ponderado.
        </CardContent>
      </Card>
    </div>
  )
}
