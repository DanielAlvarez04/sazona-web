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

interface LoginFormProps extends React.ComponentProps<"form"> {
  initialIdentifier?: string
  initialChallenge?: { challengeId: string; email: string }
  initialError?: string | null
  notice?: string | null
}

export function LoginForm({
  className,
  initialIdentifier,
  initialChallenge,
  initialError,
  notice,
  ...props
}: LoginFormProps) {
  const router = useRouter()
  const [identifier, setIdentifier] = useState(initialIdentifier ?? "")
  const [password, setPassword] = useState("")
  const [challengeId, setChallengeId] = useState<string | null>(
    initialChallenge?.challengeId ?? null
  )
  const [challengeEmail, setChallengeEmail] = useState(
    initialChallenge?.email ?? ""
  )
  const [code, setCode] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(initialError ?? null)

  function finishLogin() {
    router.push("/dashboard")
    router.refresh()
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(apiErrorMessage(data, "No pudimos iniciar sesión"))
      }

      // La cuenta tiene verificación en dos pasos: aún no hay sesión.
      if (data?.twoFactorRequired) {
        setChallengeId(String(data.challengeId))
        setChallengeEmail(String(data.email ?? identifier))
        setCode("")
        return
      }

      finishLogin()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No pudimos iniciar sesión"
      )
    } finally {
      setLoading(false)
    }
  }

  async function handleVerify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${API_BASE_URL}/auth/2fa/verify`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId, code }),
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(
          apiErrorMessage(data, "El código no es válido o ya caducó")
        )
      }

      finishLogin()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "El código no es válido"
      )
    } finally {
      setLoading(false)
    }
  }

  if (challengeId) {
    return (
      <form
        className={cn("flex flex-col gap-6", className)}
        onSubmit={handleVerify}
        {...props}
      >
        <FieldGroup>
          <div className="flex flex-col items-center gap-1 text-center">
            <h1 className="text-2xl font-bold">Revisa tu correo</h1>
            <p className="text-sm text-balance text-muted-foreground">
              Enviamos un código de 6 dígitos a {challengeEmail || "tu correo"}. Caduca
              en 10 minutos.
            </p>
          </div>
          <Field>
            <FieldLabel htmlFor="code">Código de verificación</FieldLabel>
            <Input
              id="code"
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              placeholder="123456"
              className="text-center text-lg tracking-[0.4em]"
              value={code}
              onChange={(event) =>
                setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
              }
              autoFocus
              required
            />
          </Field>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <Field>
            <Button type="submit" disabled={loading || code.length !== 6}>
              {loading ? "Verificando..." : "Verificar código"}
            </Button>
          </Field>
          <FieldDescription className="text-center">
            <button
              type="button"
              className="underline underline-offset-4"
              onClick={() => {
                setChallengeId(null)
                setCode("")
                setError(null)
              }}
            >
              Volver a iniciar sesión
            </button>
          </FieldDescription>
        </FieldGroup>
      </form>
    )
  }

  return (
    <form
      className={cn("flex flex-col gap-6", className)}
      onSubmit={handleSubmit}
      {...props}
    >
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">Inicia sesión</h1>
          <p className="text-sm text-balance text-muted-foreground">
            Entra con tu correo o el usuario que te asignó tu administrador
          </p>
        </div>
        {notice ? (
          <p
            role="status"
            className="rounded-md bg-muted px-3 py-2 text-sm text-foreground"
          >
            {notice}
          </p>
        ) : null}
        <Field>
          <FieldLabel htmlFor="identifier">Correo o usuario</FieldLabel>
          <Input
            id="identifier"
            name="identifier"
            type="text"
            placeholder="tu@cafeteria.com o mesero"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            required
          />
        </Field>
        <Field>
          <div className="flex items-center">
            <FieldLabel htmlFor="password">Contraseña</FieldLabel>
            <Link
              href="/forgot-password"
              className="ml-auto text-sm underline-offset-4 hover:underline"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
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
            {loading ? "Entrando..." : "Entrar"}
          </Button>
        </Field>
        <FieldSeparator>O continúa con</FieldSeparator>
        <Field>
          {/* Es navegación, no un botón: un <a> conserva la semántica de enlace
              y evita que Base UI le añada role="button". */}
          <a
            href={`${API_BASE_URL}/auth/google`}
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
            ¿No tienes cuenta?{" "}
            <Link
              href="/register"
              className="underline underline-offset-4 hover:text-foreground"
            >
              Crea tu negocio
            </Link>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  )
}
