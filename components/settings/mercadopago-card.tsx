"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import {
  CheckCircle2Icon,
  CreditCardIcon,
  InfoIcon,
  RefreshCwIcon,
  UnplugIcon,
} from "lucide-react"
import { toast } from "sonner"

import {
  disconnectMercadoPago,
  setMercadoPagoTerminalMode,
  syncMercadoPagoTerminals,
  updateMercadoPagoTerminal,
} from "@/lib/mercadopago-actions"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useActionForm } from "@/hooks/use-action-form"
import type { Branch } from "@/lib/branches"
import {
  MERCADO_PAGO_OPERATING_MODES,
  type MercadoPagoStatus,
  type MercadoPagoTerminal,
} from "@/lib/mercadopago"
import { cn } from "cn"

function formatDate(value: string | null): string {
  if (!value) return "—"

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"

  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}

function Definition({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-medium break-all">{value}</span>
    </div>
  )
}

export function MercadoPagoCard({
  status,
  branches,
  connectUrl,
  canManage,
}: {
  status: MercadoPagoStatus
  branches: Branch[]
  connectUrl: string
  canManage: boolean
}) {
  const router = useRouter()
  const form = useActionForm(() => router.refresh())
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)

  const connection = status.connection
  const activeTerminals = status.terminals.filter(
    (terminal) => terminal.isActive
  )
  const branchItems = [
    { value: "none", label: "Sin asignar" },
    ...branches
      .filter((branch) => branch.isActive)
      .map((branch) => ({ value: branch.id, label: branch.name })),
  ]

  function handleSync() {
    form.run(() =>
      syncMercadoPagoTerminals().then((result) => {
        if (result.ok) {
          const count = result.data?.length ?? 0
          toast.success(
            count === 0
              ? "No encontramos terminales en esta cuenta"
              : `${count} ${count === 1 ? "terminal sincronizada" : "terminales sincronizadas"}`
          )
        }
        return result
      })
    )
  }

  function handleDisconnect() {
    form.run(() =>
      disconnectMercadoPago().then((result) => {
        if (result.ok) {
          toast.success("Mercado Pago desconectado")
        }
        return result
      })
    )
  }

  function handleBranch(
    terminal: MercadoPagoTerminal,
    value: string | null
  ) {
    const next = !value || value === "none" ? null : value
    if (next === terminal.branchId) return

    form.run(() =>
      updateMercadoPagoTerminal(terminal.id, { branchId: next }).then(
        (result) => {
          if (result.ok) toast.success("Sucursal actualizada")
          return result
        }
      )
    )
  }

  function handleDefault(terminal: MercadoPagoTerminal, checked: boolean) {
    if (checked === terminal.isDefault) return

    form.run(() =>
      updateMercadoPagoTerminal(terminal.id, { isDefault: checked }).then(
        (result) => {
          if (result.ok) {
            toast.success(
              checked
                ? "Terminal predeterminada actualizada"
                : "Terminal predeterminada desmarcada"
            )
          }
          return result
        }
      )
    )
  }

  function handleMode(terminal: MercadoPagoTerminal) {
    form.run(() =>
      setMercadoPagoTerminalMode(terminal.id, "PDV").then((result) => {
        if (result.ok) {
          toast.success("Terminal configurada en modo punto de venta")
        }
        return result
      })
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCardIcon className="size-4" />
          Mercado Pago Point
        </CardTitle>
        <CardDescription>
          Conecta la cuenta de Mercado Pago del negocio para enviar cobros a
          su terminal Point desde el punto de venta.
        </CardDescription>
        <CardAction>
          {!status.configured ? (
            <Badge variant="outline">Sin configurar</Badge>
          ) : connection ? (
            <Badge
              variant={connection.needsReconnect ? "destructive" : "secondary"}
            >
              {connection.needsReconnect ? "Reconectar" : "Conectado"}
            </Badge>
          ) : (
            <Badge variant="outline">Sin conectar</Badge>
          )}
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {!status.configured ? (
          <div className="flex items-start gap-3 rounded-lg border border-border/60 p-3 text-sm">
            <InfoIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <p className="text-muted-foreground">
              La integración con Mercado Pago todavía no está configurada en el
              servidor. Falta cargar las credenciales de la aplicación
              (MP_CLIENT_ID, MP_CLIENT_SECRET, MP_REDIRECT_URI,
              MP_WEBHOOK_SECRET y MP_TOKEN_ENCRYPTION_KEY).
            </p>
          </div>
        ) : !canManage ? (
          <div className="flex items-start gap-3 rounded-lg border border-border/60 p-3 text-sm">
            <InfoIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <p className="text-muted-foreground">
              {connection
                ? "La cuenta de Mercado Pago del negocio está conectada. Solo un administrador puede cambiarla."
                : "Solo un administrador puede conectar la cuenta de Mercado Pago del negocio."}
            </p>
          </div>
        ) : !connection ? (
          <>
            <p className="text-sm text-muted-foreground">
              Al conectar tu cuenta podrás enviar el importe de la cuenta a la
              terminal Point. Cuando el cliente pague, el pago se registrará
              solo en Naranja Pimienta.
            </p>
            <a
              href={connectUrl}
              className={cn(buttonVariants(), "w-fit")}
            >
              <CreditCardIcon data-icon="inline-start" />
              Conectar Mercado Pago
            </a>
            <p className="text-xs text-muted-foreground">
              Necesitas una terminal Point (Smart 1 o Smart 2) vinculada a la
              cuenta del negocio y configurada en modo punto de venta.
            </p>
          </>
        ) : (
          <>
            <div className="grid gap-4 rounded-lg border border-border/60 p-4 text-sm sm:grid-cols-2">
              <Definition
                label="Cuenta de Mercado Pago"
                value={connection.mpUserId}
              />
              <Definition
                label="Conectada el"
                value={formatDate(connection.connectedAt)}
              />
              <Definition
                label="Vence"
                value={formatDate(connection.expiresAt)}
              />
              <Definition
                label="Terminales activas"
                value={String(activeTerminals.length)}
              />
            </div>

            {connection.needsReconnect ? (
              <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                <InfoIcon className="mt-0.5 size-4 shrink-0" />
                <p>
                  La conexión venció o fue revocada. Vuelve a conectar la cuenta
                  para seguir cobrando en la terminal.
                </p>
              </div>
            ) : (
              <p className="flex items-start gap-2 text-xs text-muted-foreground">
                <CheckCircle2Icon className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                Los cobros se confirman solos cuando el cliente paga en la
                terminal.
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <a
                href={connectUrl}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Reconectar
              </a>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSync}
                disabled={form.pending}
              >
                <RefreshCwIcon data-icon="inline-start" />
                Actualizar terminales
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => setConfirmDisconnect(true)}
                disabled={form.pending}
              >
                <UnplugIcon data-icon="inline-start" />
                Desconectar
              </Button>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-medium">Terminales</h3>
                <span className="text-xs text-muted-foreground">
                  {activeTerminals.length === 1
                    ? "1 terminal"
                    : `${activeTerminals.length} terminales`}
                </span>
              </div>

              {status.terminals.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
                  No encontramos terminales en esta cuenta. Verifica que la
                  terminal esté vinculada a la cuenta del negocio y pulsa
                  “Actualizar terminales”. La Point Air 2 solo funciona en modo
                  autoservicio.
                </div>
              ) : (
                status.terminals.map((terminal) => (
                  <div
                    key={terminal.id}
                    className="flex flex-col gap-3 rounded-lg border border-border/60 p-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          {terminal.name ??
                            (terminal.isActive
                              ? "Terminal Point"
                              : "Terminal no disponible")}
                        </p>
                        <p className="font-mono text-xs text-muted-foreground">
                          {terminal.terminalId}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge
                          variant={terminal.isActive ? "secondary" : "outline"}
                        >
                          {terminal.isActive ? "Activa" : "Inactiva"}
                        </Badge>
                        <Badge
                          variant={
                            terminal.operatingMode === "PDV"
                              ? "secondary"
                              : "outline"
                          }
                        >
                          {terminal.operatingMode
                            ? (MERCADO_PAGO_OPERATING_MODES[
                                terminal.operatingMode
                              ] ?? terminal.operatingMode)
                            : "Modo desconocido"}
                        </Badge>
                        {terminal.isDefault ? (
                          <Badge>Predeterminada</Badge>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                        <span className="text-xs text-muted-foreground">
                          Sucursal
                        </span>
                        <Select
                          items={branchItems}
                          value={terminal.branchId ?? "none"}
                          onValueChange={(value) =>
                            handleBranch(terminal, value)
                          }
                          disabled={form.pending}
                        >
                          <SelectTrigger size="sm" aria-label="Sucursal">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {branchItems.map((item) => (
                              <SelectItem key={item.value} value={item.value}>
                                {item.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <label className="flex items-center gap-2 text-xs">
                        <Switch
                          checked={terminal.isDefault}
                          onCheckedChange={(checked) =>
                            handleDefault(terminal, checked)
                          }
                          disabled={form.pending || !terminal.isActive}
                          aria-label="Terminal predeterminada"
                        />
                        Predeterminada
                      </label>

                      {terminal.operatingMode !== "PDV" ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleMode(terminal)}
                          disabled={form.pending || !terminal.isActive}
                        >
                          Usar en punto de venta
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {form.error ? (
          <p role="alert" className="text-sm text-destructive">
            {form.error}
          </p>
        ) : null}
      </CardContent>

      <AlertDialog
        open={confirmDisconnect}
        onOpenChange={setConfirmDisconnect}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive">
              <UnplugIcon />
            </AlertDialogMedia>
            <AlertDialogTitle>
              ¿Desconectar Mercado Pago?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Se borrarán los tokens guardados y las terminales sincronizadas.
              Nadie podrá cobrar en terminal desde el POS hasta que vuelvas a
              conectar la cuenta. Los pagos ya registrados se conservan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={form.pending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDisconnect}
              disabled={form.pending}
            >
              Desconectar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
