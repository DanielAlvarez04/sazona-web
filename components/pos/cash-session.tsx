"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  ArrowDownToLineIcon,
  ArrowUpFromLineIcon,
  ChevronDownIcon,
  Loader2Icon,
  LockIcon,
  ReceiptTextIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { Textarea } from "@/components/ui/textarea"
import { formatMoney } from "@/lib/catalog"
import {
  addCashMovement,
  closeCashSession,
  openCashSession,
} from "@/lib/cash-actions"
import {
  CASH_MOVEMENT_LABELS,
  type CashMovementType,
  type CashSession,
  type CashSummary,
} from "@/lib/cash"

const MOVEMENT_TYPES: CashMovementType[] = [
  "WITHDRAWAL",
  "DEPOSIT",
  "EXPENSE",
]

/**
 * Acciones de caja para la barra del POS: apertura, cierre ciego y movimientos.
 *
 * La caja se maneja por sucursal: si no hay una abierta, el POS bloquea los
 * cobros hasta que caja o administración la abran.
 */
export function CashSessionActions({
  session,
  summary,
  canManage,
}: {
  session: CashSession | null
  summary: CashSummary | null
  canManage: boolean
}) {
  const router = useRouter()
  const [openOpen, setOpenOpen] = React.useState(false)
  const [openClose, setOpenClose] = React.useState(false)
  const [openMovement, setOpenMovement] = React.useState(false)

  if (!canManage) return null

  return (
    <>
      {session ? (
        <ButtonGroup>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setOpenClose(true)}
          >
            <LockIcon data-icon="inline-start" />
            Cerrar caja
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  aria-label="Más acciones de caja"
                />
              }
            >
              <ChevronDownIcon />
              <span className="sr-only">Más acciones de caja</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setOpenMovement(true)}>
                <ArrowDownToLineIcon />
                Movimiento
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </ButtonGroup>
      ) : (
        <Button type="button" size="sm" onClick={() => setOpenOpen(true)}>
          <ReceiptTextIcon data-icon="inline-start" />
          Abrir caja
        </Button>
      )}

      <OpenDialog
        open={openOpen}
        onOpenChange={setOpenOpen}
        onDone={() => router.refresh()}
      />
      {session ? (
        <CloseDialog
          open={openClose}
          onOpenChange={setOpenClose}
          session={session}
          summary={summary}
          onDone={() => router.refresh()}
        />
      ) : null}
      {session ? (
        <MovementDialog
          open={openMovement}
          onOpenChange={setOpenMovement}
          session={session}
          onDone={() => router.refresh()}
        />
      ) : null}
    </>
  )
}

function OpenDialog({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onDone: () => void
}) {
  const [openingFloat, setOpeningFloat] = React.useState("0")
  const [pending, setPending] = React.useState(false)

  const submit = async () => {
    const value = Number(openingFloat)

    if (!Number.isFinite(value) || value < 0) {
      toast.error("Escribe un fondo inicial válido")
      return
    }

    setPending(true)

    try {
      const result = await openCashSession(Math.round(value * 100) / 100)

      if (!result.ok) {
        toast.error(result.message ?? "No se pudo abrir la caja")
        return
      }

      toast.success("Caja abierta")
      setOpeningFloat("0")
      onOpenChange(false)
      onDone()
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Abrir caja</DialogTitle>
          <DialogDescription>
            Registra el fondo inicial con el que empieza el turno.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <Label htmlFor="opening-float">Fondo inicial</Label>
          <Input
            id="opening-float"
            type="number"
            inputMode="decimal"
            min="0"
            value={openingFloat}
            onChange={(event) => setOpeningFloat(event.target.value)}
          />
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancelar
          </Button>
          <Button type="button" onClick={submit} disabled={pending}>
            {pending ? <Loader2Icon className="animate-spin" /> : null}
            Abrir caja
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CloseDialog({
  open,
  onOpenChange,
  session,
  summary,
  onDone,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  session: CashSession
  summary: CashSummary | null
  onDone: () => void
}) {
  const [countedCash, setCountedCash] = React.useState("")
  const [notes, setNotes] = React.useState("")
  const [pending, setPending] = React.useState(false)

  // Conteo ciego: no se muestra el esperado antes de cerrar.
  const submit = async () => {
    const value = Number(countedCash)

    if (!Number.isFinite(value) || value < 0) {
      toast.error("Escribe el efectivo contado")
      return
    }

    setPending(true)

    try {
      const result = await closeCashSession(session.id, {
        countedCash: Math.round(value * 100) / 100,
        notes: notes.trim() || undefined,
      })

      if (!result.ok || !result.data) {
        toast.error(result.message ?? "No se pudo cerrar la caja")
        return
      }

      const closed = result.data.session

      if (!closed) {
        toast.error("No se pudo leer la caja cerrada")
        return
      }

      const difference = Number(closed.difference ?? 0)
      const expected = Number(closed.expectedCash ?? 0)

      toast.success(
        difference === 0
          ? "Caja cerrada sin diferencias"
          : `Caja cerrada · ${difference > 0 ? "sobrante" : "faltante"} de ${formatMoney(Math.abs(difference))}`,
        {
          description: `Esperado ${formatMoney(expected)} · contado ${formatMoney(closed.countedCash ?? 0)}`,
        }
      )

      setCountedCash("")
      setNotes("")
      onOpenChange(false)
      onDone()
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cerrar caja</DialogTitle>
          <DialogDescription>
            Cuenta el efectivo del cajón sin ver el esperado. La diferencia se
            muestra al cerrar y queda auditada.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
            Fondo inicial {formatMoney(session.openingFloat)}
            {summary ? (
              <>
                {" · "}Ventas en efectivo {formatMoney(summary.cash.sales)}
                {summary.cash.withdrawals > 0
                  ? ` · Retiros ${formatMoney(summary.cash.withdrawals)}`
                  : ""}
              </>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="counted-cash">Efectivo contado</Label>
            <Input
              id="counted-cash"
              type="number"
              inputMode="decimal"
              min="0"
              value={countedCash}
              onChange={(event) => setCountedCash(event.target.value)}
              placeholder="0.00"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="close-notes">Notas (opcional)</Label>
            <Textarea
              id="close-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              maxLength={500}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancelar
          </Button>
          <Button type="button" onClick={submit} disabled={pending}>
            {pending ? <Loader2Icon className="animate-spin" /> : null}
            Cerrar caja
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function MovementDialog({
  open,
  onOpenChange,
  session,
  onDone,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  session: CashSession
  onDone: () => void
}) {
  const [type, setType] = React.useState<CashMovementType>("WITHDRAWAL")
  const [amount, setAmount] = React.useState("")
  const [reason, setReason] = React.useState("")
  const [pending, setPending] = React.useState(false)

  const submit = async () => {
    const value = Number(amount)

    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Escribe un importe válido")
      return
    }

    if (!reason.trim()) {
      toast.error("Explica el motivo del movimiento")
      return
    }

    setPending(true)

    try {
      const result = await addCashMovement(session.id, {
        type,
        amount: Math.round(value * 100) / 100,
        reason: reason.trim(),
      })

      if (!result.ok) {
        toast.error(result.message ?? "No se pudo registrar el movimiento")
        return
      }

      toast.success(`${CASH_MOVEMENT_LABELS[type]} registrado`)
      setAmount("")
      setReason("")
      onOpenChange(false)
      onDone()
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Movimiento de efectivo</DialogTitle>
          <DialogDescription>
            Retiros, ingresos o gastos que afectan el cajón del turno.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="movement-type">Tipo</Label>
            <Select
              value={type}
              onValueChange={(value) =>
                setType((value ?? "WITHDRAWAL") as CashMovementType)
              }
              items={MOVEMENT_TYPES.map((value) => ({
                value,
                label: CASH_MOVEMENT_LABELS[value],
              }))}
            >
              <SelectTrigger id="movement-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MOVEMENT_TYPES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {CASH_MOVEMENT_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="movement-amount">Importe</Label>
            <Input
              id="movement-amount"
              type="number"
              inputMode="decimal"
              min="0"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="movement-reason">Motivo</Label>
            <Input
              id="movement-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={200}
              placeholder="Ej. Retiro para compra de hielo"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancelar
          </Button>
          <Button type="button" onClick={submit} disabled={pending}>
            {pending ? (
              <Loader2Icon className="animate-spin" />
            ) : type === "DEPOSIT" ? (
              <ArrowUpFromLineIcon />
            ) : (
              <ArrowDownToLineIcon />
            )}
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
