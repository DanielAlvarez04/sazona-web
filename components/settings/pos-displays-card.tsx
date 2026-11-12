"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  Loader2Icon,
  MonitorPlayIcon,
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
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
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
  createPosDisplay,
  revokePosDisplay,
} from "@/lib/pos-display-actions"
import type { PosDisplayCreated, PosDisplayInfo } from "@/lib/pos-display"

/**
 * Pantallas de cliente (monitor o tablet frente al cliente).
 *
 * La pantalla muestra el pedido en vivo, permite elegir propina y confirmar.
 * Se abre con el enlace/QR y no requiere sesión.
 */
export function PosDisplaysCard({
  displays,
  branches,
  canManage,
}: {
  displays: PosDisplayInfo[]
  branches: Branch[]
  canManage: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState("")
  const [branchId, setBranchId] = React.useState("none")
  const [created, setCreated] = React.useState<PosDisplayCreated | null>(null)
  const [pending, setPending] = React.useState(false)
  const [revoking, setRevoking] = React.useState<PosDisplayInfo | null>(null)

  const create = async () => {
    setPending(true)

    try {
      const result = await createPosDisplay({
        name: name.trim() || undefined,
        branchId: branchId === "none" ? undefined : branchId,
      })

      if (!result.ok || !result.data) {
        toast.error(result.message ?? "No se pudo crear la pantalla")
        return
      }

      setCreated(result.data)
    } finally {
      setPending(false)
    }
  }

  const revoke = async () => {
    if (!revoking) return

    setPending(true)

    try {
      const result = await revokePosDisplay(revoking.id)

      if (!result.ok) {
        toast.error(result.message ?? "No se pudo revocar la pantalla")
        return
      }

      toast.success("Pantalla revocada")
      setRevoking(null)
      router.refresh()
    } finally {
      setPending(false)
    }
  }

  const closeDialog = (next: boolean) => {
    setOpen(next)

    if (!next) {
      if (created) router.refresh()
      setCreated(null)
      setName("")
      setBranchId("none")
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pantalla de cliente</CardTitle>
        <CardDescription>
          Abre esta pantalla en un monitor o tablet frente al cliente: ve su
          pedido en vivo, elige propina y confirma. Sin pedido muestra tus
          menús como banners.
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
            Nueva pantalla
          </Button>
        ) : null}
      </CardHeader>

      <CardContent className="gap-3">
        {displays.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            Todavía no hay pantallas. Crea una y abre su enlace en el monitor
            del cliente.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {displays.map((display) => (
              <li
                key={display.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
              >
                <div className="flex min-w-0 items-start gap-2">
                  <MonitorPlayIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium">
                      {display.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {display.branch?.name ?? "Todas las sucursales"}
                      {display.lastSeenAt
                        ? ` · última conexión ${new Date(
                            display.lastSeenAt
                          ).toLocaleString("es-MX", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}`
                        : " · sin uso todavía"}
                    </span>
                  </div>
                </div>

                {canManage ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Revocar ${display.name}`}
                    onClick={() => setRevoking(display)}
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
            <DialogTitle>Nueva pantalla de cliente</DialogTitle>
            <DialogDescription>
              Genera el enlace y ábrelo en el monitor. La pantalla se actualiza
              sola con el pedido del POS.
            </DialogDescription>
          </DialogHeader>

          {created ? (
            <div className="flex flex-col items-center gap-3">
              <div className="rounded-xl border bg-white p-3">
                <QRCode value={created.url} size={180} />
              </div>
              <p className="text-center text-sm text-muted-foreground">
                Abre este enlace en la pantalla del cliente:
              </p>
              <code className="w-full break-all rounded-md bg-muted px-2 py-1 text-center text-xs">
                {created.url}
              </code>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <Field>
                <FieldLabel htmlFor="display-name">Nombre</FieldLabel>
                <Input
                  id="display-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={40}
                  placeholder="Ej. Pantalla mostrador"
                />
              </Field>

              <div className="flex flex-col gap-2">
                <Label htmlFor="display-branch">Sucursal</Label>
                <Select
                  value={branchId}
                  onValueChange={(value) => setBranchId(value ?? "none")}
                  items={[
                    { value: "none", label: "Todas las sucursales" },
                    ...branches
                      .filter((branch) => branch.isActive)
                      .map((branch) => ({
                        value: branch.id,
                        label: branch.name,
                      })),
                  ]}
                >
                  <SelectTrigger id="display-branch" className="w-full">
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
            </div>
          )}

          <DialogFooter>
            {created ? (
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
                <Button type="button" onClick={create} disabled={pending}>
                  {pending ? (
                    <Loader2Icon className="animate-spin" />
                  ) : (
                    <QrCodeIcon />
                  )}
                  Generar enlace
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
              La pantalla dejará de actualizarse. Puedes crear una nueva cuando
              la necesites.
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
