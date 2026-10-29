"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  CreditCardIcon,
  Loader2Icon,
  MinusIcon,
  PlusIcon,
  SearchIcon,
  ShoppingCartIcon,
  Trash2Icon,
  UtensilsIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { PageHeader } from "@/components/page-header"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { useOfflineSync } from "@/components/offline/offline-provider"
import { PendingOperations } from "@/components/offline/pending-operations"
import {
  formatMoney,
  type Category,
  type ProductListItem,
} from "@/lib/catalog"
import { createOrder, sendRound, type RoundItemInput } from "@/lib/order-actions"
import type { Branch } from "@/lib/branches"
import { orderLabel, type Order } from "@/lib/orders"

import { ChargeDialog } from "./charge-dialog"

interface CartExtra {
  id: string
  name: string
  price: number
}

interface CartLine {
  key: string
  productId: string
  productName: string
  variantId?: string
  variantName?: string
  unitPrice: number
  quantity: number
  notes?: string
  extras: CartExtra[]
  excludedIngredientIds: string[]
  excludedNames: string[]
}

function cartLineTotal(line: CartLine): number {
  return line.unitPrice * line.quantity
}

function lineToInput(line: CartLine): RoundItemInput {
  return {
    productId: line.productId,
    variantId: line.variantId,
    quantity: line.quantity,
    notes: line.notes,
    extras: line.extras.map((extra) => ({ extraId: extra.id })),
    excludedIngredientIds:
      line.excludedIngredientIds.length > 0
        ? line.excludedIngredientIds
        : undefined,
  }
}

export function PosView({
  products,
  categories,
  orders,
  canDraft,
  canSend,
  canRegister,
  canConfirm,
  canRefund,
  branch,
}: {
  products: ProductListItem[]
  categories: Category[]
  orders: Order[]
  canDraft: boolean
  canSend: boolean
  canRegister: boolean
  canConfirm: boolean
  canRefund: boolean
  /** Sucursal activa; `null` = vista consolidada. */
  branch: Branch | null
}) {
  const router = useRouter()
  const offline = useOfflineSync()

  const [search, setSearch] = React.useState("")
  const [categoryId, setCategoryId] = React.useState("")
  const [cart, setCart] = React.useState<CartLine[]>([])
  const [selectedProduct, setSelectedProduct] =
    React.useState<ProductListItem | null>(null)
  const [charging, setCharging] = React.useState(false)

  const [orderId, setOrderId] = React.useState("")
  const [tableNumber, setTableNumber] = React.useState("")
  const [takeaway, setTakeaway] = React.useState(false)
  const [sending, setSending] = React.useState(false)

  const activeOrder = orders.find((order) => order.id === orderId) ?? null
  const total = cart.reduce((sum, line) => sum + cartLineTotal(line), 0)

  const filtered = React.useMemo(() => {
    const needle = search.trim().toLowerCase()

    return products.filter((product) => {
      if (categoryId && product.category?.id !== categoryId) return false
      if (!needle) return true
      return (
        product.name.toLowerCase().includes(needle) ||
        (product.sku ?? "").toLowerCase().includes(needle)
      )
    })
  }, [products, search, categoryId])

  const addLine = (line: Omit<CartLine, "key">) => {
    setCart((current) => [
      ...current,
      { ...line, key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` },
    ])
  }

  const changeQuantity = (key: string, delta: number) => {
    setCart((current) =>
      current.flatMap((line) => {
        if (line.key !== key) return [line]
        const quantity = line.quantity + delta
        return quantity <= 0 ? [] : [{ ...line, quantity }]
      })
    )
  }

  const removeLine = (key: string) => {
    setCart((current) => current.filter((line) => line.key !== key))
  }

  const selectOrder = (value: string) => {
    setOrderId(value)
    setCart([])
  }

  const handleSend = async () => {
    if (cart.length === 0) {
      toast.error("Añade al menos un artículo")
      return
    }

    const items = cart.map(lineToInput)
    const lineLabel = `${cart.length} línea${cart.length === 1 ? "" : "s"}`
    const label = orderId
      ? `${activeOrder ? orderLabel(activeOrder) : "Cuenta abierta"} · ${lineLabel}`
      : `${
          tableNumber.trim()
            ? `Mesa ${tableNumber.trim()}`
            : takeaway
              ? "Para llevar"
              : "Sin mesa"
        } · ${lineLabel}`

    // Claves estables: si el envío falla por red después de que el servidor lo
    // procesó, el reintento devuelve la operación existente en vez de duplicar.
    const orderKey = crypto.randomUUID()
    const roundKey = crypto.randomUUID()

    const resetDraft = () => {
      setCart([])
      setTableNumber("")
      setTakeaway(false)
    }

    // Guarda la comanda en IndexedDB. Nunca se anuncia como recibida por
    // cocina: eso solo ocurre cuando el servidor confirma el envío.
    const queueOffline = async (targetOrderId?: string) => {
      try {
        await offline.enqueueRound({
          orderId: targetOrderId,
          tableNumber: tableNumber.trim() || undefined,
          isTakeaway: takeaway,
          items,
          total,
          label,
          orderIdempotencyKey: orderKey,
          roundIdempotencyKey: roundKey,
        })
      } catch {
        // Si el dispositivo no puede guardar (IndexedDB bloqueada), la comanda
        // sigue en pantalla para no perderla.
        toast.error("No se pudo guardar la comanda en este dispositivo", {
          description: "Revisa el almacenamiento del navegador e inténtalo de nuevo.",
        })
        return
      }

      toast.success("Comanda guardada en este dispositivo", {
        description:
          "Se enviará al recuperar la conexión. Cocina todavía no la ha recibido.",
      })
      resetDraft()
    }

    if (!offline.isOnline) {
      await queueOffline()
      return
    }

    setSending(true)

    try {
      let targetId = orderId

      if (!targetId) {
        const created = await createOrder({
          tableNumber: tableNumber.trim() || undefined,
          isTakeaway: takeaway,
          idempotencyKey: orderKey,
        })

        if (!created.ok || !created.data) {
          if (created.network) {
            await queueOffline()
            return
          }

          toast.error(created.message ?? "No se pudo abrir la cuenta")
          return
        }

        targetId = created.data.id
        setOrderId(targetId)
      }

      const result = await sendRound(targetId, {
        items,
        idempotencyKey: roundKey,
      })

      if (!result.ok) {
        if (result.network) {
          await queueOffline(targetId)
          return
        }

        toast.error(result.message ?? "No se pudo enviar la ronda")
        return
      }

      toast.success(`Ronda enviada · ${formatMoney(total)}`)

      const warnings = result.data?.warnings ?? []
      if (warnings.length > 0) {
        toast.warning(
          `Stock insuficiente: ${warnings.map((warning) => warning.name).join(", ")}`
        )
      }

      resetDraft()
      router.refresh()
    } catch {
      if (!navigator.onLine) {
        await queueOffline(orderId || undefined)
      } else {
        toast.error("No se pudo enviar la ronda")
      }
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="@container/main flex flex-1 flex-col gap-4 px-4 py-6 lg:px-6">
      <PageHeader
        title="Punto de venta"
        description="Toma la comanda y envíala a cocina."
        branch={branch}
        actions={
          <>
            <Label htmlFor="order-select" className="sr-only">
              Cuenta abierta
            </Label>
            <Select
              value={orderId || "new"}
              onValueChange={(value) =>
                selectOrder(value === "new" ? "" : (value ?? ""))
              }
              items={[
                { value: "new", label: "Nueva cuenta" },
                ...orders.map((order) => ({
                  value: order.id,
                  label: `${orderLabel(order)} · ${formatMoney(order.total)}${
                    branch || !order.branch ? "" : ` · ${order.branch.name}`
                  }`,
                })),
              ]}
            >
              <SelectTrigger
                id="order-select"
                className="w-64"
                aria-label="Cuenta abierta"
              >
                <SelectValue placeholder="Nueva cuenta" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">Nueva cuenta</SelectItem>
                {orders.map((order) => (
                  <SelectItem key={order.id} value={order.id}>
                    {orderLabel(order)} · {formatMoney(order.total)}
                    {branch || !order.branch ? "" : ` · ${order.branch.name}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-56 flex-1">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar artículo"
                className="pl-8"
                aria-label="Buscar artículos"
              />
            </div>
            <Select
              value={categoryId || "all"}
              onValueChange={(value) =>
                setCategoryId(value === "all" ? "" : (value ?? ""))
              }
              items={[
                { value: "all", label: "Todas las categorías" },
                ...categories.map((category) => ({
                  value: category.id,
                  label: category.name,
                })),
              ]}
            >
              <SelectTrigger
                className="w-52"
                aria-label="Filtrar por categoría"
              >
                <SelectValue placeholder="Todas las categorías" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-14 text-center text-sm text-muted-foreground">
              <UtensilsIcon className="size-8" />
              No hay artículos que coincidan con el filtro.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
              {filtered.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => setSelectedProduct(product)}
                  className="flex flex-col items-start gap-1 rounded-xl border border-border/70 p-3 text-left transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <span className="line-clamp-2 text-sm font-medium">
                    {product.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {product.category?.name ?? "Sin categoría"}
                  </span>
                  <span className="mt-1 text-sm font-semibold tabular-nums">
                    {formatMoney(product.price)}
                  </span>
                  {product.isCombo ? (
                    <Badge variant="secondary">Combo</Badge>
                  ) : null}
                </button>
              ))}
            </div>
          )}
        </div>

        <aside className="flex h-fit flex-col gap-3 rounded-xl border bg-card p-4 lg:sticky lg:top-4">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-medium">
              <ShoppingCartIcon className="size-4" />
              Comanda
            </h3>
            {activeOrder ? (
              <div className="flex items-center gap-1.5">
                {branch || !activeOrder.branch ? null : (
                  <Badge variant="outline">{activeOrder.branch.name}</Badge>
                )}
                <Badge variant="secondary">{orderLabel(activeOrder)}</Badge>
              </div>
            ) : null}
          </div>

          {!activeOrder ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="pos-table">Mesa</Label>
              <Input
                id="pos-table"
                value={tableNumber}
                onChange={(event) => setTableNumber(event.target.value)}
                placeholder="Ej. 4"
                maxLength={20}
              />
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={takeaway}
                  onCheckedChange={(next) => setTakeaway(Boolean(next))}
                />
                Para llevar
              </label>
            </div>
          ) : null}

          <Separator />

          {cart.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Elige artículos del catálogo para armar la ronda.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {cart.map((line) => (
                <li key={line.key} className="flex flex-col gap-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {line.productName}
                        {line.variantName ? (
                          <span className="text-muted-foreground">
                            {" "}
                            · {line.variantName}
                          </span>
                        ) : null}
                      </p>
                      {line.extras.length > 0 ? (
                        <p className="text-xs text-muted-foreground">
                          + {line.extras.map((extra) => extra.name).join(", ")}
                        </p>
                      ) : null}
                      {line.excludedNames.length > 0 ? (
                        <p className="text-xs text-muted-foreground">
                          Sin {line.excludedNames.join(", ")}
                        </p>
                      ) : null}
                      {line.notes ? (
                        <p className="text-xs italic text-muted-foreground">
                          “{line.notes}”
                        </p>
                      ) : null}
                    </div>
                    <span className="text-sm font-medium tabular-nums">
                      {formatMoney(cartLineTotal(line))}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      aria-label={`Quitar una unidad de ${line.productName}`}
                      onClick={() => changeQuantity(line.key, -1)}
                    >
                      <MinusIcon />
                    </Button>
                    <span className="w-8 text-center text-sm tabular-nums">
                      {line.quantity}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      aria-label={`Añadir una unidad de ${line.productName}`}
                      onClick={() => changeQuantity(line.key, 1)}
                    >
                      <PlusIcon />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="ml-auto"
                      aria-label={`Quitar ${line.productName} de la comanda`}
                      onClick={() => removeLine(line.key)}
                    >
                      <Trash2Icon />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <Separator />

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Total (IVA incluido)</span>
            <span className="text-base font-semibold tabular-nums">
              {formatMoney(total)}
            </span>
          </div>

          {activeOrder ? (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Pagado {formatMoney(activeOrder.paidTotal ?? 0)}
                {activeOrder.payments && activeOrder.payments.length > 0
                  ? ` · ${activeOrder.payments.length} pago(s)`
                  : ""}
              </span>
              <span className="font-medium text-foreground tabular-nums">
                Saldo {formatMoney(Math.max(Number(activeOrder.balance ?? 0), 0))}
              </span>
            </div>
          ) : null}

          <PendingOperations />

          {canSend ? (
            <>
              <Button
                onClick={handleSend}
                disabled={sending || cart.length === 0}
              >
                {sending ? <Loader2Icon className="animate-spin" /> : null}
                {offline.isOnline
                  ? orderId
                    ? "Enviar ronda"
                    : "Abrir cuenta y enviar"
                  : "Guardar comanda sin conexión"}
              </Button>
              {!offline.isOnline ? (
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Cocina no recibirá la comanda hasta que vuelva la conexión.
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              Tu rol puede abrir cuentas, pero no enviar comandas a cocina.
            </p>
          )}

          {activeOrder && canRegister ? (
            <>
              <Button
                variant="outline"
                disabled={!offline.isOnline}
                title={
                  offline.isOnline ? undefined : "El cobro requiere conexión"
                }
                onClick={() => setCharging(true)}
              >
                <CreditCardIcon />
                Cobrar cuenta
              </Button>
              {!offline.isOnline ? (
                <p className="text-xs text-muted-foreground">
                  Registrar pagos y cerrar cuentas requiere conexión.
                </p>
              ) : null}
            </>
          ) : null}

          {!canDraft ? (
            <p className="text-xs text-muted-foreground">
              No tienes permiso para abrir cuentas.
            </p>
          ) : null}
        </aside>
      </div>

      {selectedProduct ? (
        <AddItemDialog
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onAdd={(line) => {
            addLine(line)
            setSelectedProduct(null)
          }}
        />
      ) : null}

      {charging && activeOrder ? (
        <ChargeDialog
          order={activeOrder}
          canConfirm={canConfirm}
          canRefund={canRefund}
          onClose={() => setCharging(false)}
          onClosed={() => {
            setCharging(false)
            setOrderId("")
            setCart([])
            router.refresh()
          }}
        />
      ) : null}
    </div>
  )
}

function AddItemDialog({
  product,
  onClose,
  onAdd,
}: {
  product: ProductListItem
  onClose: () => void
  onAdd: (line: Omit<CartLine, "key">) => void
}) {
  const variants = product.variants.filter((variant) => variant.isActive)
  const extras = product.extras.filter((extra) => extra.isActive)
  const exclusions = product.ingredientExclusions ?? []

  const [variantId, setVariantId] = React.useState(variants[0]?.id ?? "")
  const [extraIds, setExtraIds] = React.useState<string[]>([])
  const [excludedIds, setExcludedIds] = React.useState<string[]>([])
  const [quantity, setQuantity] = React.useState(1)
  const [notes, setNotes] = React.useState("")

  const variant = variants.find((candidate) => candidate.id === variantId)
  const selectedExtras = extras.filter((extra) => extraIds.includes(extra.id))
  const unitPrice =
    Number(product.price) +
    Number(variant?.priceAdjust ?? 0) +
    selectedExtras.reduce((sum, extra) => sum + Number(extra.price), 0)

  const toggle = (list: string[], id: string, setter: (next: string[]) => void) => {
    setter(list.includes(id) ? list.filter((value) => value !== id) : [...list, id])
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{product.name}</DialogTitle>
          <DialogDescription>
            Elige variante, extras y lo que el cliente no quiere.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {variants.length > 0 ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="pos-variant">Variante</Label>
              <Select
                value={variantId}
                onValueChange={(value) => setVariantId(value ?? "")}
                items={variants.map((candidate) => ({
                  value: candidate.id,
                  label: `${candidate.name}${
                    Number(candidate.priceAdjust) !== 0
                      ? ` (+${formatMoney(candidate.priceAdjust)})`
                      : ""
                  }`,
                }))}
              >
                <SelectTrigger
                  id="pos-variant"
                  className="w-full"
                  aria-label="Variante"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {variants.map((candidate) => (
                    <SelectItem key={candidate.id} value={candidate.id}>
                      {candidate.name}
                      {Number(candidate.priceAdjust) !== 0
                        ? ` (+${formatMoney(candidate.priceAdjust)})`
                        : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {extras.length > 0 ? (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Extras</span>
              <div className="grid gap-2 sm:grid-cols-2">
                {extras.map((extra) => (
                  <label
                    key={extra.id}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/60 p-2 text-sm"
                  >
                    <Checkbox
                      checked={extraIds.includes(extra.id)}
                      onCheckedChange={() =>
                        toggle(extraIds, extra.id, setExtraIds)
                      }
                      aria-label={extra.name}
                    />
                    <span className="flex-1">{extra.name}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      +{formatMoney(extra.price)}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          {exclusions.length > 0 ? (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Sin…</span>
              <div className="grid gap-2 sm:grid-cols-2">
                {exclusions.map((exclusion) => (
                  <label
                    key={exclusion.id}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/60 p-2 text-sm"
                  >
                    <Checkbox
                      checked={excludedIds.includes(exclusion.ingredient.id)}
                      onCheckedChange={() =>
                        toggle(
                          excludedIds,
                          exclusion.ingredient.id,
                          setExcludedIds
                        )
                      }
                      aria-label={`Sin ${exclusion.ingredient.name}`}
                    />
                    <span>{exclusion.ingredient.name}</span>
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-[120px_minmax(0,1fr)]">
            <div className="flex flex-col gap-2">
              <Label htmlFor="pos-quantity">Cantidad</Label>
              <Input
                id="pos-quantity"
                type="number"
                min={1}
                max={99}
                value={quantity}
                onChange={(event) => {
                  const next = Number(event.target.value)
                  setQuantity(
                    Number.isFinite(next) ? Math.min(99, Math.max(1, next)) : 1
                  )
                }}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="pos-notes">Notas para cocina</Label>
              <Textarea
                id="pos-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Ej. sin azúcar, bien caliente…"
                maxLength={200}
                rows={2}
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Precio unitario</span>
            <span className="font-semibold tabular-nums">
              {formatMoney(unitPrice)}
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() =>
              onAdd({
                productId: product.id,
                productName: product.name,
                variantId: variant?.id,
                variantName: variant?.name,
                unitPrice,
                quantity,
                notes: notes.trim() || undefined,
                extras: selectedExtras.map((extra) => ({
                  id: extra.id,
                  name: extra.name,
                  price: Number(extra.price),
                })),
                excludedIngredientIds: excludedIds,
                excludedNames: exclusions
                  .filter((exclusion) =>
                    excludedIds.includes(exclusion.ingredient.id)
                  )
                  .map((exclusion) => exclusion.ingredient.name),
              })
            }
          >
            Añadir a la comanda
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
