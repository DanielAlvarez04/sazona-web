"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { Loader2Icon, PlusIcon, SaveIcon, Trash2Icon } from "lucide-react"

import { replaceComboComponents } from "@/app/(app)/catalog/actions"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { FieldError } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useActionForm } from "@/hooks/use-action-form"
import { formatMoney, type ProductDetail, type ProductListItem } from "@/lib/catalog"

interface ComboRow {
  key: string
  productId: string
  variantId: string
  quantity: string
}

let rowCounter = 0

function nextKey() {
  rowCounter += 1
  return `combo-row-${rowCounter}`
}

export function ProductCombo({
  product,
  products,
  canManage,
}: {
  product: ProductDetail
  products: ProductListItem[]
  canManage: boolean
}) {
  const router = useRouter()
  const { pending, error, run } = useActionForm(() => router.refresh())

  const [rows, setRows] = useState<ComboRow[]>(() =>
    product.comboComponents.map((component) => ({
      key: nextKey(),
      productId: component.component.id,
      variantId: component.variant?.id ?? "",
      quantity: String(component.quantity),
    }))
  )

  // Un combo no puede contener otro combo ni artículos desactivados.
  const options = products.filter(
    (candidate) =>
      candidate.id !== product.id &&
      !candidate.isCombo &&
      (candidate.isActive ||
        rows.some((row) => row.productId === candidate.id))
  )

  function updateRow(key: string, changes: Partial<ComboRow>) {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...changes } : row))
    )
  }

  function addRow() {
    setRows((current) => [
      ...current,
      { key: nextKey(), productId: "", variantId: "", quantity: "1" },
    ])
  }

  function removeRow(key: string) {
    setRows((current) => current.filter((row) => row.key !== key))
  }

  function save() {
    const components = rows
      .filter((row) => row.productId)
      .map((row) => ({
        productId: row.productId,
        ...(row.variantId ? { variantId: row.variantId } : {}),
        quantity: Math.max(1, Math.trunc(Number(row.quantity) || 1)),
      }))

    const unique = new Set(
      components.map(
        (component) => `${component.productId}:${component.variantId ?? ""}`
      )
    )

    if (components.length === 0) {
      // El combo no puede quedarse sin componentes.
      window.alert("El combo debe tener al menos un componente.")
      return
    }

    if (unique.size !== components.length) {
      // Duplicados: el formulario local lo señala sin llamar a la API.
      window.alert("Cada artículo/variante solo puede aparecer una vez.")
      return
    }

    run(() => replaceComboComponents(product.id, components))
  }

  const total = rows.reduce((sum, row) => {
    const component = products.find((candidate) => candidate.id === row.productId)
    if (!component) return sum

    const variant = component.variants.find(
      (candidate) => candidate.id === row.variantId
    )
    const unitPrice = Number(component.price) + Number(variant?.priceAdjust ?? 0)
    return sum + unitPrice * Math.max(1, Math.trunc(Number(row.quantity) || 1))
  }, 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Componentes del combo</CardTitle>
        <CardDescription>
          Artículos que incluye el combo. Los combos no pueden contener otros
          combos y el descuento del combo se define en el precio del artículo.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            El combo todavía no tiene componentes.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {rows.map((row) => {
              const component = products.find(
                (candidate) => candidate.id === row.productId
              )
              const variants = (component?.variants ?? []).filter(
                (variant) => variant.isActive || variant.id === row.variantId
              )

              return (
                <div
                  key={row.key}
                  className="grid gap-2 rounded-md border p-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_5rem_auto]"
                >
                  <Select
                    value={row.productId || "none"}
                    disabled={!canManage}
                    onValueChange={(value) =>
                      updateRow(row.key, {
                        productId: value === "none" ? "" : (value ?? ""),
                        variantId: "",
                      })
                    }
                    items={[
                      { value: "none", label: "Elige un artículo" },
                      ...options.map((candidate) => ({
                        value: candidate.id,
                        label: `${candidate.name}${candidate.isActive ? "" : " (inactivo)"}`,
                      })),
                    ]}
                  >
                    <SelectTrigger
                      className="w-full"
                      aria-label="Artículo del combo"
                    >
                      <SelectValue placeholder="Elige un artículo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Elige un artículo</SelectItem>
                      {options.map((candidate) => (
                        <SelectItem key={candidate.id} value={candidate.id}>
                          {candidate.name}
                          {candidate.isActive ? "" : " (inactivo)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={row.variantId || "none"}
                    disabled={!canManage || !component || variants.length === 0}
                    onValueChange={(value) =>
                      updateRow(row.key, {
                        variantId: value === "none" ? "" : (value ?? ""),
                      })
                    }
                    items={[
                      { value: "none", label: "Sin variante" },
                      ...variants.map((variant) => ({
                        value: variant.id,
                        label: variant.name,
                      })),
                    ]}
                  >
                    <SelectTrigger
                      className="w-full"
                      aria-label="Variante del componente"
                    >
                      <SelectValue placeholder="Sin variante" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin variante</SelectItem>
                      {variants.map((variant) => (
                        <SelectItem key={variant.id} value={variant.id}>
                          {variant.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Input
                    aria-label="Cantidad del componente"
                    type="number"
                    min="1"
                   
                    value={row.quantity}
                    disabled={!canManage}
                    onChange={(event) =>
                      updateRow(row.key, { quantity: event.target.value })
                    }
                  />

                  {canManage ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Quitar componente"
                      onClick={() => removeRow(row.key)}
                    >
                      <Trash2Icon />
                    </Button>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            Valor de los componentes:{" "}
            <span className="font-medium text-foreground">{formatMoney(total)}</span>
          </p>

          {canManage ? (
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={addRow}>
                <PlusIcon />
                Añadir componente
              </Button>
              <Button
                type="button"
                disabled={pending || rows.length === 0}
                onClick={save}
              >
                {pending ? (
                  <Loader2Icon className="animate-spin" />
                ) : (
                  <SaveIcon />
                )}
                Guardar combo
              </Button>
            </div>
          ) : null}
        </div>

        {error ? <FieldError>{error}</FieldError> : null}
      </CardContent>
    </Card>
  )
}
