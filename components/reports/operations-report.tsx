"use client"

import * as React from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatMoney } from "@/lib/catalog"
import type { PosOperationsReport } from "@/lib/dashboard"

/** Preferencia manual: `1` = visible, `0` = oculto. */
const VISIBILITY_KEY = "reports-operations-visible"

const noopSubscribe = () => () => {}
const getMounted = () => true
const getServerMounted = () => false

const visibilityListeners = new Set<() => void>()
let visibilityCache: boolean | null | undefined

function readVisibility(): boolean | null {
  if (visibilityCache !== undefined) return visibilityCache

  try {
    const stored = window.localStorage.getItem(VISIBILITY_KEY)
    visibilityCache = stored === "1" ? true : stored === "0" ? false : null
  } catch {
    visibilityCache = null
  }

  return visibilityCache
}

function writeVisibility(next: boolean): void {
  visibilityCache = next

  try {
    window.localStorage.setItem(VISIBILITY_KEY, next ? "1" : "0")
  } catch {
    // Sin persistencia: el cambio dura esta sesión.
  }

  for (const listener of visibilityListeners) listener()
}

function subscribeVisibility(listener: () => void): () => void {
  visibilityListeners.add(listener)

  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== VISIBILITY_KEY) return

    visibilityCache = undefined
    listener()
  }

  window.addEventListener("storage", onStorage)

  return () => {
    visibilityListeners.delete(listener)
    window.removeEventListener("storage", onStorage)
  }
}

function getServerVisibility(): boolean | null {
  return null
}

/**
 * Reporte de operación del POS.
 *
 * La visibilidad automática se activa a los 14 días de datos; mientras tanto
 * el interruptor permite mostrarlo u ocultarlo manualmente. La preferencia se
 * guarda por navegador para no imponerla a otros usuarios de la sucursal.
 */
export function OperationsReport({
  report,
}: {
  report: PosOperationsReport
}) {
  const manual = React.useSyncExternalStore(
    subscribeVisibility,
    readVisibility,
    getServerVisibility
  )
  const mounted = React.useSyncExternalStore(
    noopSubscribe,
    getMounted,
    getServerMounted
  )

  const autoEnabled = report.data.autoEnabled
  const visible = manual ?? autoEnabled
  const remainingDays = Math.max(
    0,
    report.data.autoAfterDays - report.data.days
  )
  const toggle = writeVisibility

  const chartData = report.capture.byDay.map((row) => ({
    date: formatDay(row.date),
    minutos:
      row.activeMedianMs === null
        ? 0
        : Number((row.activeMedianMs / 60_000).toFixed(2)),
  }))

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <CardTitle>Análisis de operación</CardTitle>
            <CardDescription>
              {autoEnabled
                ? `Activo automáticamente: ya hay ${report.data.autoAfterDays} días o más de datos.`
                : report.data.days === 0
                  ? `Se activará automáticamente cuando el POS acumule ${report.data.autoAfterDays} días de datos.`
                  : `Se activará automáticamente en ${remainingDays} ${
                      remainingDays === 1 ? "día" : "días"
                    }.`}{" "}
              Puedes mostrarlo u ocultarlo manualmente cuando quieras.
            </CardDescription>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {visible ? "Visible" : "Oculto"}
            </span>
            <Switch
              checked={visible}
              onCheckedChange={toggle}
              aria-label="Mostrar análisis de operación"
            />
          </div>
        </CardHeader>
      </Card>

      {visible ? (
        <>
          {report.capture.samples < 20 ? (
            <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
              Datos preliminares: hay {report.capture.samples} captura
              {report.capture.samples === 1 ? "" : "s"} en el periodo. Las
              medianas serán más estables con más rondas.
            </p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              label="Rondas enviadas"
              value={String(report.capture.sent)}
            />
            <Metric
              label="Tiempo activo mediano"
              value={formatDuration(report.capture.activeMedianMs)}
            />
            <Metric
              label="Tiempo activo p90"
              value={formatDuration(report.capture.activeP90Ms)}
            />
            <Metric
              label="Tiempo total mediano"
              value={formatDuration(report.capture.wallMedianMs)}
            />
            <Metric
              label="Hasta el primer artículo"
              value={formatDuration(report.capture.browseMedianMs)}
            />
            <Metric
              label="Del primer artículo al envío"
              value={formatDuration(report.capture.assemblyMedianMs)}
            />
            <Metric
              label="Artículos por minuto"
              value={formatNumber(report.capture.itemsPerMinute, 1)}
            />
            <Metric
              label="Interacciones por ronda"
              value={formatNumber(report.capture.averageInteractions, 1)}
            />
            <Metric
              label="Borradores no enviados"
              value={String(
                report.capture.abandoned + report.capture.switched
              )}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            «Activo» descuenta las pausas de más de 90 segundos; «total» es el
            tiempo real desde la primera interacción hasta el envío.
          </p>

          <Card>
            <CardHeader>
              <CardTitle>Tiempo de captura por día</CardTitle>
              <CardDescription>
                Mediana del tiempo activo por ronda enviada. Las pausas de más
                de 90 segundos no cuentan.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {mounted && chartData.length > 0 ? (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--border)"
                      />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11 }}
                        stroke="var(--muted-foreground)"
                      />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        stroke="var(--muted-foreground)"
                        unit=" min"
                      />
                      <Tooltip
                        formatter={(value) => [
                          `${Number(value).toFixed(1)} min`,
                          "Mediana",
                        ]}
                      />
                      <Bar
                        dataKey="minutos"
                        fill="var(--chart-2)"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex h-64 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
                  {mounted
                    ? "Sin rondas enviadas en el periodo."
                    : "Cargando gráfica…"}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Fricción del catálogo</CardTitle>
                <CardDescription>
                  Señales para mejorar nombres, filtros y opciones.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Indicador</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>Búsquedas realizadas</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {report.capture.searches}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Búsquedas sin resultado</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {report.capture.emptySearches} ·{" "}
                        {formatPercent(report.capture.emptySearchRate)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Cards de platillo abiertas</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {report.friction.opened}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Líneas agregadas a la comanda</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {report.friction.added}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Rondas enviadas</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {report.capture.sent}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Diálogos cancelados</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {report.friction.cancelled} ·{" "}
                        {formatPercent(report.friction.cancelRate)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Errores de validación</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {report.friction.validationErrors}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Búsquedas sin resultado</CardTitle>
                <CardDescription>
                  Términos que el mesero escribió y no encontraron artículos.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Término</TableHead>
                      <TableHead className="text-right">Veces</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.friction.topEmptySearches.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={2}
                          className="py-8 text-center text-sm text-muted-foreground"
                        >
                          Sin búsquedas vacías en el periodo.
                        </TableCell>
                      </TableRow>
                    ) : (
                      report.friction.topEmptySearches.map((row) => (
                        <TableRow key={row.query}>
                          <TableCell className="max-w-[260px] truncate">
                            {row.query}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {row.count}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Consumo por cliente y por mesa</CardTitle>
              <CardDescription>
                Cuentas de mesa no canceladas. «Con IVA» incluye impuestos;
                «sin IVA» es el subtotal. Por mesa divide entre los comensales
                declarados; por cliente, entre los clientes con consumo
                asignado.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Metric
                  label="Por cliente · con IVA"
                  value={formatMoneyValue(report.guests.averageGrossPerGuest)}
                />
                <Metric
                  label="Por cliente · sin IVA"
                  value={formatMoneyValue(report.guests.averageNetPerGuest)}
                />
                <Metric
                  label="Por mesa (asiento) · con IVA"
                  value={formatMoneyValue(report.guests.averageGrossPerSeat)}
                />
                <Metric
                  label="Por mesa (asiento) · sin IVA"
                  value={formatMoneyValue(report.guests.averageNetPerSeat)}
                />
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dato</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>Cuentas de mesa</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {report.guests.orders}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Cuentas con clientes asignados</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {report.guests.ordersWithGuests} ·{" "}
                      {formatPercent(
                        report.guests.orders > 0
                          ? report.guests.ordersWithGuests /
                              report.guests.orders
                          : null
                      )}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Clientes con consumo</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {report.guests.guestsWithItems}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Líneas asignadas a clientes</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatPercent(report.guests.assignedLineShare)}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Consumo asignado a clientes</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatPercent(report.guests.assignedAmountShare)}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Sin asignar (General)</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(report.guests.generalGross)} con IVA ·{" "}
                      {formatMoney(report.guests.generalNet)} sin IVA
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground">
            Privacidad: la analítica guarda solo métricas agregadas. No incluye
            nombres, teléfonos, direcciones ni notas de clientes. Los eventos se
            conservan 12 meses y luego se purgan.
          </p>
        </>
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            El análisis de operación está oculto. Actívalo con el interruptor de
            arriba cuando quieras verlo.
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-xl font-semibold tabular-nums">
          {value}
        </CardTitle>
      </CardHeader>
    </Card>
  )
}

function formatDuration(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "Sin datos"

  const seconds = value / 1000

  if (seconds < 60) {
    return `${seconds.toFixed(seconds < 10 ? 1 : 0)} s`
  }

  const minutes = Math.floor(seconds / 60)
  const rest = Math.round(seconds % 60)

  return rest > 0 ? `${minutes} min ${rest} s` : `${minutes} min`
}

function formatPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "Sin datos"

  return `${(value * 100).toFixed(1)}%`
}

function formatNumber(value: number | null, digits: number): string {
  if (value === null || !Number.isFinite(value)) return "Sin datos"

  return value.toFixed(digits)
}

function formatMoneyValue(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "Sin datos"

  return formatMoney(value)
}

function formatDay(value: string): string {
  const [year, month, day] = value.split("-")

  return `${day}/${month}/${year}`
}
