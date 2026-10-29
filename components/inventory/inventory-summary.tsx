"use client"

import * as React from "react"
import {
  BoxesIcon,
  CircleDollarSignIcon,
  ClockIcon,
  TrendingDownIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { Branch } from "@/lib/branches"
import {
  formatMoney,
  formatQuantity,
  unitLabel,
  type Ingredient,
  type UnitCode,
} from "@/lib/catalog"
import type { InventoryReport } from "@/lib/dashboard"

const CONSUMPTION_DAYS = 30
const CRITICAL_DAYS = 7

interface ConsumptionRow {
  name: string
  quantity: number
  unit: UnitCode
  days: number | null
}

/**
 * Tarjetas de resumen de la tab Inventario.
 *
 * Todo se calcula con los insumos ya cargados; el reporte de inventario solo
 * se usa para el consumo del periodo (y para estimar la cobertura).
 */
export function InventorySummary({
  ingredients,
  report,
  branch,
  branches,
}: {
  ingredients: Ingredient[]
  report: InventoryReport | null
  branch: Branch | null
  /** Sucursales activas; en Modo Global se evalúa cada una. */
  branches: Branch[]
}) {
  const isGlobal = branch === null

  const metrics = React.useMemo(() => {
    const active = ingredients.filter((ingredient) => ingredient.isActive)
    const activeBranches = branches.filter((item) => item.isActive)

    // Modo Global: el total consolidado puede estar sobre el mínimo mientras
    // una sucursal se queda sin stock. Se evalúa cada sucursal (una fila
    // ausente de BranchStock cuenta como 0).
    const lowInAnyBranch = (ingredient: Ingredient) =>
      activeBranches.some((item) => {
        const row = ingredient.branchStocks?.find(
          (stock) => stock.branchId === item.id
        )
        const quantity = row ? Number(row.quantity) : 0
        return quantity <= Number(ingredient.minStock)
      })

    const outInAnyBranch = (ingredient: Ingredient) =>
      activeBranches.some((item) => {
        const row = ingredient.branchStocks?.find(
          (stock) => stock.branchId === item.id
        )
        const quantity = row ? Number(row.quantity) : 0
        return quantity <= 0
      })

    const lowStock = isGlobal
      ? active.filter(lowInAnyBranch)
      : active.filter((ingredient) => ingredient.isLowStock)
    const outOfStock = isGlobal
      ? active.filter(outInAnyBranch)
      : active.filter((ingredient) => Number(ingredient.currentStock) <= 0)
    const inactive = ingredients.length - active.length

    const withCost = active.filter((ingredient) => ingredient.unitCost !== null)
    const value = withCost.reduce(
      (total, ingredient) =>
        total + Number(ingredient.currentStock) * Number(ingredient.unitCost),
      0
    )

    const byName = new Map(active.map((ingredient) => [ingredient.name, ingredient]))

    const consumption: ConsumptionRow[] = (report?.consumption ?? []).map(
      (row) => {
        const ingredient = byName.get(row.name)
        const daily = row.quantity / CONSUMPTION_DAYS
        const days =
          ingredient && daily > 0
            ? Number(ingredient.currentStock) / daily
            : null

        return {
          name: row.name,
          quantity: row.quantity,
          unit:
            ingredient?.displayUnit ?? (row.displayUnit as UnitCode) ?? "UNIT",
          days,
        }
      }
    )

    const coverage = consumption
      .filter((row): row is ConsumptionRow & { days: number } => row.days !== null)
      .sort((a, b) => a.days - b.days)
    const critical = coverage.filter((row) => row.days < CRITICAL_DAYS)

    return {
      active: active.length,
      lowStock: lowStock.length,
      outOfStock: outOfStock.length,
      inactive,
      branchCount: activeBranches.length,
      value,
      withoutCost: active.length - withCost.length,
      consumedCount: consumption.length,
      consumption: consumption.slice(0, 4),
      criticalCount: critical.length,
      critical: critical.slice(0, 3),
    }
  }, [ingredients, report, branches, isGlobal])

  return (
    <div className="grid gap-4 sm:grid-cols-4">
      <Card size="sm">
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center gap-1.5">
            <BoxesIcon className="size-4" />
            Estado del inventario
          </CardDescription>
          <CardTitle className="text-2xl tabular-nums">
            {metrics.active} insumo{metrics.active === 1 ? "" : "s"}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <div className="flex flex-row flex-wrap gap-1.5">
            <Badge variant={metrics.lowStock > 0 ? "destructive" : "success"}>
              {metrics.lowStock} bajo mínimo
            </Badge>
            <Badge variant="secondary">{metrics.outOfStock} agotados</Badge>
            <Badge variant="outline">{metrics.inactive} inactivos</Badge>
          </div>
          {isGlobal ? (
            <p className="text-xs text-muted-foreground">
              Evaluado en {metrics.branchCount} sucursal
              {metrics.branchCount === 1 ? "" : "es"}.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center gap-1.5">
            <CircleDollarSignIcon className="size-4" />
            Valor del inventario
          </CardDescription>
          <CardTitle className="text-2xl tabular-nums">
            {formatMoney(metrics.value)}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          {metrics.withoutCost > 0
            ? `${metrics.withoutCost} insumo(s) sin costo registrado.`
            : "Todos los insumos tienen costo registrado."}{" "}
          {branch ? branch.name : "Toda la organización"}.
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center gap-1.5">
            <TrendingDownIcon className="size-4" />
            Consumo · últimos {CONSUMPTION_DAYS} días
          </CardDescription>
          <CardTitle className="text-2xl tabular-nums">
            {report === null ? "—" : metrics.consumedCount}
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              insumo(s)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 text-xs">
          {report === null ? (
            <span className="text-muted-foreground">
              Reporte no disponible.
            </span>
          ) : metrics.consumption.length === 0 ? (
            <span className="text-muted-foreground">Sin consumo registrado.</span>
          ) : (
            metrics.consumption.map((row) => (
              <div key={row.name} className="flex items-center justify-between gap-2">
                <span className="truncate">{row.name}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {formatQuantity(row.quantity)} {unitLabel(row.unit)}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center gap-1.5">
            <ClockIcon className="size-4" />
            Cobertura de stock
          </CardDescription>
          <CardTitle className="text-2xl tabular-nums">
            {metrics.criticalCount}
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              en riesgo
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 text-xs">
          {metrics.critical.length === 0 ? (
            <span className="text-muted-foreground">
              Ningún insumo de alto consumo se agota en menos de{" "}
              {CRITICAL_DAYS} días.
            </span>
          ) : (
            metrics.critical.map((row) => (
              <div key={row.name} className="flex items-center justify-between gap-2">
                <span className="truncate">{row.name}</span>
                <span className="shrink-0 tabular-nums text-destructive">
                  {row.days < 1 ? "<1" : Math.floor(row.days)} día(s)
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
