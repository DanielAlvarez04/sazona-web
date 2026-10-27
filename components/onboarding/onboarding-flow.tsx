"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  GalleryVerticalEndIcon,
  Loader2Icon,
  SparklesIcon,
} from "lucide-react"

import {
  finishOnboarding,
  updateOnboardingBusiness,
  updateOnboardingProfile,
} from "@/app/onboarding/actions"
import { AvailabilityLabel } from "@/components/availability-field"
import { useDomainStatus } from "@/components/onboarding/domain-field"
import {
  useSuggestedUsername,
  useUsernameStatus,
} from "@/components/users/username-field"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useActionForm } from "@/hooks/use-action-form"
import { domainFromName } from "@/lib/domain"

const STEPS = ["Negocio", "Tu cuenta", "Bienvenida"] as const

const TITLES = [
  "¿Cómo se llama tu negocio?",
  "Cuéntanos de ti",
] as const

const DESCRIPTIONS = [
  "Es el nombre que verá tu equipo en el panel.",
  "Así te identificas dentro del negocio y al iniciar sesión.",
] as const

export function OnboardingFlow({
  initialBusinessName,
  initialDomain,
  initialName,
  initialUsername,
  currentUsername,
}: {
  initialBusinessName: string
  initialDomain: string
  initialName: string
  initialUsername: string
  currentUsername: string | null
}) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [businessName, setBusinessName] = useState(initialBusinessName)
  // El dominio sigue al nombre hasta que se edita a mano.
  const [manualDomain, setManualDomain] = useState<string | null>(
    initialDomain || null
  )
  const domain = manualDomain ?? domainFromName(businessName)
  const domainStatus = useDomainStatus(domain, {
    currentDomain: initialDomain || null,
  })

  const [name, setName] = useState(initialName)
  const [manualUsername, setManualUsername] = useState<string | null>(
    initialUsername || null
  )
  const suggestion = useSuggestedUsername(name, {
    enabled: manualUsername === null,
    resetKey: domain,
  })
  const username = manualUsername ?? suggestion ?? ""
  const usernameStatus = useUsernameStatus(username, { currentUsername })

  const business = useActionForm(() => setStep(1))
  const profile = useActionForm(() => setStep(2))
  const finish = useActionForm(() => {
    router.push("/dashboard")
    router.refresh()
  })

  const welcome = step === 2

  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center gap-6 bg-gradient-to-br from-primary/10 via-background to-secondary/25 p-6">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_0%,var(--primary),transparent_45%)] opacity-10" />

      <Link
        href="/"
        className="flex items-center gap-2 text-sm font-medium"
        aria-label="Naranja Pimienta"
      >
        <span className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <GalleryVerticalEndIcon className="size-4" />
        </span>
        Naranja Pimienta
      </Link>

      <Card className="w-full max-w-md shadow-lg shadow-primary/5">
        <CardHeader className="gap-3">
          <ol className="flex gap-2" aria-label="Progreso del onboarding">
            {STEPS.map((label, index) => {
              const done = index < step
              const active = index === step

              return (
                <li key={label} className="flex flex-1 flex-col gap-1.5">
                  <span
                    className={`h-1 rounded-full transition-colors ${
                      done || active ? "bg-primary" : "bg-muted"
                    }`}
                  />
                  <span
                    className={`text-xs ${
                      active
                        ? "font-medium text-foreground"
                        : "text-muted-foreground"
                    }`}
                    aria-current={active ? "step" : undefined}
                  >
                    {label}
                  </span>
                </li>
              )
            })}
          </ol>

          <div className="flex flex-col gap-1">
            <CardTitle className="font-heading text-xl">
              {welcome
                ? `¡Todo listo${name.trim() ? `, ${name.trim()}` : ""}!`
                : TITLES[step]}
            </CardTitle>
            <CardDescription>
              {welcome
                ? "Tu negocio quedó configurado. Ya puedes empezar a operar."
                : DESCRIPTIONS[step]}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          {step === 0 ? (
            <form
              className="flex flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault()
                const formData = new FormData(event.currentTarget)
                business.run(() => updateOnboardingBusiness(formData))
              }}
            >
              <Field>
                <FieldLabel htmlFor="business-name">Nombre del negocio</FieldLabel>
                <Input
                  id="business-name"
                  name="name"
                  autoComplete="organization"
                  maxLength={80}
                  placeholder="Café Central"
                  value={businessName}
                  onChange={(event) => setBusinessName(event.target.value)}
                  autoFocus
                  required
                />
                <FieldDescription>
                  Puedes cambiarlo luego desde Configuración.
                </FieldDescription>
              </Field>

              <Field>
                <AvailabilityLabel
                  htmlFor="business-domain"
                  label="Dominio"
                  status={domainStatus}
                />
                <Input
                  id="business-domain"
                  name="domain"
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  maxLength={80}
                  placeholder="naranjapimienta.cafe"
                  value={domain}
                  onChange={(event) =>
                    setManualDomain(
                      event.target.value === "" ? null : event.target.value
                    )
                  }
                  required
                />
                <FieldDescription>
                  Con este dominio se crean los usuarios del equipo:
                  nombre@dominio.
                </FieldDescription>
              </Field>

              {business.error ? (
                <FieldError>{business.error}</FieldError>
              ) : null}

              <Button
                type="submit"
                disabled={business.pending || domainStatus.state !== "ok"}
              >
                {business.pending ? (
                  <Loader2Icon className="animate-spin" />
                ) : (
                  <ArrowRightIcon />
                )}
                Continuar
              </Button>
            </form>
          ) : null}

          {step === 1 ? (
            <form
              className="flex flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault()
                const formData = new FormData(event.currentTarget)
                profile.run(() => updateOnboardingProfile(formData))
              }}
            >
              <Field>
                <FieldLabel htmlFor="owner-name">Nombre</FieldLabel>
                <Input
                  id="owner-name"
                  name="name"
                  autoComplete="name"
                  maxLength={80}
                  placeholder="Ana Pérez"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoFocus
                  required
                />
              </Field>

              <Field>
                <AvailabilityLabel
                  htmlFor="owner-username"
                  label="Usuario"
                  status={usernameStatus}
                />
                <Input
                  id="owner-username"
                  name="username"
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  maxLength={120}
                  placeholder="ana@tunegocio.cafe"
                  value={username}
                  onChange={(event) =>
                    setManualUsername(
                      event.target.value === "" ? null : event.target.value
                    )
                  }
                  required
                />
                <FieldDescription>
                  {domain
                    ? `Se crea con el dominio ${domain}; puedes ajustarlo.`
                    : "Se genera desde tu nombre; puedes ajustarlo."}
                </FieldDescription>
              </Field>

              {profile.error ? (
                <FieldError>{profile.error}</FieldError>
              ) : null}

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setStep(0)}
                  disabled={profile.pending}
                >
                  <ArrowLeftIcon />
                  Atrás
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={profile.pending || usernameStatus.state !== "ok"}
                >
                  {profile.pending ? (
                    <Loader2Icon className="animate-spin" />
                  ) : (
                    <ArrowRightIcon />
                  )}
                  Continuar
                </Button>
              </div>
            </form>
          ) : null}

          {welcome ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-start gap-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-300">
                <SparklesIcon className="mt-0.5 size-4 shrink-0" />
                <p>
                  Te damos la bienvenida a{" "}
                  <span className="font-medium">
                    {businessName.trim() || "tu negocio"}
                  </span>
                  .
                </p>
              </div>

              <dl className="flex flex-col gap-2 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-muted-foreground">Negocio</dt>
                  <dd className="font-medium">{businessName.trim()}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-muted-foreground">Dominio</dt>
                  <dd className="font-medium">{domain.trim().toLowerCase()}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-muted-foreground">Usuario</dt>
                  <dd className="font-medium">{username.trim().toLowerCase()}</dd>
                </div>
              </dl>

              {finish.error ? <FieldError>{finish.error}</FieldError> : null}

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setStep(1)}
                  disabled={finish.pending}
                >
                  <ArrowLeftIcon />
                  Atrás
                </Button>
                <Button
                  type="button"
                  className="flex-1"
                  onClick={() => finish.run(finishOnboarding)}
                  disabled={finish.pending}
                >
                  {finish.pending ? (
                    <Loader2Icon className="animate-spin" />
                  ) : (
                    <SparklesIcon />
                  )}
                  Ir al panel
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
