"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  Loader2Icon,
  MonitorSmartphoneIcon,
  PlusIcon,
  QrCodeIcon,
  Trash2Icon,
} from "lucide-react"
import QRCode from "react-qr-code"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Branch } from "@/lib/branches"
import {
  createPosPairing,
  revokePosDevice,
} from "@/lib/pos-device-actions"
import type { PosPairingCode, PosPairedDevice } from "@/lib/pos-device"

/**
 * Cajas vinculadas por QR.
 *
 * El QR contiene un código de un solo uso; la tablet lo abre y queda vinculada
 * a la sucursal. Después el equipo entra con su PIN sin escribir contraseñas.
 */
export function PosDevicesCard({
  devices,
  branches,
  canManage,
}: {
  devices: PosPairedDevice[]
  branches: Branch[]
  canManage: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [branchId, setBranchId] = React.useState("none")
  const [pairing, setPairing] = React.useState<PosPairingCode | null>(null)
  const [pending, setPending] = React.useState(false)
  const [revoking, setRevoking] = React.useState<PosPairedDevice | null>(null)

  const generate = async () => {
    setPending(true)

    try {
      const result = await createPosPairing(
        branchId === "none" ? undefined : branchId
      )

      if (!result.ok || !result.data) {
        toast.error(result.message ?? "No se pudo generar el código")
        return
      }

      setPairing(result.data)
    } finally {
      setPending(false)
    }
  }

  const revoke = async () => {
    if (!revoking) return

    setPending(true)

    try {
      const result = await revokePosDevice(revoking.id)

      if (!result.ok) {
        toast.error(result.message ?? "No se pudo revocar la caja")
        return
      }

      toast.success("Caja revocada")
      setRevoking(null)
      router.refresh()
    } finally {
      setPending(false)
    }
  }

  const closeDialog = (next: boolean) => {
    setOpen(next)

    if (!next) {
      if (pairing) {
        router.refresh()
      }
      setPairing(null)
      setBranchId("none")
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cajas vinculadas</CardTitle>
        <CardDescription>
          Vincula una tablet o computadora con un QR. El equipo entra con su PIN
          sin escribir la contraseña.
        </CardDescription>
        {canManage ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-fit"
            onClick={() => setOpen(true)}
          >
            <PlusIcon data-icon="inline-start" />
            Vincular caja
          </Button>
        ) : null}
      </CardHeader>

      <CardContent className="gap-3">
        {devices.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            Todavía no hay cajas vinculadas. Genera un QR y ábrelo en la tablet
            del local.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {devices.map((device) => (
              <li
                key={device.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
              >
                <div className="flex min-w-0 items-start gap-2">
                  <MonitorSmartphoneIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium">
                      {device.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {device.branch?.name ?? "Todas las sucursales"}
                      {device.pairedBy?.name || device.pairedBy?.username
                        ? ` · vinculada por ${device.pairedBy.name ?? device.pairedBy.username}`
                        : ""}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {device.lastSeenAt
                        ? `Último uso ${new Date(
                            device.lastSeenAt
                          ).toLocaleString("es-MX", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}`
                        : "Sin uso todavía"}
                    </span>
                  </div>
                </div>

                {canManage ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Revocar ${device.name}`}
                    onClick={() => setRevoking(device)}
                  >
                    <Trash2Icon />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={closeDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Vincular una caja</DialogTitle>
            <DialogDescription>
              Genera el código y ábrelo en la tablet. El código caduca en 10
              minutos y solo se puede usar una vez.
            </DialogDescription>
          </DialogHeader>

          {pairing ? (
            <div className="flex flex-col items-center gap-3">
              <div className="rounded-xl border bg-white p-3">
                <QRCode value={pairing.url} size={180} />
              </div>
              <p className="text-center text-sm text-muted-foreground">
                Escanea el QR o abre este enlace en la tablet:
              </p>
              <code className="w-full break-all rounded-md bg-muted px-2 py-1 text-center text-xs">
                {pairing.url}
              </code>
              <p className="text-xs text-muted-foreground">
                Código: <span className="font-mono">{pairing.code}</span> ·
                caduca{" "}
                {new Date(pairing.expiresAt).toLocaleTimeString("es-MX", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Label htmlFor="pairing-branch">Sucursal</Label>
              <Select
                value={branchId}
                onValueChange={(value) => setBranchId(value ?? "none")}
                items={[
                  { value: "none", label: "Todas las sucursales" },
                  ...branches
                    .filter((branch) => branch.isActive)
                    .map((branch) => ({ value: branch.id, label: branch.name })),
                ]}
              >
                <SelectTrigger id="pairing-branch" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Todas las sucursales</SelectItem>
                  {branches
                    .filter((branch) => branch.isActive)
                    .map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <DialogFooter>
            {pairing ? (
              <Button type="button" onClick={() => closeDialog(false)}>
                Listo
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => closeDialog(false)}
                  disabled={pending}
                >
                  Cancelar
                </Button>
                <Button type="button" onClick={generate} disabled={pending}>
                  {pending ? (
                    <Loader2Icon className="animate-spin" />
                  ) : (
                    <QrCodeIcon />
                  )}
                  Generar QR
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(revoking)}
        onOpenChange={(next) => !next && setRevoking(null)}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive">
              <Trash2Icon />
            </AlertDialogMedia>
            <AlertDialogTitle>Revocar {revoking?.name}</AlertDialogTitle>
            <AlertDialogDescription>
              La caja dejará de aceptar el PIN del equipo. Puedes vincularla de
              nuevo con un QR.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={revoke}
              disabled={pending}
            >
              Revocar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
