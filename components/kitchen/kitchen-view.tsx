"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Loader2Icon, RefreshCwIcon, WifiIcon, WifiOffIcon } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/page-header"
import { API_BASE_URL } from "@/lib/api-base"
import type { Branch } from "@/lib/branches"
import { formatDateTime, formatMoney, formatTime } from "@/lib/catalog"
import { transitionRound } from "@/lib/order-actions"
import {
  formatDuration,
  orderLabel,
  roundTimings,
  ROUND_ACTIONS,
  ROUND_STATUS_LABELS,
  type KitchenRound,
  type RoundStatus,
} from "@/lib/orders"
import { cn } from "cn"

const COLUMNS: RoundStatus[] = ["PENDING", "PREPARING", "READY"]

const COLUMN_HINTS: Record<string, string> = {
  PENDING: "Comandas enviadas y sin empezar.",
  PREPARING: "En cocina. Al empezar se descuenta el inventario.",
  READY: "Listas para llevar a la mesa.",
}

/** Minutos a partir de los que una comanda se considera retrasada. */
const DELAY_MINUTES = 15

/** Etapas de la comanda, en orden, con la duración hasta la siguiente. */
function roundSteps(round: KitchenRound) {
  const timings = roundTimings(round)

  return [
    {
      label: "Enviada",
      at: round.sentAt ?? round.createdAt,
      gap: timings.waitMinutes,
    },
    { label: "En cocina", at: round.startedAt, gap: timings.prepMinutes },
    { label: "Lista", at: round.readyAt, gap: timings.deliveryMinutes },
    { label: "Entregada", at: round.deliveredAt },
  ]
}

function RoundTimeline({ round }: { round: KitchenRound }) {
  const steps = roundSteps(round).filter((step) => Boolean(step.at))

  return (
    <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] leading-none">
      {steps.map((step, index) => (
        <li key={step.label} className="flex items-center gap-1.5">
          {index > 0 ? (
            <span className="text-muted-foreground/70 tabular-nums">
              +{formatDuration(step.gap ?? null)}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1 rounded-full border bg-background px-1.5 py-1">
            <span
              className={cn(
                "size-1.5 rounded-full",
                index === steps.length - 1 ? "bg-primary" : "bg-muted-foreground/40"
              )}
            />
            <span className="text-muted-foreground">{step.label}</span>
            <span className="font-medium tabular-nums">
              {formatTime(step.at as string)}
            </span>
          </span>
        </li>
      ))}
    </ol>
  )
}

export function KitchenView({
  rounds,
  canWork,
  branch,
}: {
  rounds: KitchenRound[]
  canWork: boolean
  /** Sucursal activa; `null` = vista consolidada. */
  branch: Branch | null
}) {
  const router = useRouter()
  const [pendingId, setPendingId] = React.useState<string | null>(null)
  const [connected, setConnected] = React.useState(false)
  const [lastEvent, setLastEvent] = React.useState<string | null>(null)

  // Los minutos transcurridos se recalculan sin recargar la página.
  const [, setTick] = React.useState(0)
  React.useEffect(() => {
    const timer = setInterval(() => setTick((value) => value + 1), 30_000)
    return () => clearInterval(timer)
  }, [])

  // Tiempo real por SSE; si la conexión falla se cae a sondeo periódico.
  React.useEffect(() => {
    if (typeof window === "undefined" || typeof EventSource === "undefined") {
      return
    }

    const source = new EventSource(`${API_BASE_URL}/kitchen/stream`, {
      withCredentials: true,
    })

    source.onopen = () => setConnected(true)
    source.onerror = () => setConnected(false)
    source.onmessage = () => {
      setLastEvent(new Date().toISOString())
      router.refresh()
    }

    return () => source.close()
  }, [router])

  React.useEffect(() => {
    if (connected) return

    const timer = setInterval(() => router.refresh(), 15_000)
    return () => clearInterval(timer)
  }, [connected, router])

  const handleTransition = async (
    round: KitchenRound,
    status: RoundStatus
  ) => {
    setPendingId(round.id)

    try {
      const result = await transitionRound(
        round.order.id,
        round.id,
        status,
        undefined
      )

      if (!result.ok) {
        toast.error(result.message ?? "No se pudo actualizar la comanda")
        return
      }

      toast.success(
        `${orderLabel(round.order)} · ${ROUND_STATUS_LABELS[status]}`
      )

      const warnings = result.data?.warnings ?? []
      if (warnings.length > 0) {
        toast.warning(
          `Stock insuficiente: ${warnings
            .map((warning) => warning.name)
            .join(", ")}`
        )
      }

      router.refresh()
    } catch {
      toast.error("No se pudo actualizar la comanda")
    } finally {
      setPendingId(null)
    }
  }

  return (
    <div className="@container/main flex flex-1 flex-col gap-4 px-4 py-6 lg:px-6">
      <PageHeader
        title="Cocina"
        description={
          <>
            {rounds.length} comanda(s) activa(s)
            {lastEvent
              ? ` · última actualización ${formatDateTime(lastEvent)}`
              : ""}
          </>
        }
        branch={branch}
        actions={
          <>
            <Badge variant={connected ? "secondary" : "outline"}>
              {connected ? (
                <WifiIcon data-icon="inline-start" />
              ) : (
                <WifiOffIcon data-icon="inline-start" />
              )}
              {connected ? "Tiempo real" : "Sondeo cada 15 s"}
            </Badge>
            <Button variant="outline" size="sm" onClick={() => router.refresh()}>
              <RefreshCwIcon />
              Actualizar
            </Button>
          </>
        }
      />

      <div className="grid gap-3 lg:grid-cols-3">
        {COLUMNS.map((status) => {
          const columnRounds = rounds.filter((round) => round.status === status)

          return (
            <section
              key={status}
              className="flex flex-col gap-3 rounded-xl border bg-muted/20 p-3"
            >
              <header className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">{ROUND_STATUS_LABELS[status]}</h3>
                  <p className="text-xs text-muted-foreground">
                    {COLUMN_HINTS[status]}
                  </p>
                </div>
                <Badge variant="outline">{columnRounds.length}</Badge>
              </header>

              {columnRounds.length === 0 ? (
                <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Sin comandas.
                </p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {columnRounds.map((round) => {
                    const timings = roundTimings(round)
                    const stageMinutes = timings.stage?.minutes ?? 0
                    const delayed = stageMinutes >= DELAY_MINUTES

                    return (
                      <li
                        key={round.id}
                        className="flex flex-col gap-2 rounded-xl border bg-card p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <p className="font-medium">
                                {orderLabel(round.order)}
                              </p>
                              {branch ? null : round.order.branch ? (
                                <Badge variant="outline">
                                  {round.order.branch.name}
                                </Badge>
                              ) : null}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {round.order.tableNumber
                                ? formatMoney(round.order.total)
                                : `Para llevar · ${formatMoney(round.order.total)}`}
                              {timings.totalMinutes !== null
                                ? ` · ciclo ${formatDuration(timings.totalMinutes)}`
                                : ""}
                            </p>
                          </div>
                          <Badge
                            variant={delayed ? "destructive" : "secondary"}
                            title={`Tiempo en la etapa actual (${ROUND_STATUS_LABELS[round.status]})`}
                          >
                            {formatDuration(stageMinutes)}
                          </Badge>
                        </div>

                        <RoundTimeline round={round} />

                        <ul className="flex flex-col gap-1 text-sm">
                          {round.items.map((item) => (
                            <li key={item.id}>
                              <span className="font-medium tabular-nums">
                                {item.quantity}×
                              </span>{" "}
                              {item.productName}
                              {item.variantName ? (
                                <span className="text-muted-foreground">
                                  {" "}
                                  · {item.variantName}
                                </span>
                              ) : null}
                              {item.extras.length > 0 ? (
                                <span className="block text-xs text-muted-foreground">
                                  + {item.extras.map((extra) => extra.extraName).join(", ")}
                                </span>
                              ) : null}
                              {item.exclusions.length > 0 ? (
                                <span className="block text-xs text-muted-foreground">
                                  Sin{" "}
                                  {item.exclusions
                                    .map((exclusion) => exclusion.ingredient.name)
                                    .join(", ")}
                                </span>
                              ) : null}
                              {item.notes ? (
                                <span className="block text-xs italic text-muted-foreground">
                                  “{item.notes}”
                                </span>
                              ) : null}
                            </li>
                          ))}
                        </ul>

                        {canWork && ROUND_ACTIONS[round.status].length > 0 ? (
                          <div
                            className={cn(
                              "flex flex-wrap gap-2",
                              pendingId === round.id && "opacity-70"
                            )}
                          >
                            {ROUND_ACTIONS[round.status].map((action) => (
                              <Button
                                key={action.status}
                                size="sm"
                                variant={action.variant}
                                disabled={pendingId === round.id}
                                onClick={() =>
                                  handleTransition(round, action.status)
                                }
                              >
                                {pendingId === round.id ? (
                                  <Loader2Icon className="animate-spin" />
                                ) : null}
                                {action.label}
                              </Button>
                            ))}
                          </div>
                        ) : null}
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          )
        })}
      </div>

      {!canWork ? (
        <p className="text-xs text-muted-foreground">
          Puedes consultar el tablero, pero solo cocina o administración pueden
          cambiar el estado de las comandas.
        </p>
      ) : null}
    </div>
  )
}
