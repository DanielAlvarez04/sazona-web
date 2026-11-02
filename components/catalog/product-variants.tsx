"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import {
  Loader2Icon,
  PlusIcon,
  SaveIcon,
  Trash2Icon,
  TriangleAlertIcon,
} from "lucide-react"
import { toast } from "sonner"

import {
  createVariant,
  deactivateVariant,
  updateVariant,
  type VariantUpdateInput,
} from "@/app/(app)/catalog/actions"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useActionForm } from "@/hooks/use-action-form"
import { formatMoney, type ItemDetail, type Variant } from "@/lib/catalog"
import { isEmptyPatch, sameNumber, sameText } from "@/lib/diff"

export function ProductVariants({
  product,
  canManage,
}: {
  product: ItemDetail
  canManage: boolean
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Presentaciones</CardTitle>
        <CardDescription>
          Tamaños o versiones con un ajuste de precio. El factor escala el
          consumo de la receta: Regular es la medida base (1).
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {product.variants.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Este artículo no tiene presentaciones.
          </p>
        ) : (
          product.variants.map((variant) => (
            <VariantRow
              key={variant.id}
              itemId={product.id}
              variant={variant}
              canManage={canManage}
            />
          ))
        )}

        {canManage ? <VariantCreateForm itemId={product.id} /> : null}
      </CardContent>
    </Card>
  )
}

function VariantRow({
  itemId,
  variant,
  canManage,
}: {
  itemId: string
  variant: Variant
  canManage: boolean
}) {
  const router = useRouter()
  const saveForm = useActionForm(() => router.refresh())
  const deleteForm = useActionForm(() => router.refresh())
  const [confirmDeactivate, setConfirmDeactivate] = useState(false)

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-md border p-3">
      <form
        className="flex flex-1 flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          const formData = new FormData(event.currentTarget)

          const name = String(formData.get("name") ?? "").trim()
          const rawAdjust = String(formData.get("priceAdjust") ?? "").trim()
          const rawFactor = String(formData.get("recipeFactor") ?? "").trim()
          const priceAdjust = rawAdjust
            ? Number(rawAdjust.replace(",", "."))
            : 0
          const recipeFactor = rawFactor
            ? Number(rawFactor.replace(",", "."))
            : 1
          const isActive = formData.get("isActive") === "on"

          const changes: VariantUpdateInput = {
            ...(sameText(variant.name, name) ? {} : { name }),
            ...(sameNumber(variant.priceAdjust, priceAdjust)
              ? {}
              : { priceAdjust }),
            ...(sameNumber(variant.recipeFactor, recipeFactor)
              ? {}
              : { recipeFactor }),
            ...(variant.isActive === isActive ? {} : { isActive }),
          }

          if (isEmptyPatch(changes)) {
            toast.info("Sin cambios")
            return
          }

          saveForm.run(() => updateVariant(itemId, variant.id, changes))
        }}
      >
        <Field className="min-w-32 flex-1">
          <FieldLabel htmlFor={`variant-name-${variant.id}`}>Nombre</FieldLabel>
          <Input
            id={`variant-name-${variant.id}`}
            name="name"
            defaultValue={variant.name}
            required
            disabled={!canManage}
          />
        </Field>
        <Field className="w-28">
          <FieldLabel htmlFor={`variant-adjust-${variant.id}`}>
            Ajuste
          </FieldLabel>
          <Input
            id={`variant-adjust-${variant.id}`}
            name="priceAdjust"
            type="number"
           
            defaultValue={variant.priceAdjust}
            disabled={!canManage}
          />
        </Field>
        <Field className="w-28">
          <FieldLabel htmlFor={`variant-factor-${variant.id}`}>
            Factor
          </FieldLabel>
          <Input
            id={`variant-factor-${variant.id}`}
            name="recipeFactor"
            type="number"
            min="0.001"
            step="0.1"
            defaultValue={variant.recipeFactor}
            disabled={!canManage}
          />
        </Field>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={variant.isActive}
            disabled={!canManage}
            className="size-4 accent-primary"
          />
          Activa
        </label>
        {canManage ? (
          <Button type="submit" variant="outline" disabled={saveForm.pending}>
            {saveForm.pending ? (
              <Loader2Icon className="animate-spin" />
            ) : (
              <SaveIcon />
            )}
            Guardar
          </Button>
        ) : null}
      </form>

      <div className="flex items-center gap-2">
        <Badge variant="outline">
          +{formatMoney(variant.priceAdjust)} · x{variant.recipeFactor}
        </Badge>
        {canManage && variant.isActive ? (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Desactivar ${variant.name}`}
            disabled={deleteForm.pending}
            onClick={() => setConfirmDeactivate(true)}
          >
            <Trash2Icon />
          </Button>
        ) : null}
      </div>

      {saveForm.error ? <FieldError>{saveForm.error}</FieldError> : null}
      {deleteForm.error ? <FieldError>{deleteForm.error}</FieldError> : null}

      <AlertDialog open={confirmDeactivate} onOpenChange={setConfirmDeactivate}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive">
              <TriangleAlertIcon />
            </AlertDialogMedia>
            <AlertDialogTitle>Desactivar presentación</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Desactivar la presentación «{variant.name}»? Dejará de estar
              disponible en el punto de venta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() =>
                deleteForm.run(() => deactivateVariant(itemId, variant.id))
              }
            >
              Desactivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function VariantCreateForm({ itemId }: { itemId: string }) {
  const router = useRouter()
  const { pending, error, run } = useActionForm(() => router.refresh())

  return (
    <form
      className="flex flex-wrap items-end gap-2 rounded-md border border-dashed p-3"
      onSubmit={(event) => {
        event.preventDefault()
        const form = event.currentTarget
        const formData = new FormData(form)
        run(async () => {
          const result = await createVariant(itemId, formData)
          if (result.ok) form.reset()
          return result
        })
      }}
    >
      <Field className="min-w-32 flex-1">
        <FieldLabel htmlFor="new-variant-name">Nueva variante</FieldLabel>
        <Input
          id="new-variant-name"
          name="name"
          required
          maxLength={80}
          placeholder="Grande"
        />
      </Field>
      <Field className="w-28">
        <FieldLabel htmlFor="new-variant-adjust">Ajuste</FieldLabel>
        <Input
          id="new-variant-adjust"
          name="priceAdjust"
          type="number"
         
          defaultValue={0}
        />
      </Field>
      <Field className="w-28">
        <FieldLabel htmlFor="new-variant-factor">Factor</FieldLabel>
        <Input
          id="new-variant-factor"
          name="recipeFactor"
          type="number"
          min="0.001"
          step="0.1"
          defaultValue={1}
        />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? <Loader2Icon className="animate-spin" /> : <PlusIcon />}
        Añadir
      </Button>
      {error ? <FieldError className="w-full">{error}</FieldError> : null}
    </form>
  )
}
