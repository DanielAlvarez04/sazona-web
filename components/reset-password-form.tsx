"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { API_BASE_URL } from "@/lib/api-base"
import { apiErrorMessage } from "@/lib/http-error"

const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).+$/

export function ResetPasswordForm({ token }: { token?: string }) {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [confirmation, setConfirmation] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!token) {
    return (
      <div className="flex flex-col gap-6 text-center">
        <h1 className="text-2xl font-bold">Enlace no válido</h1>
        <p className="text-sm text-muted-foreground">
          Este enlace no incluye un código de recuperación. Solicita uno nuevo
          para continuar.
        </p>
        <Button render={<Link href="/forgot-password" />}>
          Solicitar un enlace nuevo
        </Button>
        <FieldDescription>
          <Link href="/login" className="underline underline-offset-4">
            Volver al inicio de sesión
          </Link>
        </FieldDescription>
      </div>
    )
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.")
      return
    }

    if (!PASSWORD_RULE.test(password)) {
      setError("La contraseña debe incluir letras y números.")
      return
    }

    if (password !== confirmation) {
      setError("Las contraseñas no coinciden.")
      return
    }

    setLoading(true)

    try {
      const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(
          apiErrorMessage(
            data,
            "El enlace caducó o ya se usó. Solicita uno nuevo."
          )
        )
      }

      router.push("/login?reset=1")
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No pudimos cambiar la contraseña. Intenta de nuevo."
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">Elige una nueva contraseña</h1>
          <p className="text-sm text-balance text-muted-foreground">
            Al guardarla se cerrarán todas las sesiones abiertas de tu cuenta.
          </p>
        </div>
        <Field>
          <FieldLabel htmlFor="password">Nueva contraseña</FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <FieldDescription>
            Mínimo 8 caracteres, con letras y números.
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="confirmation">Repite la contraseña</FieldLabel>
          <Input
            id="confirmation"
            name="confirmation"
            type="password"
            autoComplete="new-password"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            required
          />
        </Field>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <Field>
          <Button type="submit" disabled={loading}>
            {loading ? "Guardando..." : "Cambiar contraseña"}
          </Button>
        </Field>
        <FieldDescription className="text-center">
          <Link href="/login" className="underline underline-offset-4">
            Volver al inicio de sesión
          </Link>
        </FieldDescription>
      </FieldGroup>
    </form>
  )
}
