"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { Building2Icon } from "lucide-react"

import { renameOrganization } from "@/app/(app)/settings/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useActionForm } from "@/hooks/use-action-form"
import { AvailabilityLabel } from "@/components/availability-field"
import type { AvailabilityStatus } from "@/components/availability-field"
import {
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field"
import { useDomainStatus } from "@/components/onboarding/domain-field"

const IDLE: AvailabilityStatus = { state: "idle", message: null }

export function OrganizationCard({
  name,
  domain,
  canManage,
}: {
  name: string
  domain: string | null
  canManage: boolean
}) {
  const router = useRouter()
  const form = useActionForm(() => router.refresh())
  const [value, setValue] = useState(name)
  // El dominio sigue al valor actual hasta que se edita a mano.
  const [manualDomain, setManualDomain] = useState<string | null>(
    domain || null
  )
  const domainValue = manualDomain ?? domain ?? ""
  const domainStatus = useDomainStatus(domainValue, {
    currentDomain: domain || null,
  })

  if (!canManage) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border/60 p-3 text-sm">
        <Building2Icon className="size-4 shrink-0 text-muted-foreground" />
        <div className="flex flex-col">
          <span className="font-medium">{name}</span>
          {domain ? (
            <span className="text-muted-foreground">
              Dominio: @{domain}
            </span>
          ) : null}
          <span className="text-muted-foreground">
            Solo un administrador puede cambiar el nombre y el dominio del
            negocio.
          </span>
        </div>
      </div>
    )
  }

  const nothingChanged =
    value.trim() === name && manualDomain === null

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        const formData = new FormData(event.currentTarget)
        form.run(() => renameOrganization(formData))
      }}
    >
      <div className="flex flex-col gap-2">
        <label htmlFor="organization-name" className="text-sm font-medium">
          Nombre del negocio
        </label>
        <Input
          id="organization-name"
          name="name"
          value={value}
          maxLength={80}
          onChange={(event) => setValue(event.target.value)}
          required
        />
      </div>

      <div className="flex flex-col gap-2">
        <AvailabilityLabel
          htmlFor="organization-domain"
          label="Dominio"
          status={domainStatus}
        />
        <Input
          id="organization-domain"
          name="domain"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={80}
          placeholder="naranjapimienta.cafe"
          value={domainValue}
          onChange={(event) =>
            setManualDomain(
              event.target.value === "" ? null : event.target.value
            )
          }
          required
        />
        <FieldDescription>
          Con este dominio se crean los usuarios del equipo: nombre@dominio.
        </FieldDescription>
      </div>

      <Button
        type="submit"
        disabled={
          form.pending ||
          value.trim().length < 2 ||
          nothingChanged ||
          domainStatus.state === "taken" ||
          domainStatus.state === "invalid" ||
          domainStatus.state === "error"
        }
      >
        {form.pending ? "Guardando..." : "Guardar"}
      </Button>
      <p className="text-xs text-muted-foreground">
        Aparece en la barra lateral y en los documentos del negocio.
      </p>
      {form.error ? (
        <p role="alert" className="text-sm text-destructive">
          {form.error}
        </p>
      ) : null}
    </form>
  )
}
