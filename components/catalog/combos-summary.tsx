"use client"

import * as React from "react"
import {
  CircleDollarSignIcon,
  GroupIcon,
  PercentIcon,
  TicketPercentIcon,
} from "lucide-react"

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

import { comboCost, comboPricing } from "./combo-metrics"

export function CombosSummary({
  combos,
  recipes,
}: {
  combos: ArticleListItem[]
  recipes: Recipe[]
}) {
  const metrics = React.useMemo(() => {
    const active = combos.filter((combo) => combo.isActive)
    const withPromotion = combos.filter(
      (combo) => combo.promotions?.[0]?.isActive
    )

    const averagePrice =
      combos.length > 0
        ? combos.reduce((total, combo) => total + Number(combo.price), 0) /
          combos.length
        : null

    let totalMargin = 0
    let totalEffective = 0
    let marginCount = 0

    for (const combo of combos) {
      const cost = comboCost(combo, recipes)
      const { effective } = comboPricing(combo)
      if (cost === null || effective <= 0) continue

      totalMargin += effective - cost
      totalEffective += effective
      marginCount += 1
    }

    return {
      active: active.length,
      withPromotion: withPromotion.length,
      withoutPromotion: combos.length - withPromotion.length,
      averagePrice,
      averageMargin: marginCount > 0 ? totalMargin / marginCount : null,
      averageMarginPercent:
        totalEffective > 0 ? totalMargin / totalEffective : null,
    }
  }, [combos, recipes])

  return (
    <div className="grid gap-4 sm:grid-cols-4">
      <Card size="sm">
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center gap-1.5">
            <GroupIcon className="size-4" />
            Combos
          </CardDescription>
          <CardTitle className="text-2xl tabular-nums">
            {metrics.active} activo{metrics.active === 1 ? "" : "s"}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          {combos.length} en total.
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center gap-1.5">
            <TicketPercentIcon className="size-4" />
            Con promoción
          </CardDescription>
          <CardTitle className="text-2xl tabular-nums">
            {metrics.withPromotion}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          {metrics.withoutPromotion} sin promoción activa.
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center gap-1.5">
            <CircleDollarSignIcon className="size-4" />
            Precio promedio
          </CardDescription>
          <CardTitle className="text-2xl tabular-nums">
            {metrics.averagePrice === null
              ? "—"
              : formatMoney(metrics.averagePrice)}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          Precio normal de los combos.
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center gap-1.5">
            <PercentIcon className="size-4" />
            Margen promedio
          </CardDescription>
          <CardTitle className="text-2xl tabular-nums">
            {metrics.averageMargin === null
              ? "—"
              : formatMarginPercent(metrics.averageMarginPercent)}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          {metrics.averageMargin === null
            ? "Sin costos completos."
            : `${formatMoney(metrics.averageMargin)} por combo, sobre el precio efectivo.`}
        </CardContent>
      </Card>
    </div>
  )
}
