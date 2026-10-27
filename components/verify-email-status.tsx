"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { CircleCheckIcon, CircleXIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { FieldDescription } from "@/components/ui/field"
import { API_BASE_URL } from "@/lib/api-base"
import { apiErrorMessage } from "@/lib/http-error"

type State =
  | { status: "verifying" }
  | { status: "ok" }
  | { status: "error"; message: string }

export function VerifyEmailStatus({ token }: { token?: string }) {
  const started = useRef(false)
  const [state, setState] = useState<State>(
    token
      ? { status: "verifying" }
      : {
          status: "error",
          message: "El enlace no incluye un código de verificación.",
        }
  )

  useEffect(() => {
    if (!token || started.current) return
    started.current = true

    let cancelled = false

    async function verify() {
      try {
        const response = await fetch(`${API_BASE_URL}/auth/verify-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        })

        if (cancelled) return

        if (!response.ok) {
          const data = await response.json().catch(() => null)
          setState({
            status: "error",
            message: apiErrorMessage(
              data,
              "El enlace caducó o ya se usó. Pide uno nuevo desde tu cuenta."
            ),
          })
          return
        }

        setState({ status: "ok" })
      } catch {
        if (!cancelled) {
          setState({
            status: "error",
            message: "No pudimos verificar el correo. Revisa tu conexión.",
          })
        }
      }
    }

    void verify()

    return () => {
      cancelled = true
    }
  }, [token])

  if (state.status === "verifying") {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <h1 className="text-2xl font-bold">Verificando tu correo…</h1>
        <p className="text-sm text-muted-foreground">
          Estamos confirmando el enlace. Tarda sólo un momento.
        </p>
      </div>
    )
  }

  if (state.status === "ok") {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <CircleCheckIcon className="size-6" />
        </div>
        <h1 className="text-2xl font-bold">Correo verificado</h1>
        <p className="text-sm text-muted-foreground">
          Tu cuenta quedó confirmada. Ya puedes iniciar sesión.
        </p>
        <Button render={<Link href="/login?verified=1" />} className="w-full">
          Iniciar sesión
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <CircleXIcon className="size-6" />
      </div>
      <h1 className="text-2xl font-bold">No pudimos verificar el correo</h1>
      <p className="text-sm text-muted-foreground">{state.message}</p>
      <Button render={<Link href="/login" />} className="w-full">
        Volver al inicio de sesión
      </Button>
      <FieldDescription>
        Con la sesión iniciada puedes pedir un enlace nuevo desde
        Configuración.
      </FieldDescription>
    </div>
  )
}
