"use client"

import { Badge } from "@/components/ui/badge"
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
import { formatMoney } from "@/lib/catalog"
import type { CashSessionList, ChargesReport } from "@/lib/cash"

/** Reporte de caja: turnos y control de cobros por usuario. */
export function CashReport({
  sessions,
  charges,
}: {
  sessions: CashSessionList | null
  charges: ChargesReport | null
}) {
  return (
    <div className="flex flex-col gap-4">
      {charges?.totals ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Ventas confirmadas" value={formatMoney(charges.totals.total)} />
          <Metric label="Propinas" value={formatMoney(charges.totals.tips)} />
          <Metric
            label="Reembolsos"
            value={`${charges.totals.refundedCount} · ${formatMoney(charges.totals.refundedAmount)}`}
          />
          <Metric
            label="Cuentas canceladas"
            value={String(charges.totals.cancelledOrders)}
          />
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Control de cobros por usuario</CardTitle>
          <CardDescription>
            Ventas, propinas, anulaciones y cancelaciones de cada persona. Los
            reembolsos altos o las cuentas canceladas se marcan para revisión.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!charges || charges.users.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No hay cobros en el periodo.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead className="text-right">Cobros</TableHead>
                  <TableHead className="text-right">Ventas</TableHead>
                  <TableHead className="text-right">Propinas</TableHead>
                  <TableHead className="text-right">Reembolsos</TableHead>
                  <TableHead className="text-right">Canceladas</TableHead>
                  <TableHead className="text-right">Alerta</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {charges.users.map((row) => {
                  const flagged =
                    row.refundRate > 3 ||
                    row.refundedCount > 0 ||
                    row.cancelledOrders > 0

                  return (
                    <TableRow key={row.userId}>
                      <TableCell>
                        <span className="font-medium">
                          {row.name}
                          {row.username ? (
                            <span className="text-muted-foreground">
                              {" "}
                              · {row.username}
                            </span>
                          ) : null}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.count}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(row.total)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(row.tips)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.refundedCount > 0
                          ? `${row.refundedCount} · ${formatMoney(row.refundedAmount)}`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.cancelledOrders || "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {flagged ? (
                          <Badge variant="destructive">Revisar</Badge>
                        ) : (
                          <Badge variant="secondary">OK</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Turnos de caja</CardTitle>
          <CardDescription>
            Apertura, cierre y diferencia entre el efectivo esperado y el
            contado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!sessions || sessions.items.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No hay turnos en el periodo.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Turno</TableHead>
                  <TableHead>Sucursal / responsables</TableHead>
                  <TableHead className="text-right">Ventas</TableHead>
                  <TableHead className="text-right">Propinas</TableHead>
                  <TableHead className="text-right">Esperado</TableHead>
                  <TableHead className="text-right">Contado</TableHead>
                  <TableHead className="text-right">Diferencia</TableHead>
                  <TableHead className="text-right">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.items.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell className="whitespace-nowrap">
                      {new Date(session.openedAt).toLocaleString("es-MX", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{session.branchName ?? "General"}</span>
                        <span className="text-xs text-muted-foreground">
                          Abrió {session.openedBy?.name ?? "—"}
                          {session.closedBy?.name
                            ? ` · cerró ${session.closedBy.name}`
                            : ""}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(session.totals.sales)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(session.totals.tips)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {session.expectedCash === null
                        ? "—"
                        : formatMoney(session.expectedCash)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {session.countedCash === null
                        ? "—"
                        : formatMoney(session.countedCash)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {session.difference === null ? (
                        "—"
                      ) : session.difference === 0 ? (
                        <span className="text-muted-foreground">Cuadra</span>
                      ) : (
                        <span
                          className={
                            session.difference > 0
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-destructive"
                          }
                        >
                          {session.difference > 0 ? "+" : ""}
                          {formatMoney(session.difference)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant={
                          session.status === "OPEN" ? "secondary" : "outline"
                        }
                      >
                        {session.status === "OPEN" ? "Abierta" : "Cerrada"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-1 py-3">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-lg font-semibold tabular-nums">{value}</span>
      </CardContent>
    </Card>
  )
}
