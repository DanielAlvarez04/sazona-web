"use client"

import { Field, FieldLabel } from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import type { PromotionType } from "@/lib/catalog"

interface ComboPromotionOption {
  key: string
  label: string
  itemId: string
  variantId: string
}

export function ComboPromotionFields({
  type,
  active,
  onActiveChange,
  payQuantity,
  onPayQuantityChange,
  getQuantity,
  onGetQuantityChange,
  percent,
  onPercentChange,
  fixed,
  onFixedChange,
  specialPrice,
  onSpecialPriceChange,
  freeKey,
  onFreeKeyChange,
  secondKey,
  onSecondKeyChange,
  components,
  disabled,
}: {
  type: PromotionType
  active: boolean
  onActiveChange: (active: boolean) => void
  payQuantity: string
  onPayQuantityChange: (value: string) => void
  getQuantity: string
  onGetQuantityChange: (value: string) => void
  percent: string
  onPercentChange: (value: string) => void
  fixed: string
  onFixedChange: (value: string) => void
  specialPrice: string
  onSpecialPriceChange: (value: string) => void
  freeKey: string
  onFreeKeyChange: (value: string) => void
  secondKey: string
  onSecondKeyChange: (value: string) => void
  components: ComboPromotionOption[]
  disabled?: boolean
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">Promoción activa</span>
          <span className="text-xs text-muted-foreground">
            Si se apaga, el combo se vende a su precio normal.
          </span>
        </div>
        <Switch
          checked={active}
          onCheckedChange={onActiveChange}
          disabled={disabled}
        />
      </div>

      {type === "PAY_X_GET_Y" ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                onPayQuantityChange("1")
                onGetQuantityChange("2")
              }}
              disabled={disabled}
            >
              2x1
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                onPayQuantityChange("2")
                onGetQuantityChange("3")
              }}
              disabled={disabled}
            >
              3x2
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="combo-pay-quantity">Cantidad que paga</FieldLabel>
              <Input
                id="combo-pay-quantity"
                type="number"
                min="1"
                step="1"
                value={payQuantity}
                onChange={(event) => onPayQuantityChange(event.target.value)}
                disabled={disabled}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="combo-get-quantity">Cantidad que recibe</FieldLabel>
              <Input
                id="combo-get-quantity"
                type="number"
                min="1"
                step="1"
                value={getQuantity}
                onChange={(event) => onGetQuantityChange(event.target.value)}
                disabled={disabled}
              />
            </Field>
          </div>
        </div>
      ) : null}

      {type === "PERCENT" ? (
        <Field>
          <FieldLabel htmlFor="combo-percent">Porcentaje de descuento</FieldLabel>
          <InputGroup>
            <InputGroupInput
              id="combo-percent"
              type="number"
              min="1"
              max="100"
              step="0.01"
              value={percent}
              onChange={(event) => onPercentChange(event.target.value)}
              disabled={disabled}
              placeholder="0.00"
            />
            <InputGroupAddon align="inline-end">
              <InputGroupText>%</InputGroupText>
            </InputGroupAddon>
          </InputGroup>
        </Field>
      ) : null}

      {type === "FIXED" ? (
        <Field>
          <FieldLabel htmlFor="combo-fixed">Descuento fijo</FieldLabel>
          <InputGroup>
            <InputGroupAddon align="inline-start">
              <InputGroupText>$</InputGroupText>
            </InputGroupAddon>
            <InputGroupInput
              id="combo-fixed"
              type="number"
              min="0"
              step="0.01"
              value={fixed}
              onChange={(event) => onFixedChange(event.target.value)}
              disabled={disabled}
              placeholder="0.00"
            />
            <InputGroupAddon align="inline-end">
              <InputGroupText>MXN</InputGroupText>
            </InputGroupAddon>
          </InputGroup>
        </Field>
      ) : null}

      {type === "SPECIAL_PRICE" ? (
        <Field>
          <FieldLabel htmlFor="combo-special-price">Precio especial</FieldLabel>
          <InputGroup>
            <InputGroupAddon align="inline-start">
              <InputGroupText>$</InputGroupText>
            </InputGroupAddon>
            <InputGroupInput
              id="combo-special-price"
              type="number"
              min="0"
              step="0.01"
              value={specialPrice}
              onChange={(event) => onSpecialPriceChange(event.target.value)}
              disabled={disabled}
              placeholder="0.00"
            />
            <InputGroupAddon align="inline-end">
              <InputGroupText>MXN</InputGroupText>
            </InputGroupAddon>
          </InputGroup>
        </Field>
      ) : null}

      {type === "FREE_ITEM" || type === "SECOND_HALF_PRICE" ? (
        <Field>
          <FieldLabel htmlFor="combo-promotion-item">
            {type === "FREE_ITEM"
              ? "Producto gratis"
              : "Producto con 50 % de descuento"}
          </FieldLabel>
          <Select
            value={
              (type === "FREE_ITEM" ? freeKey : secondKey) || null
            }
            onValueChange={(value) =>
              type === "FREE_ITEM"
                ? onFreeKeyChange(value ?? "")
                : onSecondKeyChange(value ?? "")
            }
            items={components.map((component) => ({
              value: component.key,
              label: component.label,
            }))}
            disabled={disabled || components.length === 0}
          >
            <SelectTrigger id="combo-promotion-item" className="w-full">
              <SelectValue placeholder="Selecciona un artículo del combo" />
            </SelectTrigger>
            <SelectContent>
              {components.map((component) => (
                <SelectItem key={component.key} value={component.key}>
                  {component.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {components.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Primero agrega artículos al combo en la tab Artículos del combo.
            </p>
          ) : null}
        </Field>
      ) : null}
    </section>
  )
}
