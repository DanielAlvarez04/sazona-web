"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Loader2Icon,
  LockKeyholeIcon,
  MonitorSmartphoneIcon,
  ShieldAlertIcon,
  UserRoundIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { API_BASE_URL } from "@/lib/api-base"
import { apiErrorMessage } from "@/lib/http-error"
import type { PosDeviceSession } from "@/lib/pos-device"
import { cn } from "@/lib/utils"

/** Pantalla pública de desbloqueo con PIN en una caja vinculada. */
export function UnlockForm() {
  const router = useRouter()
  const [session, setSession] = React.useState<PosDeviceSession | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [selected, setSelected] = React.useState<string | null>(null)
  const [pin, setPin] = React.useState("")
  const [pending, setPending] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false

    fetch(`${API_BASE_URL}/pos/device`, {
      credentials: "include",
      cache: "no-store",
    })
      .then(async (response) => {
        const data = await response.json().catch(() => null)
        if (cancelled) return

        if (!response.ok) {
          setError(
            apiErrorMessage(data, "Esta caja no está vinculada.")
          )
          return
        }

        setSession(data as PosDeviceSession)
      })
      .catch(() => {
        if (!cancelled) setError("No se pudo contactar con el servidor.")
      })

    return () => {
      cancelled = true
    }
  }, [])

  const submit = async () => {
    if (!selected) {
      toast.error("Elige tu nombre")
      return
    }

    if (!/^\d{4,8}$/.test(pin)) {
      toast.error("Escribe tu PIN de 4 a 8 dígitos")
      return
    }

    setPending(true)

    try {
      const response = await fetch(`${API_BASE_URL}/pos/device/pin`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selected, pin }),
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        toast.error(apiErrorMessage(data, "No se pudo entrar a la caja"))
        setPin("")
        return
      }

      router.push("/pos")
      router.refresh()
    } catch {
      toast.error("No se pudo contactar con el servidor")
    } finally {
      setPending(false)
    }
  }

  const members = session?.members ?? []
  const member = members.find((entry) => entry.id === selected) ?? null

  return (
    <main className="flex h-dvh items-center justify-center overflow-y-auto bg-muted/30 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <MonitorSmartphoneIcon className="size-6 text-muted-foreground" />
          <CardTitle>Entrar a la caja</CardTitle>
          <CardDescription>
            {session
              ? `${session.organizationName}${
                  session.branchName ? ` · ${session.branchName}` : ""
                } · ${session.deviceName}`
              : "Comprobando la caja vinculada…"}
          </CardDescription>
        </CardHeader>

        <CardContent className="gap-4">
          {error ? (
            <div className="flex flex-col gap-3">
              <p className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                <ShieldAlertIcon className="mt-0.5 size-4 shrink-0" />
                {error}
              </p>
              <p className="text-xs text-muted-foreground">
                Pide a un administrador que genere el QR en Configuración →
                Negocio → Cajas vinculadas.
              </p>
              <Link
                href="/login"
                className={cn(buttonVariants({ variant: "outline" }), "w-fit")}
              >
                Entrar con contraseña
              </Link>
            </div>
          ) : !session ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2Icon className="size-4 animate-spin" />
              Verificando…
            </p>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium">¿Quién eres?</span>
                <div className="grid gap-2 sm:grid-cols-2">
                  {members.map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => {
                        setSelected(entry.id)
                        setPin("")
                      }}
                      disabled={!entry.hasPin}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border p-2 text-left text-sm transition-colors",
                        selected === entry.id
                          ? "border-primary bg-primary/5"
                          : "hover:bg-muted/60",
                        !entry.hasPin && "cursor-not-allowed opacity-50"
                      )}
                    >
                      <UserRoundIcon className="size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate">
                        {entry.name ?? entry.username ?? "Sin nombre"}
                      </span>
                      {entry.hasPin ? null : (
                        <Badge variant="outline">Sin PIN</Badge>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {member ? (
                <div className="flex flex-col gap-2">
                  <Field>
                    <FieldLabel htmlFor="unlock-pin">PIN de {member.name}</FieldLabel>
                    <Input
                      id="unlock-pin"
                      type="password"
                      inputMode="numeric"
                      autoComplete="off"
                      maxLength={8}
                      value={pin}
                      onChange={(event) =>
                        setPin(event.target.value.replace(/\D/g, "").slice(0, 8))
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault()
                          void submit()
                        }
                      }}
                      autoFocus
                    />
                  </Field>
                  <Button type="button" onClick={submit} disabled={pending}>
                    {pending ? (
                      <Loader2Icon className="animate-spin" />
                    ) : (
                      <LockKeyholeIcon />
                    )}
                    Entrar
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Elige tu nombre para escribir tu PIN.
                </p>
              )}

              <Link
                href="/login"
                className="text-xs text-muted-foreground underline-offset-4 hover:underline"
              >
                Entrar con contraseña
              </Link>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
