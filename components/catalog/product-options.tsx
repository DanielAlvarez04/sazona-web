"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2Icon, SaveIcon } from "lucide-react"
import { toast } from "sonner"

import { updateArticle } from "@/app/(app)/catalog/actions"
import {
  OptionGroupsEditor,
  optionGroupDrafts,
  optionGroupPayload,
  optionGroupsSignature,
  type OptionGroupDraft,
} from "@/components/catalog/option-groups-editor"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { FieldError } from "@/components/ui/field"
import { useActionForm } from "@/hooks/use-action-form"
import type {
  ItemDetail,
  OptionGroup,
  OptionGroupPreset,
} from "@/lib/catalog"

export function ProductOptions({
  product,
  library,
  presets,
  taxRate,
  canManage,
}: {
  product: ItemDetail
  library: OptionGroup[]
  presets: OptionGroupPreset[]
  taxRate: string
  canManage: boolean
}) {
  const router = useRouter()
  const form = useActionForm(() => router.refresh())
  const [groups, setGroups] = useState<OptionGroupDraft[]>(() =>
    optionGroupDrafts(product.optionGroups)
  )

  function save() {
    form.run(async () => {
      for (const group of groups) {
        if (
          group.isRequired &&
          group.values.length > 0 &&
          !group.values.some((value) => value.isActive)
        ) {
          return {
            ok: false,
            message: `El grupo obligatorio «${group.groupName}» necesita al menos una opción disponible`,
          }
        }
      }

      if (
        optionGroupsSignature(groups) ===
        optionGroupsSignature(optionGroupDrafts(product.optionGroups))
      ) {
        toast.info("Sin cambios")
        return { ok: true }
      }

      const result = await updateArticle(product.id, {
        optionGroups: optionGroupPayload(groups),
      })

      if (result.ok) toast.success("Opciones guardadas")

      return result
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Opciones y grupos</CardTitle>
        <CardDescription>
          Salsas, proteínas, leches, extras o ingredientes que se pueden quitar.
          El precio de cada opción es propio de este artículo.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <OptionGroupsEditor
          library={library}
          presets={presets}
          value={groups}
          onChange={setGroups}
          disabled={!canManage || form.pending}
          taxRate={taxRate}
        />

        {canManage ? (
          <div className="flex justify-end">
            <Button type="button" onClick={save} disabled={form.pending}>
              {form.pending ? (
                <Loader2Icon className="animate-spin" />
              ) : (
                <SaveIcon />
              )}
              Guardar opciones
            </Button>
          </div>
        ) : null}

        {form.error ? <FieldError>{form.error}</FieldError> : null}
      </CardContent>
    </Card>
  )
}
