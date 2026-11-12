"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Loader2Icon, MonitorSmartphoneIcon, ShieldAlertIcon } from "lucide-react"
import { toast } from "sonner"

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
import { cn } from "@/lib/utils"

interface PairingInfo {
  organizationName: string
  branchName: string | null
}

/** Pantalla pública que abre el QR para vincular la caja. */
export function PairDeviceForm({ code }: { code: string }) {
  const router = useRouter()
  const [info, setInfo] = React.useState<PairingInfo | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [name, setName] = React.useState("")
  const [pending, setPending] = React.useState(false)

  React.useEffect(() => {
    if (!code) return

    let cancelled = false

    fetch(`${API_BASE_URL}/pos/pairing/${encodeURIComponent(code)}`, {
      credentials: "include",
      cache: "no-store",
    })
      .then(async (response) => {
        const data = await response.json().catch(() => null)
        if (cancelled) return

        if (!response.ok) {
          setError(
            apiErrorMessage(data, "El código no es válido o ya expiró.")
          )
          return
        }

        setInfo(data as PairingInfo)
      })
      .catch(() => {
        if (!cancelled) {
          setError("No se pudo contactar con el servidor.")
        }
      })

    return () => {
      cancelled = true
    }
  }, [code])

  const claim = async () => {
    setPending(true)

    try {
      const response = await fetch(
        `${API_BASE_URL}/pos/pairing/${encodeURIComponent(code)}/claim`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim() || undefined }),
        }
      )

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        toast.error(apiErrorMessage(data, "No se pudo vincular la caja"))
        return
      }

      toast.success("Caja vinculada")
      router.push("/pos/unlock")
      router.refresh()
    } catch {
      toast.error("No se pudo contactar con el servidor")
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <MonitorSmartphoneIcon className="size-6 text-muted-foreground" />
          <CardTitle>Vincular esta caja</CardTitle>
          <CardDescription>
            {!code
              ? "Abre el enlace del QR generado en Configuración."
              : info
                ? `${info.organizationName}${
                    info.branchName ? ` · ${info.branchName}` : ""
                  }`
                : "Comprobando el código de vinculación…"}
          </CardDescription>
        </CardHeader>

        <CardContent className="gap-4">
          {!code ? (
            <div className="flex flex-col gap-3">
              <p className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                <ShieldAlertIcon className="mt-0.5 size-4 shrink-0" />
                Falta el código de vinculación.
              </p>
              <Link
                href="/login"
                className={cn(buttonVariants({ variant: "outline" }), "w-fit")}
              >
                Ir al inicio de sesión
              </Link>
            </div>
          ) : error ? (
            <div className="flex flex-col gap-3">
              <p className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                <ShieldAlertIcon className="mt-0.5 size-4 shrink-0" />
                {error}
              </p>
              <Link
                href="/login"
                className={cn(buttonVariants({ variant: "outline" }), "w-fit")}
              >
                Ir al inicio de sesión
              </Link>
            </div>
          ) : info ? (
            <>
              <Field>
                <FieldLabel htmlFor="pairing-name">
                  Nombre de la caja (opcional)
                </FieldLabel>
                <Input
                  id="pairing-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={40}
                  placeholder="Ej. Caja mostrador"
                />
              </Field>

              <Button type="button" onClick={claim} disabled={pending}>
                {pending ? <Loader2Icon className="animate-spin" /> : null}
                Vincular esta caja
              </Button>

              <p className="text-xs text-muted-foreground">
                Después podrás entrar con el PIN de cada persona del equipo.
              </p>
            </>
          ) : (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2Icon className="size-4 animate-spin" />
              Verificando…
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
