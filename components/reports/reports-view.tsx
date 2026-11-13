"use client"

import Link from "next/link"
import { useMemo } from "react"

import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { OrderStatusIcon } from "@/components/order-status-icon"
import { PageHeader } from "@/components/page-header"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { usePersistentTab } from "@/hooks/use-persistent-tab"
import { formatMoney, formatQuantity } from "@/lib/catalog"
import type { Branch } from "@/lib/branches"
import type { CashSessionList, ChargesReport } from "@/lib/cash"
import type {
  InventoryReport,
  KitchenReport,
  PosOperationsReport,
  SalesReport,
} from "@/lib/dashboard"
import {
  PAYMENT_METHOD_LABELS,
  ROUND_STATUS_LABELS,
  type RoundStatus,
} from "@/lib/orders"

import { CashReport } from "./cash-report"
import { OperationsReport } from "./operations-report"

const REPORT_TABS = ["sales", "operations", "inventory", "kitchen", "cash"] as const

const MOVEMENT_LABELS: Record<string, string> = {
  ADJUSTMENT: "Ajuste",
  CONSUMPTION: "Consumo",
  RETURN: "Devolución",
}

function formatMinutes(value: number | null): string {
  return value === null ? "Sin datos" : `${value} min`
}

export function ReportsView({
  days,
  sales,
  inventory,
  kitchen,
  operations,
  sessions,
  charges,
  branch,
}: {
  days: number
  sales: SalesReport | null
  inventory: InventoryReport | null
  kitchen: KitchenReport | null
  operations: PosOperationsReport | null
  sessions: CashSessionList | null
  charges: ChargesReport | null
  /** Sucursal activa; `null` = vista consolidada. */
  branch: Branch | null
}) {
  const availableTabs = useMemo(
    () =>
      REPORT_TABS.filter((tab) => {
        if (tab === "sales") return Boolean(sales)
        if (tab === "operations") return Boolean(operations)
        if (tab === "inventory") return Boolean(inventory)
        if (tab === "kitchen") return Boolean(kitchen)
        return Boolean(sessions || charges)
      }),
    [sales, operations, inventory, kitchen, sessions, charges]
  )
  const defaultTab = availableTabs[0] ?? "sales"
  const [tab, setTab] = usePersistentTab(
    "reports-tab",
    availableTabs,
    defaultTab
  )

  return (
    <div className="@container/main flex flex-1 flex-col gap-4 px-4 py-6 lg:px-6">
      <PageHeader
        title="Reportes"
        description={`Periodo: últimos ${days} días.`}
        branch={branch}
        actions={
          <>
            {[7, 30, 90].map((value) => (
              <Link
                key={value}
                href={`/reports?days=${value}`}
                className={buttonVariants({
                  size: "sm",
                  variant: value === days ? "default" : "outline",
                })}
              >
                {value} días
              </Link>
            ))}
          </>
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          {sales ? <TabsTrigger value="sales">Ventas</TabsTrigger> : null}
          {operations ? (
            <TabsTrigger value="operations">Operación</TabsTrigger>
          ) : null}
          {inventory ? (
            <TabsTrigger value="inventory">Inventario</TabsTrigger>
          ) : null}
          {kitchen ? <TabsTrigger value="kitchen">Cocina</TabsTrigger> : null}
          {sessions || charges ? (
            <TabsTrigger value="cash">Caja</TabsTrigger>
          ) : null}
        </TabsList>

        {sales ? (
          <TabsContent value="sales" className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric
                label="Ventas confirmadas"
                value={formatMoney(sales.totals.sales)}
              />
              <Metric
                label="Pagos"
                value={String(sales.totals.payments)}
              />
              <Metric label="Cuentas" value={String(sales.totals.orders)} />
              <Metric
                label="Ticket promedio"
                value={formatMoney(sales.totals.averageTicket)}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Ventas por día</CardTitle>
                  <CardDescription>
                    Solo pagos confirmados en el periodo.
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Día</TableHead>
                        <TableHead className="text-right">Pagos</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sales.byDay.length === 0 ? (
                        <EmptyRow colSpan={3} text="Sin ventas en el periodo." />
                      ) : (
                        sales.byDay.map((row) => (
                          <TableRow key={row.date}>
                            <TableCell>{formatDay(row.date)}</TableCell>
                            <TableCell className="text-right tabular-nums">
                              {row.count}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatMoney(row.sales)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Métodos de pago</CardTitle>
                  <CardDescription>Distribución del periodo.</CardDescription>
                </CardHeader>
                <CardContent className="px-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Método</TableHead>
                        <TableHead className="text-right">Pagos</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sales.byMethod.length === 0 ? (
                        <EmptyRow colSpan={3} text="Sin pagos confirmados." />
                      ) : (
                        sales.byMethod.map((row) => (
                          <TableRow key={row.method}>
                            <TableCell>
                              {PAYMENT_METHOD_LABELS[row.method]}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {row.count}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatMoney(row.total)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Artículos más vendidos</CardTitle>
                  <CardDescription>Por unidades.</CardDescription>
                </CardHeader>
                <CardContent className="px-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Artículo</TableHead>
                        <TableHead className="text-right">Unidades</TableHead>
                        <TableHead className="text-right">Importe</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sales.topItems.length === 0 ? (
                        <EmptyRow colSpan={3} text="Sin artículos vendidos." />
                      ) : (
                        sales.topItems.map((row) => (
                          <TableRow key={row.name}>
                            <TableCell className="max-w-[220px] truncate">
                              {row.name}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatQuantity(row.quantity)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatMoney(row.revenue)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Cobros por usuario</CardTitle>
                  <CardDescription>Quién confirmó cada pago.</CardDescription>
                </CardHeader>
                <CardContent className="px-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Usuario</TableHead>
                        <TableHead className="text-right">Pagos</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sales.byCashier.length === 0 ? (
                        <EmptyRow colSpan={3} text="Sin cobros registrados." />
                      ) : (
                        sales.byCashier.map((row) => (
                          <TableRow key={row.name}>
                            <TableCell className="max-w-[220px] truncate">
                              {row.name}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {row.count}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatMoney(row.total)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        ) : null}

        {operations ? (
          <TabsContent value="operations" className="flex flex-col gap-4">
            <OperationsReport report={operations} />
          </TabsContent>
        ) : null}

        {inventory ? (
          <TabsContent value="inventory" className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-3">
              {inventory.movements.length === 0 ? (
                <Metric label="Movimientos" value="0" />
              ) : (
                inventory.movements.map((row) => (
                  <Metric
                    key={row.type}
                    label={MOVEMENT_LABELS[row.type] ?? row.type}
                    value={`${row.count} · ${formatQuantity(row.quantity)}`}
                  />
                ))
              )}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Mayor consumo</CardTitle>
                  <CardDescription>
                    Ingredientes descontados por ventas.
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ingrediente</TableHead>
                        <TableHead className="text-right">Cantidad</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inventory.consumption.length === 0 ? (
                        <EmptyRow
                          colSpan={2}
                          text="Sin consumos en el periodo."
                        />
                      ) : (
                        inventory.consumption.map((row) => (
                          <TableRow key={row.name}>
                            <TableCell className="max-w-[240px] truncate">
                              {row.name}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatQuantity(row.quantity)} {row.displayUnit}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Stock bajo mínimo</CardTitle>
                  <CardDescription>Estado actual del inventario.</CardDescription>
                </CardHeader>
                <CardContent className="px-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ingrediente</TableHead>
                        <TableHead className="text-right">Actual</TableHead>
                        <TableHead className="text-right">Mínimo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inventory.lowStock.length === 0 ? (
                        <EmptyRow colSpan={3} text="Todo por encima del mínimo." />
                      ) : (
                        inventory.lowStock.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell className="max-w-[220px] truncate">
                              {row.name}
                            </TableCell>
                            <TableCell className="text-right text-destructive tabular-nums">
                              {formatQuantity(row.currentStock)} {row.displayUnit}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatQuantity(row.minStock)} {row.displayUnit}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        ) : null}

        {kitchen ? (
          <TabsContent value="kitchen" className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Metric label="Comandas" value={String(kitchen.totals.rounds)} />
              <Metric
                label="Espera media"
                value={formatMinutes(kitchen.totals.averageWaitMinutes)}
              />
              <Metric
                label="Preparación media"
                value={formatMinutes(kitchen.totals.averagePrepMinutes)}
              />
              <Metric
                label="Entrega media"
                value={formatMinutes(kitchen.totals.averageDeliveryMinutes)}
              />
              <Metric
                label="Ciclo medio"
                value={formatMinutes(kitchen.totals.averageTotalMinutes)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Espera: enviada → empezada. Preparación: empezada → lista.
              Entrega: lista → entregada. Ciclo: enviada → entregada.
            </p>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Comandas por estado</CardTitle>
                  <CardDescription>
                    Incluye las canceladas del periodo.
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Comandas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {kitchen.byStatus.length === 0 ? (
                        <EmptyRow colSpan={2} text="Sin comandas." />
                      ) : (
                        kitchen.byStatus.map((row) => (
                          <TableRow key={row.status}>
                            <TableCell>
                              <Badge variant="outline">
                                <OrderStatusIcon
                                  status={row.status as RoundStatus}
                                />
                                {ROUND_STATUS_LABELS[row.status as RoundStatus] ??
                                  row.status}
                              </Badge>
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

              <Card>
                <CardHeader>
                  <CardTitle>Comandas por día</CardTitle>
                  <CardDescription>Según la hora de envío.</CardDescription>
                </CardHeader>
                <CardContent className="px-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Día</TableHead>
                        <TableHead className="text-right">Comandas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {kitchen.byDay.length === 0 ? (
                        <EmptyRow colSpan={2} text="Sin comandas." />
                      ) : (
                        kitchen.byDay.map((row) => (
                          <TableRow key={row.date}>
                            <TableCell>{formatDay(row.date)}</TableCell>
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
          </TabsContent>
        ) : null}

        {sessions || charges ? (
          <TabsContent value="cash" className="flex flex-col gap-4">
            <CashReport sessions={sessions} charges={charges} />
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums">
          {value}
        </CardTitle>
      </CardHeader>
    </Card>
  )
}

function EmptyRow({ colSpan, text }: { colSpan: number; text: string }) {
  return (
    <TableRow>
      <TableCell
        colSpan={colSpan}
        className="py-8 text-center text-sm text-muted-foreground"
      >
        {text}
      </TableCell>
    </TableRow>
  )
}

function formatDay(value: string): string {
  const [year, month, day] = value.split("-")
  return `${day}/${month}/${year}`
}
