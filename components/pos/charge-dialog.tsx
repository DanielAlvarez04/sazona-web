"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  CheckCircle2Icon,
  CircleAlertIcon,
  Loader2Icon,
  LockIcon,
  RefreshCwIcon,
  Undo2Icon,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { formatMoney } from "@/lib/catalog"
import {
  confirmPayment,
  closeOrder,
  registerPayment,
  voidPayment,
} from "@/lib/payment-actions"
import {
  orderLabel,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  type Order,
  type Payment,
  type PaymentMethod,
} from "@/lib/orders"
import {
  cancelPointCharge,
  chargeWithPoint,
  syncPointPayment,
  type PointPayment,
} from "@/lib/mercadopago-actions"
import type { MercadoPagoPointConfig } from "@/lib/mercadopago"

const BASE_METHODS: PaymentMethod[] = ["CASH", "CARD", "TRANSFER"]

const PROVIDER_DETAIL_LABELS: Record<string, string> = {
  rejected_by_issuer: "Rechazado por el banco emisor",
  insufficient_amount: "Fondos insuficientes",
  bad_filled_card_data: "Datos de la tarjeta incorrectos",
  high_risk: "Rechazado por riesgo",
  processing_error: "Error de procesamiento",
  canceled_on_terminal: "Cancelado en la terminal",
  canceled_by_api: "Cancelado desde la app",
  expired: "Expiró el tiempo para pagar",
  failed: "Pago rechazado",
}

export function ChargeDialog({
  order,
  canConfirm,
  canRefund,
  mercadoPago,
  defaultTipPercent = 0,
  displayTipPercent = null,
  onClose,
  onClosed,
}: {
  order: Order
  canConfirm: boolean
  canRefund: boolean
  mercadoPago: MercadoPagoPointConfig
  /** Porcentaje de propina sugerido por la sucursal (0 = sin sugerencia). */
  defaultTipPercent?: number
  /** Propina elegida por el cliente en la pantalla, si la hay. */
  displayTipPercent?: number | null
  onClose: () => void
  onClosed: () => void
}) {
  const router = useRouter()

  const balance = Number(order.balance ?? order.total)
  const payments = order.payments ?? []
  const pendingPayments = payments.filter(
    (payment) => payment.status === "PENDING"
  )

  const methods: PaymentMethod[] = React.useMemo(
    () =>
      mercadoPago.enabled
        ? [...BASE_METHODS, "MERCADO_PAGO_POINT"]
        : BASE_METHODS,
    [mercadoPago.enabled]
  )

  const [method, setMethod] = React.useState<PaymentMethod>("CASH")
  const [terminalId, setTerminalId] = React.useState(
    () =>
      mercadoPago.terminals.find((terminal) => terminal.isDefault)?.id ??
      mercadoPago.terminals[0]?.id ??
      ""
  )
  const [amountInput, setAmountInput] = React.useState<string | null>(null)
  const initialTipPercent = displayTipPercent ?? defaultTipPercent
  const [tipInput, setTipInput] = React.useState(() =>
    initialTipPercent > 0
      ? ((Math.max(balance, 0) * initialTipPercent) / 100).toFixed(2)
      : ""
  )
  const [cashInput, setCashInput] = React.useState("")
  const [reason, setReason] = React.useState("")
  const [pending, setPending] = React.useState<string | null>(null)
  const [pointPayment, setPointPayment] =
    React.useState<PointPayment | null>(null)
  const [pointTimedOut, setPointTimedOut] = React.useState(false)
  const pointDeadline = React.useRef<number | null>(null)

  // Sin edición manual el importe sigue al saldo, que se actualiza al cobrar.
  const amount = amountInput ?? Math.max(balance, 0).toFixed(2)
  const saleAmount = Math.max(Number(amount) || 0, 0)
  const tip = Math.max(Number(tipInput) || 0, 0)
  const chargeTotal = Math.round((saleAmount + tip) * 100) / 100
  const cashReceived = Math.max(Number(cashInput) || 0, 0)
  const change = Math.round((cashReceived - chargeTotal) * 100) / 100
  const canClose = balance <= 0.004

  const refresh = () => router.refresh()

  const submit = async (
    key: string,
    action: () => Promise<{ ok: boolean; message?: string }>,
    success: string
  ) => {
    setPending(key)

    try {
      const result = await action()

      if (!result.ok) {
        toast.error(result.message ?? "No se pudo completar la operación")
        return
      }

      toast.success(success)
      setAmountInput(null)
      refresh()
    } catch {
      toast.error("No se pudo completar la operación")
    } finally {
      setPending(null)
    }
  }

  const handleRegister = (andConfirm: boolean) =>
    submit(
      "register",
      async () => {
        const value = Number(amount)

        if (!Number.isFinite(value) || value <= 0) {
          return { ok: false, message: "Escribe un importe válido" }
        }

        const created = await registerPayment(order.id, {
          method,
          amount: Math.round(value * 100) / 100,
          tipAmount: Math.round(tip * 100) / 100,
          ...(method === "CASH" && cashInput
            ? { cashReceived: Math.round(cashReceived * 100) / 100 }
            : {}),
          idempotencyKey: crypto.randomUUID(),
        })

        if (!created.ok || !created.data) {
          return { ok: false, message: created.message }
        }

        if (!andConfirm) {
          return { ok: true }
        }

        return confirmPayment(created.data.id)
      },
      andConfirm ? "Pago registrado y confirmado" : "Pago registrado"
    )

  const handleClose = () =>
    submit(
      "close",
      async () => {
        const result = await closeOrder(order.id)

        if (result.ok) {
          onClosed()
        }

        return result
      },
      "Cuenta cerrada"
    )

  const terminalLabel =
    mercadoPago.terminals.find((terminal) => terminal.id === terminalId)
      ?.name ?? "Terminal Point"

  React.useEffect(() => {
    if (!pointPayment || pointPayment.status !== "PENDING") return

    let cancelled = false
    let timer: ReturnType<typeof setInterval> | null = null

    const tick = async () => {
      if (cancelled) return

      if (
        pointDeadline.current !== null &&
        Date.now() > pointDeadline.current
      ) {
        setPointTimedOut(true)
        cancelled = true
        if (timer) clearInterval(timer)
        return
      }

      const result = await syncPointPayment(pointPayment.id)
      if (cancelled || !result.ok || !result.data) return

      const next = result.data
      setPointPayment(next)

      if (next.status === "CONFIRMED") {
        toast.success("Pago confirmado en la terminal")
        setAmountInput(null)
        router.refresh()
      } else if (next.status !== "PENDING") {
        toast.error(
          PROVIDER_DETAIL_LABELS[next.providerStatusDetail ?? ""] ??
            next.providerStatusDetail ??
            "El cobro no se completó"
        )
        router.refresh()
      }
    }

    timer = setInterval(() => void tick(), 2500)

    return () => {
      cancelled = true
      if (timer) clearInterval(timer)
    }
  }, [pointPayment, router])

  const handleSyncNow = async () => {
    if (!pointPayment) return

    setPending("sync")

    try {
      const result = await syncPointPayment(pointPayment.id)

      if (!result.ok || !result.data) {
        toast.error(result.message ?? "No se pudo sincronizar el cobro")
        return
      }

      setPointPayment(result.data)

      if (result.data.status === "CONFIRMED") {
        toast.success("Pago confirmado en la terminal")
        setAmountInput(null)
        router.refresh()
      } else if (result.data.status !== "PENDING") {
        toast.error(
          PROVIDER_DETAIL_LABELS[result.data.providerStatusDetail ?? ""] ??
            result.data.providerStatusDetail ??
            "El cobro no se completó"
        )
        router.refresh()
      } else {
        toast.info("Todavía no hay pago en la terminal")
      }
    } finally {
      setPending(null)
    }
  }

  const resetPointCharge = () => {
    setPointPayment(null)
    setPointTimedOut(false)
    setAmountInput(null)
    pointDeadline.current = null
  }

  const handleCancelPoint = async () => {
    if (!pointPayment) return

    setPending("cancel-point")

    try {
      const result = await cancelPointCharge(pointPayment.id)

      if (!result.ok || !result.data) {
        toast.error(result.message ?? "No se pudo cancelar el cobro")
        return
      }

      setPointPayment(result.data)

      if (result.data.status === "CANCELLED") {
        toast.success("Cobro cancelado")
        resetPointCharge()
        router.refresh()
      } else {
        toast.info("Cancelación solicitada. Confirma en la terminal.")
      }
    } finally {
      setPending(null)
    }
  }

  const handleSendToPoint = async () => {
    const value = Number(amount)

    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Escribe un importe válido")
      return
    }

    const terminal = terminalId || mercadoPago.terminals[0]?.id

    if (!terminal) {
      toast.error("Configura una terminal en Configuración → Pagos")
      return
    }

    setPending("point")
    setPointTimedOut(false)

    try {
      const result = await chargeWithPoint(order.id, {
        amount: Math.round(value * 100) / 100,
        terminalId: terminal,
        idempotencyKey: crypto.randomUUID(),
      })

      if (!result.ok || !result.data) {
        toast.error(result.message ?? "No se pudo enviar el cobro")
        return
      }

      pointDeadline.current = Date.now() + 3 * 60 * 1000
      setPointPayment(result.data)
      toast.success("Cobro enviado a la terminal")
      router.refresh()
    } finally {
      setPending(null)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Cobrar · {orderLabel(order)}</DialogTitle>
          <DialogDescription>
            Registra el pago y confírmalo. Un pago pendiente no cubre el saldo.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-2 rounded-lg border bg-muted/30 p-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="font-semibold tabular-nums">
                {formatMoney(order.total)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pagado</p>
              <p className="font-semibold tabular-nums">
                {formatMoney(order.paidTotal ?? 0)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Saldo</p>
              <p className="font-semibold tabular-nums">
                {formatMoney(Math.max(balance, 0))}
              </p>
            </div>
          </div>

          {payments.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {payments.map((payment) => (
                <PaymentRow
                  key={payment.id}
                  payment={payment}
                  pending={pending}
                  canConfirm={canConfirm}
                  canRefund={canRefund}
                  reason={reason}
                  onConfirm={() =>
                    submit(
                      `confirm-${payment.id}`,
                      () => confirmPayment(payment.id),
                      "Pago confirmado"
                    )
                  }
                  onVoid={() =>
                    submit(
                      `void-${payment.id}`,
                      () =>
                        voidPayment(
                          payment.id,
                          reason.trim() ||
                            (payment.status === "PENDING"
                              ? "Anulado desde el punto de venta"
                              : "Reembolso desde el punto de venta")
                        ),
                      payment.status === "PENDING"
                        ? "Pago anulado"
                        : "Pago reembolsado"
                    )
                  }
                  onCancelPoint={() =>
                    submit(
                      `void-${payment.id}`,
                      () => cancelPointCharge(payment.id),
                      "Cobro anulado"
                    )
                  }
                />
              ))}
            </ul>
          ) : (
            <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
              Todavía no hay pagos registrados.
            </p>
          )}

          {pointPayment ? (
            <div className="flex flex-col gap-3 rounded-lg border p-4">
              {pointPayment.status === "PENDING" ? (
                <>
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Loader2Icon className="size-4 animate-spin" />
                    Esperando el pago en la terminal…
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {formatMoney(pointPayment.amount)} · {terminalLabel}
                  </p>
                  {pointPayment.providerStatus === "action_required" ? (
                    <p className="flex items-start gap-2 text-sm text-amber-600 dark:text-amber-400">
                      <CircleAlertIcon className="mt-0.5 size-4 shrink-0" />
                      La terminal pide confirmación. Revisa el dispositivo y
                      vuelve a sincronizar.
                    </p>
                  ) : null}
                  {pointTimedOut ? (
                    <p className="text-xs text-muted-foreground">
                      Han pasado más de 3 minutos. Revisa la terminal y pulsa
                      “Sincronizar ahora”.
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleSyncNow}
                      disabled={pending !== null}
                    >
                      <RefreshCwIcon data-icon="inline-start" />
                      Sincronizar ahora
                    </Button>
                    {canConfirm ? (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={handleCancelPoint}
                        disabled={pending !== null}
                      >
                        <Undo2Icon data-icon="inline-start" />
                        Cancelar cobro
                      </Button>
                    ) : null}
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {pointPayment.status === "CONFIRMED" ? (
                      <CheckCircle2Icon className="size-4 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <CircleAlertIcon className="size-4 text-destructive" />
                    )}
                    {pointPayment.status === "CONFIRMED"
                      ? "Pago confirmado en la terminal"
                      : "Cobro no completado"}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {formatMoney(pointPayment.amount)} ·{" "}
                    {PROVIDER_DETAIL_LABELS[
                      pointPayment.providerStatusDetail ?? ""
                    ] ??
                      pointPayment.providerStatusDetail ??
                      (pointPayment.status === "CONFIRMED"
                        ? "El pago ya cubre parte del saldo."
                        : "Puedes intentarlo de nuevo.")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" onClick={resetPointCharge}>
                      Nuevo cobro
                    </Button>
                  </div>
                </>
              )}
            </div>
          ) : !canClose ? (
            <>
              <Separator />
              <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="payment-method">Método</Label>
                  <Select
                    value={method}
                    onValueChange={(value) =>
                      setMethod((value ?? "CASH") as PaymentMethod)
                    }
                    items={methods.map((value) => ({
                      value,
                      label: PAYMENT_METHOD_LABELS[value],
                    }))}
                  >
                    <SelectTrigger
                      id="payment-method"
                      className="w-full"
                      aria-label="Método de pago"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {methods.map((value) => (
                        <SelectItem key={value} value={value}>
                          {PAYMENT_METHOD_LABELS[value]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="payment-amount">Importe</Label>
                  <Input
                    id="payment-amount"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    value={amount}
                    onChange={(event) => setAmountInput(event.target.value)}
                  />
                </div>
              </div>

              {method !== "MERCADO_PAGO_POINT" ? (
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Label htmlFor="payment-tip">Propina</Label>
                    <div className="flex items-center gap-1">
                      {[0, 10, 15, 20].map((percent) => (
                        <Button
                          key={percent}
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          onClick={() =>
                            setTipInput(
                              percent === 0
                                ? ""
                                : (
                                    Math.round(saleAmount * percent) / 100
                                  ).toFixed(2)
                            )
                          }
                        >
                          {percent === 0 ? "Sin propina" : `${percent}%`}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <Input
                    id="payment-tip"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    value={tipInput}
                    onChange={(event) => setTipInput(event.target.value)}
                    placeholder="0.00"
                  />
                  {tip > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Total a cobrar{" "}
                      <span className="font-medium text-foreground tabular-nums">
                        {formatMoney(chargeTotal)}
                      </span>{" "}
                      · propina{" "}
                      <span className="font-medium text-foreground tabular-nums">
                        {formatMoney(tip)}
                      </span>
                    </p>
                  ) : null}
                  {displayTipPercent && displayTipPercent > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Propina elegida por el cliente en la pantalla (
                      {displayTipPercent}%).
                    </p>
                  ) : null}
                </div>
              ) : null}

              {method === "CASH" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="payment-cash">Efectivo recibido</Label>
                    <Input
                      id="payment-cash"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      value={cashInput}
                      onChange={(event) => setCashInput(event.target.value)}
                      placeholder="Opcional"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label>Cambio</Label>
                    <div className="flex h-9 items-center rounded-md border border-input px-3 text-sm tabular-nums">
                      {cashInput
                        ? change >= 0
                          ? formatMoney(change)
                          : "Falta efectivo"
                        : "—"}
                    </div>
                  </div>
                </div>
              ) : null}

              {method === "MERCADO_PAGO_POINT" ? (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="point-terminal">Terminal</Label>
                  <Select
                    value={terminalId}
                    onValueChange={(value) => setTerminalId(value ?? "")}
                    items={mercadoPago.terminals.map((terminal) => ({
                      value: terminal.id,
                      label: terminal.name ?? "Terminal Point",
                    }))}
                  >
                    <SelectTrigger
                      id="point-terminal"
                      className="w-full"
                      aria-label="Terminal Point"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {mercadoPago.terminals.map((terminal) => (
                        <SelectItem key={terminal.id} value={terminal.id}>
                          {terminal.name ?? "Terminal Point"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    El cobro se envía a la terminal y se confirma solo cuando el
                    cliente paga.
                  </p>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                {method === "MERCADO_PAGO_POINT" ? (
                  <Button
                    type="button"
                    onClick={handleSendToPoint}
                    disabled={pending !== null || !terminalId}
                  >
                    {pending === "point" ? (
                      <Loader2Icon className="animate-spin" />
                    ) : null}
                    Enviar a terminal
                  </Button>
                ) : (
                  <>
                    <Button
                      type="button"
                      onClick={() => handleRegister(false)}
                      disabled={pending !== null}
                    >
                      {pending === "register" ? (
                        <Loader2Icon className="animate-spin" />
                      ) : null}
                      Registrar pago
                    </Button>
                    {canConfirm ? (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => handleRegister(true)}
                        disabled={pending !== null}
                      >
                        Registrar y confirmar
                      </Button>
                    ) : null}
                  </>
                )}
              </div>

              {method !== "MERCADO_PAGO_POINT" && !canConfirm ? (
                <p className="text-xs text-muted-foreground">
                  Tu rol puede registrar pagos; caja o administración los
                  confirma.
                </p>
              ) : null}

              {pendingPayments.length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  {pendingPayments.length} pago(s) pendiente(s) de confirmación.
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              La cuenta está cubierta. Puedes cerrarla.
            </p>
          )}

          {canRefund && payments.some((payment) => payment.status === "CONFIRMED") ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="payment-reason">Motivo (obligatorio)</Label>
              <Input
                id="payment-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Explica el reembolso; queda en la auditoría"
                maxLength={200}
              />
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Volver
          </Button>
          {canConfirm ? (
            <Button
              type="button"
              onClick={handleClose}
              disabled={!canClose || pending !== null}
            >
              {pending === "close" ? (
                <Loader2Icon className="animate-spin" />
              ) : (
                <LockIcon />
              )}
              Cerrar cuenta
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PaymentRow({
  payment,
  pending,
  canConfirm,
  canRefund,
  onConfirm,
  onVoid,
  onCancelPoint,
}: {
  payment: Payment
  pending: string | null
  canConfirm: boolean
  canRefund: boolean
  reason: string
  onConfirm: () => void
  onVoid: () => void
  onCancelPoint: () => void
}) {
  const isPending = payment.status === "PENDING"
  const isConfirmed = payment.status === "CONFIRMED"
  const isPoint = payment.method === "MERCADO_PAGO_POINT"
  const busy = pending === `confirm-${payment.id}` || pending === `void-${payment.id}`

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2 text-sm">
      <div className="flex flex-col">
        <span className="font-medium">
          {PAYMENT_METHOD_LABELS[payment.method]} ·{" "}
          <span className="tabular-nums">{formatMoney(payment.amount)}</span>
        </span>
        <span className="text-xs text-muted-foreground">
          {payment.user?.name ?? payment.user?.username ?? "Sin usuario"} ·{" "}
          {new Date(payment.createdAt).toLocaleString("es-MX", {
            dateStyle: "short",
            timeStyle: "short",
          })}
        </span>
        {isPoint && payment.providerOrderId ? (
          <span className="font-mono text-[10px] text-muted-foreground">
            {payment.providerOrderId}
          </span>
        ) : null}
        {isPoint && payment.providerStatusDetail && !isConfirmed ? (
          <span className="text-xs text-destructive">
            {PROVIDER_DETAIL_LABELS[payment.providerStatusDetail] ??
              payment.providerStatusDetail}
          </span>
        ) : null}
        {Number(payment.tipAmount ?? 0) > 0 ? (
          <span className="text-xs text-emerald-600 dark:text-emerald-400">
            + propina {formatMoney(payment.tipAmount ?? 0)}
            {payment.tipRecipient?.name
              ? ` · ${payment.tipRecipient.name}`
              : ""}
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <Badge
          variant={
            isConfirmed
              ? "secondary"
              : isPending
                ? "outline"
                : "destructive"
          }
        >
          {PAYMENT_STATUS_LABELS[payment.status]}
        </Badge>

        {isPending && canConfirm && !isPoint ? (
          <>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={onConfirm}
              disabled={busy}
            >
              Confirmar
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={onVoid}
              disabled={busy}
            >
              <Undo2Icon />
              Anular
            </Button>
          </>
        ) : null}

        {isPending && isPoint && canConfirm ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onCancelPoint}
            disabled={busy}
          >
            <Undo2Icon />
            Anular
          </Button>
        ) : null}

        {isConfirmed && canRefund && !isPoint ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onVoid}
            disabled={busy}
          >
            <Undo2Icon />
            Reembolsar
          </Button>
        ) : null}
      </div>
    </li>
  )
}
