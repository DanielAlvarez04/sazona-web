"use client"

import Link from "next/link"
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

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(
          apiErrorMessage(data, "No pudimos enviar el correo. Intenta de nuevo.")
        )
      }

      setSent(true)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No pudimos enviar el correo. Intenta de nuevo."
      )
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">Revisa tu correo</h1>
          <p className="text-sm text-balance text-muted-foreground">
            Si existe una cuenta con <span className="font-medium">{email}</span>
            , enviamos un enlace para restablecer la contraseña. Caduca en 1
            hora.
          </p>
        </div>
        <Button render={<Link href="/login" />}>Volver al inicio de sesión</Button>
        <button
          type="button"
          className="text-sm underline underline-offset-4"
          onClick={() => {
            setSent(false)
            setEmail("")
          }}
        >
          Usar otro correo
        </button>
      </div>
    )
  }

  return (
    <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">Recupera tu contraseña</h1>
          <p className="text-sm text-balance text-muted-foreground">
            Escribe tu correo y te enviaremos un enlace para elegir una nueva
            contraseña.
          </p>
        </div>
        <Field>
          <FieldLabel htmlFor="email">Correo</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="tu@naranjapimienta.com"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
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
            {loading ? "Enviando..." : "Enviar enlace"}
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
