"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { GalleryVerticalEndIcon, SparklesIcon } from "lucide-react"

import {
  finishOnboarding,
  updateOnboardingBusiness,
  updateOnboardingBusinessType,
  updateOnboardingGoals,
  updateOnboardingProfile,
  updateOnboardingServiceTypes,
} from "@/app/onboarding/actions"
import { AvailabilityLabel } from "@/components/availability-field"
import { useDomainStatus } from "@/components/onboarding/domain-field"
import {
  useSuggestedUsername,
  useUsernameStatus,
} from "@/components/users/username-field"
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useActionForm } from "@/hooks/use-action-form"
import { domainFromName, normalizeDomain } from "@/lib/domain"
import { normalizeUsername } from "@/lib/username"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Questionnaire,
  QuestionnaireItem,
  QuestionnaireTitle,
  QuestionnaireChoices,
  QuestionnaireChoice,
  QuestionnaireProgress,
  QuestionnaireActions,
  QuestionnairePrevious,
  QuestionnaireNext,
  QuestionnaireSubmit,
  QuestionnaireError,
} from "@/components/ui/questionnaire"

const BUSINESS_TYPES = [
  "restaurante",
  "cafetería",
  "chocolatería",
  "panadería",
  "repostería",
  "pastelería",
  "heladería",
  "bar",
  "comida rápida",
  "taquería",
  "pizzería",
  "cocina económica",
  "negocio de catering",
  "negocio de alimentos por encargo",
  "tienda de alimentos y bebidas",
  "otro",
] as const

const SERVICE_TYPES = [
  "servicio en mesa",
  "mostrador",
  "para llevar",
  "entrega a domicilio propia",
  "entrega mediante plataformas",
  "catering o eventos",
  "venta en línea",
] as const

const GOALS = [
  "control de inventario",
  "cálculo de costos y rentabilidad",
  "compras y proveedores",
  "control de ventas y caja",
  "control de gastos",
  "administración de recetas y producción",
  "reducción de mermas y desperdicios",
  "administración de sucursales",
  "organización del personal",
  "reportes y análisis del negocio",
  "otro",
] as const

const ONBOARDING_ITEMS = [
  { name: "businessType", required: true },
  { name: "business", required: true },
  { name: "profile", required: true },
  { name: "serviceTypes", required: false },
  { name: "goals", required: false },
  { name: "welcome", required: false },
] as const

/** `daniel@pimientanaranja.com` → `daniel`. */
function localPart(value: string): string {
  return value.split("@")[0]?.trim() ?? ""
}

/**
 * Separa el nombre de la cuenta en nombre de pila y apellidos.
 *
 * Conserva mayúsculas y acentos porque se muestra en los campos editables.
 */
function splitDisplayName(name: string): { first: string; surname: string } {
  const words = name.trim().split(/\s+/).filter(Boolean)

  return { first: words[0] ?? "", surname: words.slice(1).join(" ") }
}

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
  const questionnaireRef = React.useRef<HTMLFormElement>(null)

  // State
  const [businessType, setBusinessType] = useState("")
  const [businessName, setBusinessName] = useState(initialBusinessName)
  // Dominio completo (con TLD) editable. `null` = sigue al nombre del negocio.
  const [manualDomain, setManualDomain] = useState<string | null>(null)
  const domain = manualDomain ?? (domainFromName(businessName) || initialDomain)
  const domainStatus = useDomainStatus(domain, {
    currentDomain: initialDomain || null,
  })
  const [hasBranches, setHasBranches] = useState(false)

  const accountName = splitDisplayName(initialName)
  const [firstName, setFirstName] = useState(accountName.first)
  const [lastName, setLastName] = useState(accountName.surname)
  // El dominio ya se configuró en el paso anterior: aquí solo se edita la
  // parte local (`daniel`), que se combina con el dominio del negocio.
  // Mientras no se edite a mano, el ID se recalcula con el nombre y apellido,
  // igual que en /users.
  const [manualLocal, setManualLocal] = useState<string | null>(null)
  const initialLocal = localPart(initialUsername)
  const suggestion = useSuggestedUsername(`${firstName} ${lastName}`, {
    enabled: manualLocal === null,
    resetKey: domain,
  })
  const suggestedLocal = suggestion ? localPart(suggestion) : ""
  const local = manualLocal ?? (suggestedLocal || initialLocal)
  const username = local && domain ? `${local}@${domain}` : ""
  const usernameStatus = useUsernameStatus(username, { currentUsername })

  const [serviceTypes, setServiceTypes] = useState<string[]>([])
  const [goals, setGoals] = useState<string[]>([])

  // Forms
  const businessTypeForm = useActionForm(() => {})
  const businessForm = useActionForm(() => {})
  const profileForm = useActionForm(() => {})
  const serviceTypesForm = useActionForm(() => {})
  const goalsForm = useActionForm(() => {})
  const finishForm = useActionForm(() => {
    router.push("/dashboard")
    router.refresh()
  })

  const handleBusinessTypeSubmit = () => {
    const fd = new FormData()
    fd.append("businessType", businessType)
    return businessTypeForm.run(() => updateOnboardingBusinessType(fd))
  }

  const handleBusinessSubmit = () => {
    const fd = new FormData()
    fd.append("name", businessName)
    fd.append("domain", domain)
    fd.append("hasBranches", hasBranches.toString())
    return businessForm.run(() => updateOnboardingBusiness(fd))
  }

  const handleProfileSubmit = () => {
    const fd = new FormData()
    fd.append("firstName", firstName)
    fd.append("lastName", lastName)
    fd.append("username", username)
    return profileForm.run(() => updateOnboardingProfile(fd))
  }

  const handleServiceTypesSubmit = () => {
    const fd = new FormData()
    fd.append("serviceTypes", serviceTypes.join(","))
    return serviceTypesForm.run(() => updateOnboardingServiceTypes(fd))
  }

  const handleGoalsSubmit = () => {
    const fd = new FormData()
    fd.append("goals", goals.join(","))
    return goalsForm.run(() => updateOnboardingGoals(fd))
  }

  const handleFinishSubmit = () => {
    return finishForm.run(finishOnboarding)
  }

  const toggleServiceType = (value: string) => {
    setServiceTypes((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
    )
  }

  const toggleGoal = (value: string) => {
    setGoals((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
    )
  }

  return (
    <Questionnaire
      ref={questionnaireRef}
      defaultItem="businessType"
      items={ONBOARDING_ITEMS}
      className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/25 p-4 md:p-8"
    >
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_0%,var(--primary),transparent_45%)] opacity-10" />

      <Link
        href="/"
        className="absolute top-6 left-6 flex items-center gap-2 text-sm font-medium"
        aria-label="Naranja Pimienta"
      >
        <span className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <GalleryVerticalEndIcon className="size-4" />
        </span>
        Naranja Pimienta
      </Link>

      <div className="w-full max-w-3xl">
        <QuestionnaireProgress
          render={(props, state) => (
            <div {...props} className="w-full">
              <div className="mb-2 flex gap-1.5" aria-hidden="true">
                {Array.from({ length: state.total }, (_, index) => (
                  <span
                    key={index}
                    className={index < state.current - 1
                      ? "h-1.5 flex-1 rounded-full bg-primary"
                      : "h-1.5 flex-1 rounded-full bg-muted"}
                  />
                ))}
              </div>
              <span>Paso {state.current} de {state.total}</span>
            </div>
          )}
        />

        {/* Paso 1: Giro principal */}
        <QuestionnaireItem name="businessType" required>
          <div className="flex flex-col gap-6">
            <QuestionnaireTitle>¿Cuál es el giro principal de tu negocio?</QuestionnaireTitle>
            <QuestionnaireChoices>
              {BUSINESS_TYPES.map((type) => (
                <QuestionnaireChoice
                  key={type}
                  value={type}
                  name="businessType"
                  checked={businessType === type}
                  onChange={setBusinessType}
                >
                  {type}
                </QuestionnaireChoice>
              ))}
            </QuestionnaireChoices>
            <QuestionnaireError>{businessTypeForm.error}</QuestionnaireError>
            <QuestionnaireActions>
              <QuestionnaireNext onClick={handleBusinessTypeSubmit}>Continuar</QuestionnaireNext>
            </QuestionnaireActions>
          </div>
        </QuestionnaireItem>

        {/* Paso 2: Datos del negocio */}
        <QuestionnaireItem name="business" required>
          <div className="flex flex-col gap-6">
            <QuestionnaireTitle>¿Cómo se llama tu negocio?</QuestionnaireTitle>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="business-name">Nombre del negocio</FieldLabel>
                <Input
                  id="business-name"
                  name="name"
                  autoComplete="organization"
                  maxLength={80}
                  placeholder="Café Central"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  autoFocus
                  required
                  className="text-base py-2.5"
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
                  placeholder={domainFromName(businessName) || "tunegocio.com"}
                  value={domain}
                  onChange={(e) =>
                    setManualDomain(
                      normalizeDomain(e.target.value).replace(/\s+/g, "")
                    )
                  }
                  required
                  className="text-base py-2.5"
                />
                <FieldDescription>
                  Incluye el TLD (por ejemplo .com o .mx). Tus usuarios serán
                  nombre@{domain || "tunegocio.com"}.
                </FieldDescription>
              </Field>
            </div>

            <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-3">
              <Checkbox
                id="has-branches"
                checked={hasBranches}
                onCheckedChange={setHasBranches}
                className="mt-0.5"
              />
              <div className="flex flex-col gap-0.5">
                <Label htmlFor="has-branches" className="cursor-pointer text-sm font-normal">
                  Tengo más de una sucursal
                </Label>
                <span className="text-xs text-muted-foreground">
                  Podrás crearlas y asignar personal en Configuración → Negocio.
                </span>
              </div>
            </div>
            <input type="hidden" name="hasBranches" value={hasBranches.toString()} />

            <QuestionnaireError>{businessForm.error}</QuestionnaireError>
            <QuestionnaireActions>
              <QuestionnairePrevious />
              <QuestionnaireNext onClick={handleBusinessSubmit}>Continuar</QuestionnaireNext>
            </QuestionnaireActions>
          </div>
        </QuestionnaireItem>

        {/* Paso 3: Datos del usuario */}
        <QuestionnaireItem name="profile" required>
          <div className="flex flex-col gap-6">
            <QuestionnaireTitle>Cuéntanos de ti</QuestionnaireTitle>

            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="owner-firstname">Nombre</FieldLabel>
                <Input
                  id="owner-firstname"
                  name="firstName"
                  autoComplete="given-name"
                  maxLength={80}
                  placeholder="Ana"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  autoFocus
                  required
                  className="text-lg py-3"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="owner-lastname">Apellido</FieldLabel>
                <Input
                  id="owner-lastname"
                  name="lastName"
                  autoComplete="family-name"
                  maxLength={80}
                  placeholder="Pérez"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  className="text-lg py-3"
                />
              </Field>
            </div>

            <Field>
              <AvailabilityLabel
                htmlFor="owner-username"
                label="ID de usuario"
                status={usernameStatus}
              />
              <div className="flex items-stretch overflow-hidden rounded-md border border-input bg-transparent shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30">
                <input
                  id="owner-username"
                  name="username"
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  maxLength={64}
                  placeholder="daniel"
                  value={local}
                  onChange={(e) =>
                    setManualLocal(
                      normalizeUsername(localPart(e.target.value))
                    )
                  }
                  required
                  className="h-11 min-w-0 flex-1 bg-transparent px-3 text-base outline-none placeholder:text-muted-foreground"
                />
                <span className="flex max-w-[55%] shrink-0 items-center truncate border-l bg-muted px-3 text-sm text-muted-foreground">
                  @{domain || "tunegocio.com"}
                </span>
              </div>
              <FieldDescription>
                Solo la parte antes de la @; se combina con el dominio del
                negocio.
              </FieldDescription>
            </Field>

            <QuestionnaireError>{profileForm.error}</QuestionnaireError>
            <QuestionnaireActions>
              <QuestionnairePrevious />
              <QuestionnaireNext onClick={handleProfileSubmit}>Continuar</QuestionnaireNext>
            </QuestionnaireActions>
          </div>
        </QuestionnaireItem>

        {/* Paso 4: Tipo de servicio (skippable) */}
        <QuestionnaireItem name="serviceTypes" required={false}>
          <div className="flex flex-col gap-6">
            <QuestionnaireTitle>¿Qué tipo de servicio ofreces?</QuestionnaireTitle>
            <p className="text-base text-muted-foreground text-center">
              Selecciona todos los que apliquen (puedes saltar este paso).
            </p>

            <QuestionnaireChoices multiple>
              {SERVICE_TYPES.map((type) => (
                <QuestionnaireChoice
                  key={type}
                  value={type}
                  name="serviceTypes"
                  type="checkbox"
                  checked={serviceTypes.includes(type)}
                  onChange={toggleServiceType}
                >
                  {type}
                </QuestionnaireChoice>
              ))}
            </QuestionnaireChoices>

            <QuestionnaireError>{serviceTypesForm.error}</QuestionnaireError>

            <QuestionnaireActions>
              <QuestionnairePrevious />
              <QuestionnaireNext onClick={handleServiceTypesSubmit}>Continuar</QuestionnaireNext>
            </QuestionnaireActions>
          </div>
        </QuestionnaireItem>

        {/* Paso 5: Objetivos (skippable) */}
        <QuestionnaireItem name="goals" required={false}>
          <div className="flex flex-col gap-6">
            <QuestionnaireTitle>¿Cuáles son tus objetivos?</QuestionnaireTitle>
            <p className="text-base text-muted-foreground text-center">
              Selecciona todos los que apliquen (puedes saltar este paso).
            </p>

            <QuestionnaireChoices multiple>
              {GOALS.map((goal) => (
                <QuestionnaireChoice
                  key={goal}
                  value={goal}
                  name="goals"
                  type="checkbox"
                  checked={goals.includes(goal)}
                  onChange={toggleGoal}
                >
                  {goal}
                </QuestionnaireChoice>
              ))}
            </QuestionnaireChoices>

            <QuestionnaireError>{goalsForm.error}</QuestionnaireError>

            <QuestionnaireActions>
              <QuestionnairePrevious />
              <QuestionnaireNext onClick={handleGoalsSubmit}>Continuar</QuestionnaireNext>
            </QuestionnaireActions>
          </div>
        </QuestionnaireItem>

        {/* Paso 6: Bienvenida */}
        <QuestionnaireItem name="welcome" required={false}>
          <div className="flex flex-col gap-6 text-center">
            <QuestionnaireTitle>¡Todo listo!</QuestionnaireTitle>

            <div className="flex items-center justify-center gap-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-6 py-4 text-base text-emerald-800 dark:text-emerald-300">
              <SparklesIcon className="size-5 shrink-0" />
              <p>
                Te damos la bienvenida a{" "}
                <span className="font-medium">
                  {businessName.trim() || "tu negocio"}
                </span>
                .
              </p>
            </div>

            <dl className="space-y-3 text-base">
              <div className="flex items-center justify-center gap-4">
                <dt className="text-muted-foreground">Giro principal</dt>
                <dd className="font-medium capitalize">{businessType || "No especificado"}</dd>
              </div>
              <div className="flex items-center justify-center gap-4">
                <dt className="text-muted-foreground">Negocio</dt>
                <dd className="font-medium">{businessName.trim()}</dd>
              </div>
              <div className="flex items-center justify-center gap-4">
                <dt className="text-muted-foreground">Dominio</dt>
                <dd className="font-medium">{domain.trim().toLowerCase()}</dd>
              </div>
              <div className="flex items-center justify-center gap-4">
                <dt className="text-muted-foreground">ID de usuario</dt>
                <dd className="font-medium">{username.trim().toLowerCase()}</dd>
              </div>
              {hasBranches && (
                <div className="flex items-center justify-center gap-4">
                  <dt className="text-muted-foreground">Sucursales</dt>
                  <dd className="font-medium">Sí</dd>
                </div>
              )}
              {serviceTypes.length > 0 && (
                <div className="flex flex-col items-center gap-2">
                  <dt className="text-muted-foreground">Tipo de servicio</dt>
                  <dd className="font-medium text-center max-w-md">
                    {serviceTypes.map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join(", ")}
                  </dd>
                </div>
              )}
              {goals.length > 0 && (
                <div className="flex flex-col items-center gap-2">
                  <dt className="text-muted-foreground">Objetivos</dt>
                  <dd className="font-medium text-center max-w-md">
                    {goals.map((g) => g.charAt(0).toUpperCase() + g.slice(1)).join(", ")}
                  </dd>
                </div>
              )}
            </dl>

            <QuestionnaireError>{finishForm.error}</QuestionnaireError>
            <QuestionnaireActions>
              <QuestionnairePrevious />
              <QuestionnaireSubmit
                onClick={handleFinishSubmit}
                disabled={finishForm.pending}
              >
                Ir al panel
              </QuestionnaireSubmit>
            </QuestionnaireActions>
          </div>
        </QuestionnaireItem>
      </div>
    </Questionnaire>
  )
}