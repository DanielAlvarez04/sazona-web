"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Loader2Icon, LockIcon, Undo2Icon } from "lucide-react"
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

const METHODS: PaymentMethod[] = ["CASH", "CARD", "TRANSFER"]

export function ChargeDialog({
  order,
  canConfirm,
  canRefund,
  onClose,
  onClosed,
}: {
  order: Order
  canConfirm: boolean
  canRefund: boolean
  onClose: () => void
  onClosed: () => void
}) {
  const router = useRouter()

  const balance = Number(order.balance ?? order.total)
  const payments = order.payments ?? []
  const pendingPayments = payments.filter(
    (payment) => payment.status === "PENDING"
  )

  const [method, setMethod] = React.useState<PaymentMethod>("CASH")
  const [amountInput, setAmountInput] = React.useState<string | null>(null)
  const [reason, setReason] = React.useState("")
  const [pending, setPending] = React.useState<string | null>(null)

  // Sin edición manual el importe sigue al saldo, que se actualiza al cobrar.
  const amount = amountInput ?? Math.max(balance, 0).toFixed(2)
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
                          reason.trim() || undefined
                        ),
                      payment.status === "PENDING"
                        ? "Pago anulado"
                        : "Pago reembolsado"
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

          {!canClose ? (
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
                    items={METHODS.map((value) => ({
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
                      {METHODS.map((value) => (
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
                    step="0.01"
                    min="0"
                    value={amount}
                    onChange={(event) => setAmountInput(event.target.value)}
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
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
              </div>

              {!canConfirm ? (
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
              <Label htmlFor="payment-reason">Motivo de reembolso</Label>
              <Input
                id="payment-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Opcional, queda en la auditoría"
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
}: {
  payment: Payment
  pending: string | null
  canConfirm: boolean
  canRefund: boolean
  reason: string
  onConfirm: () => void
  onVoid: () => void
}) {
  const isPending = payment.status === "PENDING"
  const isConfirmed = payment.status === "CONFIRMED"
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

        {isPending && canConfirm ? (
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

        {isConfirmed && canRefund ? (
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
