"use client"

import dynamic from "next/dynamic"
import type { ComponentProps } from "react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

type SalesChartProps = ComponentProps<
  (typeof import("./sales-chart"))["SalesChart"]
>

/**
 * Recharts es la librería más pesada del panel (~98 KB gzip) y solo se usa en
 * la gráfica del dashboard. Se carga después de la hidratación, así el resto de
 * la página (indicadores, pedidos recientes) pinta sin esperarla.
 *
 * El esqueleto replica la tarjeta y los 260 px del gráfico para que no haya
 * salto de layout al aparecer.
 */
const SalesChart = dynamic(
  () => import("./sales-chart").then((mod) => mod.SalesChart),
  {
    ssr: false,
    loading: () => (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>Ventas de los últimos días</CardTitle>
          <CardDescription>
            Importes cobrados y confirmados por día.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-2 pt-2 sm:px-6">
          <Skeleton className="h-[260px] w-full" />
        </CardContent>
      </Card>
    ),
  }
)

export function SalesChartLazy(props: SalesChartProps) {
  return <SalesChart {...props} />
}
