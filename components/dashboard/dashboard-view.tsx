import Link from "next/link"
import type { ReactNode } from "react"
import {
  AlertTriangleIcon,
  ChefHatIcon,
  CircleDollarSignIcon,
  ClockIcon,
  ReceiptIcon,
  TrendingUpIcon,
} from "lucide-react"

import { SalesChart } from "@/components/dashboard/sales-chart"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
import type { Branch } from "@/lib/branches"
import { formatMoney, formatQuantity } from "@/lib/catalog"
import type { DashboardOverview } from "@/lib/dashboard"
import {
  ORDER_STATUS_LABELS,
  orderLabel,
  PAYMENT_METHOD_LABELS,
} from "@/lib/orders"
import { cn } from "cn"

/** Periodos que ofrece el selector del panel. */
const PERIODS = [7, 30, 90] as const

export function DashboardView({
  data,
  userName,
  branch,
  days,
}: {
  data: DashboardOverview
  userName: string
  /** Sucursal activa; `null` = vista consolidada. */
  branch: Branch | null
  /** Periodo seleccionado en días. */
  days: number
}) {
  const kitchenActive =
    data.kitchen.pending + data.kitchen.preparing + data.kitchen.ready

  const maxMethod = Math.max(
    1,
    ...data.paymentsByMethod.map((row) => row.total ?? 0)
  )

  return (
    <div className="@container/main flex flex-1 flex-col gap-4 px-4 py-6 lg:px-6">
      <PageHeader
        title={`Hola, ${userName}`}
        description={`Resumen de hoy y de los últimos ${data.days} días.`}
        branch={branch}
        actions={
          <>
            <div className="flex items-center gap-0.5 rounded-lg border p-0.5">
              {PERIODS.map((value) => (
                <Link
                  key={value}
                  href={`/dashboard?days=${value}`}
                  className={buttonVariants({
                    size: "sm",
                    variant: value === days ? "default" : "ghost",
                  })}
                >
                  {value} d
                </Link>
              ))}
            </div>
            <Link href="/pos" className={buttonVariants({ size: "sm" })}>
              Ir al punto de venta
            </Link>
            <Link
              href="/kitchen"
              className={buttonVariants({ size: "sm", variant: "outline" })}
            >
              Ver cocina
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
        <StatCard
          label="Ventas de hoy"
          value={
            data.money && data.today.sales !== null
              ? formatMoney(data.today.sales)
              : "—"
          }
          hint={
            data.money
              ? `IVA incluido ${formatMoney(data.today.taxTotal ?? 0)}`
              : "Tu rol no incluye importes"
          }
          icon={<CircleDollarSignIcon className="size-4" />}
        />
        <StatCard
          label="Pedidos de hoy"
          value={String(data.today.orders)}
          hint={`${data.today.itemsSold} artículo(s) vendidos`}
          icon={<ReceiptIcon className="size-4" />}
        />
        <StatCard
          label="Ticket promedio"
          value={
            data.money && data.today.averageTicket !== null
              ? formatMoney(data.today.averageTicket)
              : "—"
          }
          hint={`${data.today.payments} pago(s) confirmados`}
          icon={<TrendingUpIcon className="size-4" />}
        />
        <StatCard
          label="Comandas activas"
          value={String(kitchenActive)}
          hint={
            data.kitchen.delayed > 0
              ? `${data.kitchen.delayed} demorada(s) hace +15 min`
              : "Sin demoras"
          }
          icon={<ChefHatIcon className="size-4" />}
          alert={data.kitchen.delayed > 0}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        {data.money ? (
          <SalesChart data={data.salesSeries} />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Actividad del periodo</CardTitle>
              <CardDescription>
                Los importes solo están disponibles para administración y caja.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-2 text-sm">
                <li className="flex items-center justify-between">
                  <span className="text-muted-foreground">Pedidos abiertos</span>
                  <span className="font-medium tabular-nums">
                    {data.openOrders.count}
                  </span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="text-muted-foreground">Pagos del periodo</span>
                  <span className="font-medium tabular-nums">
                    {data.period.payments}
                  </span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    Tiempo medio de preparación
                  </span>
                  <span className="font-medium tabular-nums">
                    {data.kitchen.averagePrepMinutes !== null
                      ? `${data.kitchen.averagePrepMinutes} min`
                      : "Sin datos"}
                  </span>
                </li>
              </ul>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Métodos de pago</CardTitle>
            <CardDescription>Últimos {data.days} días.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {data.paymentsByMethod.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Todavía no hay pagos confirmados en el periodo.
              </p>
            ) : (
              data.paymentsByMethod.map((row) => (
                <div key={row.method} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-sm">
                    <span>{PAYMENT_METHOD_LABELS[row.method]}</span>
                    <span className="tabular-nums">
                      {row.total !== null ? formatMoney(row.total) : row.count}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{
                        width: `${Math.round(((row.total ?? 0) / maxMethod) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {row.count} pago(s)
                  </span>
                </div>
              ))
            )}
          </CardContent>
          <CardFooter className="text-xs text-muted-foreground">
            Un pago pendiente no cuenta como venta hasta confirmarse.
          </CardFooter>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Más vendidos</CardTitle>
            <CardDescription>Por unidades, últimos {data.days} días.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.topProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aún no hay ventas registradas.
              </p>
            ) : (
              <ol className="flex flex-col gap-2">
                {data.topProducts.map((product, index) => (
                  <li
                    key={product.name}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="w-5 text-xs text-muted-foreground tabular-nums">
                        {index + 1}.
                      </span>
                      <span className="truncate">{product.name}</span>
                    </span>
                    <span className="shrink-0 text-muted-foreground tabular-nums">
                      {formatQuantity(product.quantity)} ud.
                      {product.revenue !== null
                        ? ` · ${formatMoney(product.revenue)}`
                        : ""}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cocina</CardTitle>
            <CardDescription>Comandas activas ahora mismo.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <KitchenRow label="Pendientes" value={data.kitchen.pending} />
            <KitchenRow label="En preparación" value={data.kitchen.preparing} />
            <KitchenRow label="Listas" value={data.kitchen.ready} />
            <div className="flex items-center justify-between border-t pt-3">
              <span className="flex items-center gap-2 text-muted-foreground">
                <ClockIcon className="size-4" />
                Tiempo medio
              </span>
              <span className="font-medium tabular-nums">
                {data.kitchen.averagePrepMinutes !== null
                  ? `${data.kitchen.averagePrepMinutes} min`
                  : "Sin datos"}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card
          className={cn(
            data.inventory.lowStockCount > 0 && "border-destructive/40"
          )}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {data.inventory.lowStockCount > 0 ? (
                <AlertTriangleIcon className="size-4 text-destructive" />
              ) : null}
              Inventario
            </CardTitle>
            <CardDescription>
              {data.inventory.lowStockCount} ingrediente(s) bajo mínimo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.inventory.alerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Todo el stock está por encima del mínimo.
              </p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {data.inventory.alerts.map((alert) => (
                  <li
                    key={alert.id}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="truncate">{alert.name}</span>
                    <span className="shrink-0 text-xs text-destructive tabular-nums">
                      {formatQuantity(alert.currentStock)} /{" "}
                      {formatQuantity(alert.minStock)} {alert.baseUnit}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
          <CardFooter>
            <Link
              href="/inventory"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Ver inventario
            </Link>
          </CardFooter>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Actividad reciente</CardTitle>
          <CardDescription>Últimas cuentas abiertas.</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cuenta</TableHead>
                <TableHead>Estado</TableHead>
                {branch ? null : <TableHead>Sucursal</TableHead>}
                <TableHead>Comandas</TableHead>
                <TableHead>Atendida por</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Hora</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.recentOrders.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={branch ? 6 : 7}
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    Todavía no hay cuentas registradas.
                  </TableCell>
                </TableRow>
              ) : (
                data.recentOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">
                      {orderLabel(order)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          order.status === "OPEN"
                            ? "secondary"
                            : order.status === "CANCELLED"
                              ? "destructive"
                              : "outline"
                        }
                      >
                        {ORDER_STATUS_LABELS[order.status]}
                      </Badge>
                    </TableCell>
                    {branch ? null : (
                      <TableCell className="text-muted-foreground">
                        {order.branch ?? "—"}
                      </TableCell>
                    )}
                    <TableCell className="tabular-nums">
                      {order.rounds}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {order.user ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {order.total !== null ? formatMoney(order.total) : "—"}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {new Date(order.createdAt).toLocaleTimeString("es-MX", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
        <CardFooter className="justify-between text-xs text-muted-foreground">
          <span>
            {data.openOrders.count} cuenta(s) abierta(s)
            {data.openOrders.total !== null
              ? ` · ${formatMoney(data.openOrders.total)} en curso`
              : ""}
          </span>
          <Link href="/pos" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            Abrir el POS
          </Link>
        </CardFooter>
      </Card>
    </div>
  )
}

function StatCard({
  label,
  value,
  hint,
  icon,
  alert,
}: {
  label: string
  value: string
  hint: string
  icon: ReactNode
  alert?: boolean
}) {
  return (
    <Card
      className={cn(
        "@container/card bg-linear-to-t from-primary/5 to-card shadow-xs dark:bg-card",
        alert && "border-destructive/40"
      )}
    >
      <CardHeader>
        <CardDescription className="flex items-center gap-2">
          {icon}
          {label}
        </CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
          {value}
        </CardTitle>
      </CardHeader>
      <CardFooter className="text-xs text-muted-foreground">{hint}</CardFooter>
    </Card>
  )
}

function KitchenRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <Badge variant={value > 0 ? "secondary" : "outline"}>{value}</Badge>
    </div>
  )
}
