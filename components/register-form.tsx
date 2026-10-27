"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { cn } from "cn"

import { Button, buttonVariants } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { API_BASE_URL } from "@/lib/api-base"
import { apiErrorMessage } from "@/lib/http-error"

const GOOGLE_PATH = `${API_BASE_URL}/auth/google`

export function RegisterForm({ className, ...props }: React.ComponentProps<"form">) {
  const router = useRouter()
  const [businessName, setBusinessName] = useState("")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const googleHref = businessName.trim()
    ? `${GOOGLE_PATH}?business=${encodeURIComponent(businessName.trim())}`
    : GOOGLE_PATH

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationName: businessName.trim(),
          name: name.trim() || undefined,
          email: email.trim(),
          password,
        }),
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(
          apiErrorMessage(data, "No pudimos crear tu cuenta")
        )
      }

      router.push("/onboarding")
      router.refresh()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No pudimos crear tu cuenta"
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <form
      className={cn("flex flex-col gap-6", className)}
      onSubmit={handleSubmit}
      {...props}
    >
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">Crea tu negocio</h1>
          <p className="text-sm text-balance text-muted-foreground">
            Tu cuenta será la administradora del negocio y podrás añadir a tu
            equipo con usuarios internos.
          </p>
        </div>
        <Field>
          <FieldLabel htmlFor="businessName">Nombre del negocio</FieldLabel>
          <Input
            id="businessName"
            name="businessName"
            type="text"
            placeholder="Café Central"
            autoComplete="organization"
            maxLength={80}
            value={businessName}
            onChange={(event) => setBusinessName(event.target.value)}
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="name">Tu nombre (opcional)</FieldLabel>
          <Input
            id="name"
            name="name"
            type="text"
            placeholder="Ana Pérez"
            autoComplete="name"
            maxLength={80}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="email">Correo</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="tu@cafeteria.com"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="password">Contraseña</FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <FieldDescription>
            Al menos 8 caracteres. La usará el administrador para entrar.
          </FieldDescription>
        </Field>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <Field>
          <Button type="submit" disabled={loading}>
            {loading ? "Creando cuenta..." : "Crear cuenta y negocio"}
          </Button>
        </Field>
        <FieldSeparator>O continúa con</FieldSeparator>
        <Field>
          {/* Navegación con semántica de enlace; el nombre del negocio viaja en
              la URL para que Google cree la organización con ese nombre. */}
          <a
            href={googleHref}
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.57c2.08-1.92 3.27-4.74 3.27-8.09Z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.76c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0 0 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"
                fill="#EA4335"
              />
            </svg>
            Continuar con Google
          </a>
          <FieldDescription className="text-center">
            ¿Ya tienes cuenta?{" "}
            <Link
              href="/login"
              className="underline underline-offset-4 hover:text-foreground"
            >
              Inicia sesión
            </Link>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  )
}
