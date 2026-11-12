"use client"

import * as React from "react"
import { KeyRoundIcon, Loader2Icon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { setMyPosPin } from "@/lib/pos-device-actions"

/**
 * PIN personal para entrar a la caja en una tablet vinculada.
 *
 * El PIN pertenece a la membresía del negocio, no a la cuenta global: dos
 * negocios pueden tener PINs distintos para la misma persona.
 */
export function PosPinCard() {
  const [pin, setPin] = React.useState("")
  const [confirmation, setConfirmation] = React.useState("")
  const [pending, setPending] = React.useState(false)

  const submit = async () => {
    if (!/^\d{4,8}$/.test(pin)) {
      toast.error("El PIN debe tener entre 4 y 8 dígitos")
      return
    }

    if (pin !== confirmation) {
      toast.error("Los PIN no coinciden")
      return
    }

    setPending(true)

    try {
      const result = await setMyPosPin(pin)

      if (!result.ok) {
        toast.error(result.message ?? "No se pudo guardar el PIN")
        return
      }

      toast.success("PIN de caja guardado")
      setPin("")
      setConfirmation("")
    } finally {
      setPending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>PIN de caja</CardTitle>
        <CardDescription>
          Con este PIN entras al punto de venta desde una tablet o computadora
          vinculada, sin escribir tu contraseña.
        </CardDescription>
        <KeyRoundIcon className="absolute top-6 right-6 size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="pos-pin">PIN (4-8 dígitos)</FieldLabel>
            <Input
              id="pos-pin"
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              maxLength={8}
              value={pin}
              onChange={(event) =>
                setPin(event.target.value.replace(/\D/g, "").slice(0, 8))
              }
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="pos-pin-confirm">Repite el PIN</FieldLabel>
            <Input
              id="pos-pin-confirm"
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              maxLength={8}
              value={confirmation}
              onChange={(event) =>
                setConfirmation(
                  event.target.value.replace(/\D/g, "").slice(0, 8)
                )
              }
            />
          </Field>
        </div>

        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            Si olvidas el PIN, un administrador puede asignarte uno nuevo.
          </p>
          <Button type="button" onClick={submit} disabled={pending}>
            {pending ? <Loader2Icon className="animate-spin" /> : null}
            Guardar PIN
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
