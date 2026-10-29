"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { Loader2Icon, SaveIcon } from "lucide-react"

import { updateOrganizationTaxRate } from "@/app/(app)/settings/actions"
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

/** Convierte `0.16` en `16` sin arrastrar decimales binarios. */
function toPercent(taxRate: string): string {
  const value = Number(taxRate)
  if (!Number.isFinite(value)) return "16"
  return String(Math.round(value * 10000) / 100)
}

/**
 * IVA del negocio.
 *
 * Es la tasa que se aplica a los artículos que no tienen una propia y la que
 * usan los pedidos nuevos para separar el impuesto del precio final.
 */
export function TaxSettingsCard({
  taxRate,
  canManage,
}: {
  taxRate: string
  canManage: boolean
}) {
  const router = useRouter()
  const { pending, error, run } = useActionForm(() => router.refresh())
  const [value, setValue] = useState(() => toPercent(taxRate))

  const percent = Number(value.replace(",", "."))
  const preview = Number.isFinite(percent) ? percent : 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>IVA</CardTitle>
        <CardDescription>
          Se aplica a los artículos que no tengan una tasa propia y a los
          pedidos nuevos. Los pedidos ya registrados conservan su IVA.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            const formData = new FormData(event.currentTarget)
            run(() => updateOrganizationTaxRate(formData))
          }}
        >
          <div className="flex flex-wrap items-end gap-3">
            <Field className="max-w-40">
              <FieldLabel htmlFor="organization-tax">Tasa de IVA (%)</FieldLabel>
              <Input
                id="organization-tax"
                name="taxRate"
                type="number"
                min="0"
                max="100"
               
                value={value}
                onChange={(event) => setValue(event.target.value)}
                disabled={!canManage || pending}
                required
              />
              <FieldDescription>
                {preview} % · el precio del catálogo ya incluye IVA.
              </FieldDescription>
            </Field>

            {canManage ? (
              <Button type="submit" disabled={pending}>
                {pending ? (
                  <Loader2Icon className="animate-spin" />
                ) : (
                  <SaveIcon />
                )}
                Guardar IVA
              </Button>
            ) : null}
          </div>

          {!canManage ? (
            <p className="text-xs text-muted-foreground">
              Solo administración puede cambiar el IVA del negocio.
            </p>
          ) : null}

          {error ? <FieldError>{error}</FieldError> : null}
        </form>
      </CardContent>
    </Card>
  )
}
