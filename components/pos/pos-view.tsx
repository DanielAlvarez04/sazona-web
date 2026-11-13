"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  CakeIcon,
  CreditCardIcon,
  GroupIcon,
  LayoutGridIcon,
  Loader2Icon,
  MinusIcon,
  PencilLineIcon,
  PlusIcon,
  SearchIcon,
  SoupIcon,
  SparklesIcon,
  Trash2Icon,
  Undo2Icon,
  UserPlusIcon,
  XIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"
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
import { Button } from "@/components/ui/button"
import { ButtonGroup, ButtonGroupText } from "@/components/ui/button-group"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
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
import { ArticleCardVisual, type ArticleCardTextSize } from "@/components/catalog/article-card-visual"
import { useShake } from "@/hooks/use-shake"
import { usePersistentCardColumns } from "@/hooks/use-persistent-card-columns"
import { usePersistentNumber } from "@/hooks/use-persistent-number"
import {
  PROMOTION_TYPE_LABELS,
  formatMoney,
  isItemOptionValueAvailable,
  itemOptionValueName,
  type Category,
  type ItemListItem,
} from "@/lib/catalog"
import {
  addOrderGuest,
  createOrder,
  removeOrderGuest,
  sendRound,
  updateOrderGuest,
  type RoundItemInput,
} from "@/lib/order-actions"
import type { Branch } from "@/lib/branches"
import { API_BASE_URL } from "@/lib/api-base"
import type { CashSessionPayload } from "@/lib/cash"
import type { Menu } from "@/lib/menus"
import type { MercadoPagoPointConfig } from "@/lib/mercadopago"
import type { PosDisplayInfo, PosDisplayState } from "@/lib/pos-display"
import {
  GUEST_TITLES,
  GUEST_TITLE_LABELS,
  ORDER_CHANNEL_LABELS,
  orderLabel,
  type GuestTitle,
  type Order,
  type OrderChannel,
  type OrderGuest,
} from "@/lib/orders"
import { trackEvent } from "@/lib/analytics"
import { jalapenoChipClass } from "@/lib/chips"
import { ACTIVE_FILTER_OUTLINE, cn } from "@/lib/utils"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import { CashSessionActions } from "./cash-session"
import { ChargeDialog } from "./charge-dialog"

const CHANNELS: OrderChannel[] = ["DINE_IN", "COUNTER", "PHONE", "DELIVERY"]

/** Mesas disponibles por ahora (1–25). */
const TABLE_OPTIONS = Array.from({ length: 25 }, (_, index) =>
  String(index + 1)
)

/** Escalas de texto de las cards del catálogo (1 = chico, 4 = extra grande). */
const CARD_TEXT_SCALES = ["sm", "md", "lg", "xl"] as const

interface CartExtra {
  id: string
  name: string
  price: number
}

interface CartOption {
  itemOptionValueId: string
  groupName: string
  name: string
  price: number
}

interface CartLine {
  key: string
  itemId: string
  itemName: string
  variantId?: string
  variantName?: string
  unitPrice: number
  quantity: number
  notes?: string
  extras: CartExtra[]
  options: CartOption[]
  excludedIngredientIds: string[]
  excludedNames: string[]
  /** Cliente (comensal) al que pertenece la línea. `null` = General/Mesa. */
  guestKey?: string | null
}

/** Cliente de la mesa mientras la cuenta es un borrador local. */
interface GuestDraft {
  /** Clave local estable; para clientes ya guardados es su id. */
  key: string
  id?: string
  /** Nombre visible; se actualiza al escribir aunque aún no se guarde. */
  name: string
  /** Último nombre confirmado en el servidor. */
  savedName: string
  title: GuestTitle | null
}

function newGuestKey() {
  return `guest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function cartLineTotal(line: CartLine): number {
  return line.unitPrice * line.quantity
}

function newCartKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/** Solo se pueden convertir líneas sin opciones, extras, notas ni exclusiones. */
function isPlainLine(line: CartLine): boolean {
  return (
    line.extras.length === 0 &&
    line.options.length === 0 &&
    line.excludedIngredientIds.length === 0 &&
    !line.notes?.trim()
  )
}

interface ComboConsumption {
  key: string
  quantity: number
}

interface ComboMatch {
  combo: ItemListItem
  consumption: ComboConsumption[]
  line: CartLine
  componentsTotal: number
  comboPrice: number
}

/**
 * Busca combos cuyos componentes estén disponibles en el carrito. Solo se
 * consideran combos que incluyan la línea que acaba de agregarse/cambiarse.
 */
function findComboMatches(
  cart: CartLine[],
  products: ItemListItem[],
  trigger: { itemId: string; variantId?: string }
): ComboMatch[] {
  const matches: ComboMatch[] = []
  const triggerVariant = trigger.variantId ?? ""

  for (const combo of products) {
    if (!combo.isCombo || !combo.isActive) continue
    if (combo.variants.some((variant) => variant.isActive)) continue
    if ((combo.optionGroups?.length ?? 0) > 0) continue

    const components = combo.comboComponents ?? []
    if (components.length === 0) continue

    const includesTrigger = components.some(
      (component) =>
        component.componentItem.id === trigger.itemId &&
        (component.variant?.id ?? "") === triggerVariant
    )
    if (!includesTrigger) continue

    const consumption: ComboConsumption[] = []
    let componentsTotal = 0
    let complete = true

    for (const component of components) {
      let remaining = component.quantity

      const lines = cart.filter(
        (line) =>
          isPlainLine(line) &&
          line.itemId === component.componentItem.id &&
          (line.variantId ?? "") === (component.variant?.id ?? "")
      )

      for (const line of lines) {
        if (remaining <= 0) break

        const take = Math.min(line.quantity, remaining)
        consumption.push({ key: line.key, quantity: take })
        componentsTotal += line.unitPrice * take
        remaining -= take
      }

      if (remaining > 0) {
        complete = false
        break
      }
    }

    if (!complete) continue

    const comboPrice = Number(combo.price)

    matches.push({
      combo,
      consumption,
      componentsTotal,
      comboPrice,
      line: {
        key: newCartKey(),
        itemId: combo.id,
        itemName: combo.name,
        unitPrice: comboPrice,
        quantity: 1,
        extras: [],
        options: [],
        excludedIngredientIds: [],
        excludedNames: [],
      },
    })
  }

  return matches
}

function consumeComponents(
  cart: CartLine[],
  consumption: ComboConsumption[]
): CartLine[] {
  return cart.flatMap((line) => {
    const take =
      consumption.find((item) => item.key === line.key)?.quantity ?? 0
    if (take === 0) return [line]

    const remaining = line.quantity - take
    return remaining > 0 ? [{ ...line, quantity: remaining }] : []
  })
}

function lineToInput(line: CartLine): RoundItemInput {
  return {
    itemId: line.itemId,
    variantId: line.variantId,
    quantity: line.quantity,
    notes: line.notes,
    extras: line.extras.map((extra) => ({ extraId: extra.id })),
    options:
      line.options.length > 0
        ? line.options.map((option) => ({
            itemOptionValueId: option.itemOptionValueId,
          }))
        : undefined,
    excludedIngredientIds:
      line.excludedIngredientIds.length > 0
        ? line.excludedIngredientIds
        : undefined,
  }
}

/**
 * Tarjeta del catálogo del POS.
 *
 * Está memoizada porque el POS re-renderiza toda la grilla con cada cambio del
 * carrito o del buscador; sin esto se reconcilian cientos de tarjetas aunque
 * solo cambie una.
 */
const PosCatalogCard = React.memo(function PosCatalogCard({
  product,
  selected,
  textSize,
  onOpen,
}: {
  product: ItemListItem
  selected: boolean
  textSize: ArticleCardTextSize
  onOpen: (product: ItemListItem) => void
}) {
  const shakeRef = React.useRef<HTMLDivElement | null>(null)
  useShake(shakeRef, selected)

  const promotion = product.promotions?.find((entry) => entry.isActive)
  const hasBadges = Boolean(product.category || product.isCombo || promotion)

  return (
    <div ref={shakeRef} className={cn(selected && "np-menu-card-shake")}>
      <button
        type="button"
        onClick={() => onOpen(product)}
        aria-label={`Abrir ${product.name}`}
        className="group block w-full rounded-xl text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <ArticleCardVisual
          name={product.name}
          price={formatMoney(product.price)}
          imageUrl={product.imageUrl}
          imageVariants={product.imageVariants}
          isActive={product.isActive}
          selected={selected}
          compact
          textSize={textSize}
          className="transition-shadow group-hover:ring-2 group-hover:ring-ring/60"
          badge={
            hasBadges ? (
              <div className="flex min-w-0 flex-col items-start gap-1">
                {product.category ? (
                  <Badge
                    variant="outline"
                    title={product.category.name}
                    className="max-w-full truncate border-white/35 bg-black/35 text-[10px] text-white backdrop-blur-sm"
                  >
                    {product.category.name}
                  </Badge>
                ) : null}
                {product.isCombo ? (
                  <Badge
                    variant="outline"
                    className="border-white/35 bg-black/35 text-[10px] text-white backdrop-blur-sm"
                  >
                    Combo
                  </Badge>
                ) : null}
                {promotion ? (
                  <Badge
                    variant="outline"
                    className="border-sky-300/50 bg-sky-500/25 text-[10px] text-white backdrop-blur-sm"
                  >
                    {PROMOTION_TYPE_LABELS[promotion.type]}
                  </Badge>
                ) : null}
              </div>
            ) : null
          }
        />
      </button>
    </div>
  )
})

export function PosView({
  products,
  categories,
  orders,
  menus,
  canDraft,
  canSend,
  canRegister,
  canConfirm,
  canRefund,
  branch,
  mercadoPago,
  cash,
  canManageCash,
  displays,
  taxRate,
}: {
  products: ItemListItem[]
  categories: Category[]
  orders: Order[]
  menus: Menu[]
  canDraft: boolean
  canSend: boolean
  canRegister: boolean
  canConfirm: boolean
  canRefund: boolean
  /** Sucursal activa; `null` = vista consolidada. */
  branch: Branch | null
  /** Terminales Point disponibles para cobrar. */
  mercadoPago: MercadoPagoPointConfig
  /** Turno de caja abierto de la sucursal. */
  cash: CashSessionPayload
  /** Abrir/cerrar caja y movimientos (ADMIN/CASHIER). */
  canManageCash: boolean
  /** Pantallas de cliente del negocio. */
  displays: PosDisplayInfo[]
  /** IVA del negocio; se usa cuando el artículo no define una tasa propia. */
  taxRate: string
}) {
  const router = useRouter()
  const offline = useOfflineSync()

  const [search, setSearch] = React.useState("")
  // El filtrado se hace con el valor diferido: escribir en el buscador no
  // bloquea el pintado de la grilla.
  const deferredSearch = React.useDeferredValue(search)
  const [categoryId, setCategoryId] = React.useState("")
  const [menuId, setMenuId] = React.useState(
    () => menus.find((menu) => menu.isGlobal)?.id ?? menus[0]?.id ?? ""
  )
  const [cardColumns, setCardColumns] = usePersistentCardColumns(
    "pos-card-columns",
    4,
    4,
    7
  )
  const [cardTextSize, setCardTextSize] = usePersistentNumber(
    "pos-card-text-size",
    3,
    1,
    4
  )
  const cardTextScale = CARD_TEXT_SCALES[cardTextSize - 1] ?? "md"
  const [cart, setCart] = React.useState<CartLine[]>([])
  const [selectedProduct, setSelectedProduct] =
    React.useState<ItemListItem | null>(null)
  const [pendingProductId, setPendingProductId] = React.useState<string | null>(
    null
  )
  const [charging, setCharging] = React.useState(false)

  const [comboNotice, setComboNotice] = React.useState<{
    message: string
    undo: () => void
  } | null>(null)
  const [comboUndoAvailable, setComboUndoAvailable] = React.useState(false)
  const comboUndoTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const [comboConflict, setComboConflict] = React.useState<{
    cart: CartLine[]
    matches: ComboMatch[]
  } | null>(null)

  const [orderId, setOrderId] = React.useState("")
  const [channel, setChannel] = React.useState<OrderChannel>("DINE_IN")
  const [tableNumber, setTableNumber] = React.useState("1")
  const [customerName, setCustomerName] = React.useState("")
  const [customerTitle, setCustomerTitle] = React.useState<GuestTitle | null>(
    null
  )
  const [customerPhone, setCustomerPhone] = React.useState("")
  const [deliveryAddress, setDeliveryAddress] = React.useState("")
  const [deliveryFee, setDeliveryFee] = React.useState("0")
  const [guests, setGuests] = React.useState<GuestDraft[]>([])
  const [partySize, setPartySize] = React.useState(1)
  const [partySizeDraft, setPartySizeDraft] = React.useState("1")
  const [activeGuestKey, setActiveGuestKey] = React.useState<string | null>(null)
  const [guestRemoving, setGuestRemoving] = React.useState<GuestDraft | null>(
    null
  )
  const [guestBusy, setGuestBusy] = React.useState(false)
  const [displayId, setDisplayId] = React.useState(displays[0]?.id ?? "")
  const [displayState, setDisplayState] =
    React.useState<PosDisplayState | null>(null)
  const displaySession = React.useRef<string | null>(null)
  const [sending, setSending] = React.useState(false)

  const activeOrder = orders.find((order) => order.id === orderId) ?? null
  const activeGuest =
    activeGuestKey === null
      ? null
      : guests.find((guest) => guest.key === activeGuestKey) ?? null
  const isDineIn = activeOrder
    ? (activeOrder.channel ?? "DINE_IN") === "DINE_IN"
    : channel === "DINE_IN"
  const displayChannel = activeOrder?.channel ?? channel
  const total = cart.reduce((sum, line) => sum + cartLineTotal(line), 0)

  /**
   * El precio del catálogo es final (IVA incluido), así que el IVA se extrae
   * de cada línea y el subtotal es el neto. Se redondea por línea igual que
   * la API al enviar la ronda.
   */
  const taxBreakdown = React.useMemo(() => {
    const fallbackRate = Number(taxRate) || 0
    const rateByItem = new Map(
      products.map((product) => [
        product.id,
        Number(product.taxRate ?? fallbackRate) || 0,
      ])
    )
    let tax = 0

    for (const line of cart) {
      const rate = rateByItem.get(line.itemId) ?? fallbackRate
      const gross = cartLineTotal(line)

      if (rate > 0) {
        tax += Math.round((gross - gross / (1 + rate)) * 100) / 100
      }
    }

    tax = Math.round(tax * 100) / 100

    return { subtotal: Math.round((total - tax) * 100) / 100, tax }
  }, [cart, products, taxRate, total])

  // Sincroniza los clientes con la cuenta seleccionada. En un borrador nuevo
  // siempre existe al menos Cliente 1.
  /* eslint-disable react-hooks/set-state-in-effect */
  React.useEffect(() => {
    if (!activeOrder) {
      setGuests((current) =>
        current.length > 0
          ? current
          : [{ key: newGuestKey(), name: "", savedName: "", title: null }]
      )
      setPartySize((current) => Math.max(1, current))
      return
    }

    const serverGuests = activeOrder.guests ?? []

    setChannel(activeOrder.channel ?? "DINE_IN")
    setTableNumber(activeOrder.tableNumber ?? "1")
    setGuests(
      serverGuests.map((guest) => ({
        key: guest.id,
        id: guest.id,
        name: guest.name,
        savedName: guest.name,
        title: guest.title,
      }))
    )
    setPartySize(
      Math.min(20, activeOrder.partySize ?? Math.max(1, serverGuests.length))
    )
    setActiveGuestKey((current) =>
      current && serverGuests.some((guest) => guest.id === current)
        ? current
        : null
    )

    if ((activeOrder.channel ?? "DINE_IN") !== "DINE_IN") {
      setCustomerTitle(serverGuests[0]?.title ?? null)
    }
  }, [activeOrder])
  /* eslint-enable react-hooks/set-state-in-effect */

  /* eslint-disable react-hooks/set-state-in-effect */
  React.useEffect(() => {
    setPartySizeDraft(String(partySize))
  }, [partySize])
  /* eslint-enable react-hooks/set-state-in-effect */

  // Con un solo cliente en mesa no se muestra «General»: ese cliente queda
  // activo. En mostrador los artículos van siempre a General.
  /* eslint-disable react-hooks/set-state-in-effect */
  React.useEffect(() => {
    if (!isDineIn) {
      setActiveGuestKey((current) => (current === null ? current : null))
      return
    }

    if (guests.length !== 1) return

    const onlyKey = guests[0].key

    setActiveGuestKey((current) => (current === onlyKey ? current : onlyKey))
  }, [guests, isDineIn])
  /* eslint-enable react-hooks/set-state-in-effect */

  // Publica el carrito en la pantalla de cliente (debounce corto).
  React.useEffect(() => {
    if (!displayId) return

    const timer = setTimeout(() => {
      if (cart.length > 0 && !displaySession.current) {
        displaySession.current = crypto.randomUUID()
      }

      const sessionKey =
        cart.length > 0 ? displaySession.current ?? "idle" : "idle"

      void fetch(`${API_BASE_URL}/pos/displays/${displayId}/state`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionKey,
          items: cart.map((line) => ({
            name: line.variantName
              ? `${line.itemName} · ${line.variantName}`
              : line.itemName,
            quantity: line.quantity,
            price: line.unitPrice,
          })),
          total,
          customerName: customerName.trim() || undefined,
        }),
      }).catch(() => {
        // La pantalla es auxiliar: si falla no se interrumpe la venta.
      })
    }, 350)

    return () => clearTimeout(timer)
  }, [displayId, cart, total, customerName])

  // Lee la propina/confirmación que el cliente eligió en la pantalla.
  React.useEffect(() => {
    if (!displayId) return

    let cancelled = false

    const load = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/pos/displays/${displayId}/state`,
          { credentials: "include", cache: "no-store" }
        )

        if (!response.ok) return

        const state = (await response.json()) as PosDisplayState | null
        if (!cancelled) setDisplayState(state)
      } catch {
        // Silencioso: la caja sigue funcionando sin pantalla.
      }
    }

    void load()
    const timer = setInterval(() => void load(), 3000)

    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [displayId])

  React.useEffect(() => {
    return () => {
      if (comboUndoTimer.current) clearTimeout(comboUndoTimer.current)
    }
  }, [])

  function dismissComboNotice() {
    setComboNotice(null)
    setComboUndoAvailable(false)
    if (comboUndoTimer.current) clearTimeout(comboUndoTimer.current)
  }

  function showComboNotice(message: string, undo: () => void) {
    if (comboUndoTimer.current) clearTimeout(comboUndoTimer.current)

    setComboNotice({
      message,
      undo: () => {
        undo()
        dismissComboNotice()
      },
    })
    setComboUndoAvailable(true)
    comboUndoTimer.current = setTimeout(() => {
      setComboUndoAvailable(false)
    }, 3000)
  }

  function applyComboMatch(match: ComboMatch, previousCart: CartLine[]) {
    const nextCart = [
      ...consumeComponents(previousCart, match.consumption),
      match.line,
    ]
    setCart(nextCart)

    const restoredLines = match.consumption.flatMap((item) => {
      const original = previousCart.find((line) => line.key === item.key)
      return original ? [{ ...original, quantity: item.quantity }] : []
    })

    const difference = match.componentsTotal - match.comboPrice
    const message =
      difference > 0
        ? `Se aplicó el combo «${match.combo.name}»: ${formatMoney(
            match.comboPrice
          )} en lugar de ${formatMoney(match.componentsTotal)}.`
        : `Se aplicó el combo «${match.combo.name}» por ${formatMoney(
            match.comboPrice
          )}.`

    showComboNotice(message, () => {
      setCart((current) => {
        let next = current.filter((line) => line.key !== match.line.key)

        for (const restoredLine of restoredLines) {
          const existing = next.find((line) => line.key === restoredLine.key)

          if (existing) {
            next = next.map((line) =>
              line.key === restoredLine.key
                ? { ...line, quantity: line.quantity + restoredLine.quantity }
                : line
            )
          } else {
            next = [...next, restoredLine]
          }
        }

        return next
      })
    })
  }

  function runComboDetection(
    nextCart: CartLine[],
    trigger: { itemId: string; variantId?: string }
  ) {
    const matches = findComboMatches(nextCart, products, trigger)

    if (matches.length === 0) return
    if (matches.length === 1) {
      applyComboMatch(matches[0], nextCart)
      return
    }

    setComboConflict({ cart: nextCart, matches })
  }

  function chooseComboConflict(match: ComboMatch) {
    if (!comboConflict) return

    const previousCart = comboConflict.cart
    setComboConflict(null)
    applyComboMatch(match, previousCart)
  }

  const filtered = React.useMemo(() => {
    const needle = deferredSearch.trim().toLowerCase()
    const activeMenu = menus.find((menu) => menu.id === menuId)

    return products.filter((product) => {
      if (categoryId && product.category?.id !== categoryId) return false
      // El menú global contiene todo el catálogo: no hace falta filtrar.
      if (
        activeMenu &&
        !activeMenu.isGlobal &&
        !(product.menus ?? []).some(
          (menu) => menu.id === menuId && menu.isActive
        )
      ) {
        return false
      }
      if (!needle) return true
      return (
        product.name.toLowerCase().includes(needle) ||
        (product.sku ?? "").toLowerCase().includes(needle)
      )
    })
  }, [products, deferredSearch, categoryId, menuId, menus])

  const selectedMenu = menus.find((menu) => menu.id === menuId) ?? null

  const selectedItemIds = React.useMemo(
    () =>
      new Set(
        cart
          .filter((line) => (line.guestKey ?? null) === activeGuestKey)
          .map((line) => line.itemId)
      ),
    [cart, activeGuestKey]
  )

  // Identidad estable para que `PosCatalogCard` memoizada no se re-renderice
  // con cada cambio del carrito.
  const handleOpenProduct = React.useCallback((product: ItemListItem) => {
    setPendingProductId(product.id)
    setSelectedProduct(product)
  }, [])

  const renderProductCard = (product: ItemListItem) => {
    const selected =
      selectedItemIds.has(product.id) || pendingProductId === product.id

    return (
      <PosCatalogCard
        key={product.id}
        product={product}
        selected={selected}
        textSize={cardTextScale}
        onOpen={handleOpenProduct}
      />
    )
  }

  /**
   * Reemplaza las líneas del artículo para los clientes configurados en el
   * diálogo. Las presentaciones con cantidad 0 desaparecen; las demás se
   * crean o actualizan.
   */
  const applyItemOrder = (
    itemId: string,
    configurations: Array<{
      guestKey: string | null
      lines: Array<Omit<CartLine, "key">>
    }>
  ) => {
    if (configurations.length === 0) return

    const guestKeys = new Set(
      configurations.map((configuration) => configuration.guestKey)
    )
    const remaining = cart.filter(
      (line) =>
        !(line.itemId === itemId && guestKeys.has(line.guestKey ?? null))
    )
    const nextLines = configurations.flatMap((configuration) =>
      configuration.lines.map((line) => ({
        ...line,
        key: newCartKey(),
        guestKey: configuration.guestKey,
      }))
    )
    const nextCart = [...remaining, ...nextLines]
    setCart(nextCart)

    const trigger = nextLines.find(isPlainLine)

    if (trigger) {
      runComboDetection(nextCart, {
        itemId: trigger.itemId,
        variantId: trigger.variantId,
      })
    }

    for (const line of nextLines) {
      const position = filtered.findIndex(
        (product) => product.id === line.itemId
      )

      trackEvent({
        name: "pos.item_added",
        itemId: line.itemId,
        menuId: menuId || undefined,
        quantity: line.quantity,
        metadata: {
          position: position >= 0 ? position : null,
          categoryId: categoryId || null,
        },
      })
    }
  }

  const changeQuantity = (key: string, delta: number) => {
    const line = cart.find((candidate) => candidate.key === key)
    if (!line) return

    const quantity = line.quantity + delta
    const nextCart =
      quantity <= 0
        ? cart.filter((candidate) => candidate.key !== key)
        : cart.map((candidate) =>
            candidate.key === key ? { ...candidate, quantity } : candidate
          )

    setCart(nextCart)

    if (delta > 0 && isPlainLine(line)) {
      runComboDetection(nextCart, {
        itemId: line.itemId,
        variantId: line.variantId,
      })
    }
  }

  const removeLine = (key: string) => {
    setCart((current) => current.filter((line) => line.key !== key))
  }

  const selectOrder = (value: string) => {
    setOrderId(value)
    setCart([])
    setActiveGuestKey(null)
    setPendingProductId(null)

    if (!value) {
      setGuests([{ key: newGuestKey(), name: "", savedName: "", title: null }])
      setPartySize(1)
      setChannel("DINE_IN")
      setTableNumber("1")
      setCustomerName("")
      setCustomerTitle(null)
      setCustomerPhone("")
      setDeliveryAddress("")
      setDeliveryFee("0")
    }

    dismissComboNotice()
    setComboConflict(null)
  }

  const handleSend = async () => {
    if (cart.length === 0) {
      toast.error("Añade al menos un artículo")
      return
    }

    if (channel === "DINE_IN" && !tableNumber.trim()) {
      toast.error("Escribe el número de mesa")
      return
    }

    if (
      (channel === "PHONE" || channel === "DELIVERY") &&
      !customerPhone.trim()
    ) {
      toast.error("Escribe el teléfono del cliente")
      return
    }

    if (channel === "DELIVERY" && !deliveryAddress.trim()) {
      toast.error("Escribe la dirección de entrega")
      return
    }

    const draftLabel =
      channel === "DINE_IN"
        ? tableNumber.trim()
          ? `Mesa ${tableNumber.trim()}`
          : "Sin mesa"
        : ORDER_CHANNEL_LABELS[channel]

    const items = cart.map(lineToInput)
    const lineLabel = `${cart.length} línea${cart.length === 1 ? "" : "s"}`
    const label = orderId
      ? `${activeOrder ? orderLabel(activeOrder) : "Cuenta abierta"} · ${lineLabel}`
      : `${draftLabel} · ${lineLabel}`

    // Claves estables: si el envío falla por red después de que el servidor lo
    // procesó, el reintento devuelve la operación existente en vez de duplicar.
    const orderKey = crypto.randomUUID()
    const roundKey = crypto.randomUUID()

    const resetDraft = () => {
      setCart([])
      setChannel("DINE_IN")
      setTableNumber("1")
      setCustomerName("")
      setCustomerTitle(null)
      setCustomerPhone("")
      setDeliveryAddress("")
      setDeliveryFee("0")
      setGuests([{ key: newGuestKey(), name: "", savedName: "", title: null }])
      setPartySize(1)
      setActiveGuestKey(null)
      setPendingProductId(null)
      displaySession.current = null
      dismissComboNotice()
      setComboConflict(null)
    }

    // Guarda la comanda en IndexedDB. Nunca se anuncia como recibida por
    // cocina: eso solo ocurre cuando el servidor confirma el envío.
    const queueOffline = async (targetOrderId?: string) => {
      try {
        await offline.enqueueRound({
          orderId: targetOrderId,
          tableNumber:
            channel === "DINE_IN"
              ? tableNumber.trim() || undefined
              : undefined,
          isTakeaway: channel !== "DINE_IN",
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
      let createdGuests: OrderGuest[] = []

      if (!targetId) {
        const created = await createOrder({
          channel,
          tableNumber:
            channel === "DINE_IN"
              ? tableNumber.trim() || "1"
              : undefined,
          partySize: channel === "DINE_IN" ? partySize : 1,
          customerName: customerName.trim() || undefined,
          customerPhone: customerPhone.trim() || undefined,
          deliveryAddress:
            channel === "DELIVERY"
              ? deliveryAddress.trim() || undefined
              : undefined,
          deliveryFee:
            channel === "DELIVERY" ? Number(deliveryFee) || 0 : 0,
          guests:
            channel === "DINE_IN"
              ? guests.map((guest) => ({
                  name: guest.name.trim() || undefined,
                  title: guest.title,
                }))
              : customerName.trim() || customerTitle
                ? [
                    {
                      name: customerName.trim() || undefined,
                      title: customerTitle,
                    },
                  ]
                : undefined,
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
        createdGuests = created.data.guests ?? []
        setOrderId(targetId)
      }

      const createdGuestByKey = new Map(
        createdGuests.map((guest, index) => [guests[index]?.key, guest.id])
      )

      // Al crear la cuenta, las claves locales de los clientes pasan a ser ids
      // reales; así las siguientes rondas no envían claves inexistentes.
      if (createdGuests.length > 0) {
        const keyToId = new Map(
          guests.flatMap((guest, index) => {
            const created = createdGuests[index]

            return created ? [[guest.key, created.id] as const] : []
          })
        )

        setGuests(
          createdGuests.map((guest) => ({
            key: guest.id,
            id: guest.id,
            name: guest.name,
            savedName: guest.name,
            title: guest.title,
          }))
        )
        setCart((current) =>
          current.map((line) => {
            const nextId = line.guestKey
              ? keyToId.get(line.guestKey)
              : undefined

            return nextId ? { ...line, guestKey: nextId } : line
          })
        )
        setActiveGuestKey((current) => (current && keyToId.get(current)) || null)
      }

      const knownGuestIds = new Set([
        ...(activeOrder?.guests ?? []).map((guest) => guest.id),
        ...createdGuests.map((guest) => guest.id),
      ])

      const itemsWithGuests = cart.map((line) => {
        const input = lineToInput(line)

        // En mostrador/teléfono/domicilio no se reparte por cliente.
        if (!line.guestKey || displayChannel !== "DINE_IN") return input

        // Nunca se envía una clave local (`guest-…`): si el cliente todavía no
        // existe en la cuenta, la línea va a General.
        const guestId =
          createdGuestByKey.get(line.guestKey) ??
          (knownGuestIds.has(line.guestKey) ? line.guestKey : null)

        return guestId ? { ...input, guestId } : input
      })

      const result = await sendRound(targetId, {
        items: itemsWithGuests,
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

  /** Etiqueta visible de un cliente según su posición. */
  const guestDisplayName = (guest: GuestDraft, index: number) =>
    guest.name.trim() || `Cliente ${index + 1}`

  /** Etiqueta del cliente asignado a una línea de la comanda. */
  const lineGuestLabel = (line: CartLine) => {
    if (!line.guestKey) return null

    const index = guests.findIndex((guest) => guest.key === line.guestKey)
    return index >= 0 ? guestDisplayName(guests[index], index) : null
  }

  const setGuestNameLocal = (guest: GuestDraft, name: string) =>
    setGuests((current) =>
      current.map((entry) =>
        entry.key === guest.key ? { ...entry, name } : entry
      )
    )

  const updateGuest = async (
    guest: GuestDraft,
    changes: { name?: string; title?: GuestTitle | null }
  ) => {
    setGuests((current) =>
      current.map((entry) =>
        entry.key === guest.key ? { ...entry, ...changes } : entry
      )
    )

    if (!orderId || !guest.id) {
      if (changes.name !== undefined) {
        const savedName = changes.name

        setGuests((current) =>
          current.map((entry) =>
            entry.key === guest.key ? { ...entry, savedName } : entry
          )
        )
      }

      return
    }

    setGuestBusy(true)

    try {
      const result = await updateOrderGuest(orderId, guest.id, changes)

      if (!result.ok) {
        toast.error(result.message ?? "No se pudo actualizar el cliente")
        router.refresh()
        return
      }

      if (changes.name !== undefined) {
        const savedName = changes.name

        setGuests((current) =>
          current.map((entry) =>
            entry.key === guest.key ? { ...entry, savedName } : entry
          )
        )
      }
    } finally {
      setGuestBusy(false)
    }
  }

  /** Ajusta el número de clientes y sincroniza los chips. */
  const changePartySize = async (next: number) => {
    const target = Math.min(20, Math.max(1, next))

    if (target === partySize) return

    if (target > partySize) {
      const additions = target - partySize

      if (orderId) {
        setGuestBusy(true)

        try {
          for (let index = 0; index < additions; index += 1) {
            const result = await addOrderGuest(orderId, {})

            if (!result.ok || !result.data) {
              toast.error(result.message ?? "No se pudo añadir el cliente")
              break
            }

            const created = result.data

            setGuests((current) => [
              ...current,
              {
                key: created.id,
                id: created.id,
                name: created.name,
                savedName: created.name,
                title: created.title,
              },
            ])
          }

          router.refresh()
        } finally {
          setGuestBusy(false)
        }
      } else {
        setGuests((current) => [
          ...current,
          ...Array.from({ length: additions }, () => ({
            key: newGuestKey(),
            name: "",
            savedName: "",
            title: null,
          })),
        ])
      }

      setPartySize(target)
      return
    }

    const removals = partySize - target
    const removed = guests.slice(-removals)

    if (orderId) {
      setGuestBusy(true)

      try {
        for (const guest of removed) {
          if (!guest.id) continue

          const result = await removeOrderGuest(orderId, guest.id)

          if (!result.ok) {
            toast.error(result.message ?? "No se pudo quitar el cliente")
            break
          }
        }

        router.refresh()
      } finally {
        setGuestBusy(false)
      }
    }

    // Las líneas de los clientes eliminados pasan a General/Mesa.
    setCart((current) =>
      current.map((line) =>
        removed.some((guest) => guest.key === line.guestKey)
          ? { ...line, guestKey: null }
          : line
      )
    )

    setGuests((current) => current.slice(0, target))
    setPartySize(target)

    if (activeGuestKey && removed.some((guest) => guest.key === activeGuestKey)) {
      setActiveGuestKey(null)
    }
  }

  const requestRemoveGuest = (guest: GuestDraft) => {
    if (partySize <= 1) {
      toast.error("La mesa debe tener al menos un cliente")
      return
    }

    setGuestRemoving(guest)
  }

  const applyGuestRemove = async () => {
    if (!guestRemoving) return

    setGuestBusy(true)

    try {
      if (orderId && guestRemoving.id) {
        const result = await removeOrderGuest(orderId, guestRemoving.id)

        if (!result.ok) {
          toast.error(result.message ?? "No se pudo quitar el cliente")
          return
        }

        router.refresh()
      }

      const removedKey = guestRemoving.key

      setCart((current) =>
        current.map((line) =>
          line.guestKey === removedKey ? { ...line, guestKey: null } : line
        )
      )
      setGuests((current) =>
        current.filter((guest) => guest.key !== removedKey)
      )
      setPartySize((current) => Math.max(1, current - 1))

      if (activeGuestKey === removedKey) setActiveGuestKey(null)

      setGuestRemoving(null)
    } finally {
      setGuestBusy(false)
    }
  }

  return (
    <div className="@container/main flex flex-1 flex-col gap-4 px-4 py-6 lg:px-6">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <div className="relative w-full sm:w-56">
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
                value={menuId}
                onValueChange={(value) => {
                  const next = value ?? ""

                  if (!next) return

                  setMenuId(next)
                  trackEvent({
                    name: "pos.menu_filtered",
                    menuId: next,
                  })
                }}
                items={menus.map((menu) => ({
                  value: menu.id,
                  label: `${menu.name}${
                    menu.isAvailableNow ? "" : " · fuera de horario"
                  }`,
                }))}
              >
                <SelectTrigger
                  className="w-full sm:w-44"
                  aria-label="Filtrar por menú"
                >
                  <SelectValue placeholder="Menú" />
                </SelectTrigger>
                <SelectContent>
                  {menus.map((menu) => (
                    <SelectItem key={menu.id} value={menu.id}>
                      {menu.name}
                      {menu.isAvailableNow ? "" : " · fuera de horario"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

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
                  data-active={Boolean(categoryId)}
                  className={cn(
                    "w-full sm:w-44",
                    categoryId && ACTIVE_FILTER_OUTLINE
                  )}
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

            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Popover>
                <PopoverTrigger
                  render={
                    <Button type="button" variant="outline" size="sm">
                      <LayoutGridIcon />
                      Vista
                    </Button>
                  }
                />
                <PopoverContent align="end" className="w-72">
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1.5">
                      <span className="text-xs font-medium text-muted-foreground">
                        Tamaño de tarjetas
                      </span>
                      <ButtonGroup aria-label="Tamaño de las tarjetas">
                        <ButtonGroupText className="h-8 flex-1 px-2 text-xs">
                          Tamaño
                        </ButtonGroupText>
                        {/* «−» achica las tarjetas repartiendo más por fila; «+» las agranda. */}
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          aria-label="Tarjetas más pequeñas"
                          title="Tarjetas más pequeñas"
                          disabled={cardColumns >= 7}
                          onClick={() =>
                            setCardColumns((current) =>
                              Math.min(7, current + 1)
                            )
                          }
                        >
                          <MinusIcon className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          aria-label="Tarjetas más grandes"
                          title="Tarjetas más grandes"
                          disabled={cardColumns <= 4}
                          onClick={() =>
                            setCardColumns((current) =>
                              Math.max(4, current - 1)
                            )
                          }
                        >
                          <PlusIcon className="size-4" />
                        </Button>
                      </ButtonGroup>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <span className="text-xs font-medium text-muted-foreground">
                        Tamaño del texto
                      </span>
                      <ButtonGroup aria-label="Tamaño del texto de las tarjetas">
                        <ButtonGroupText className="h-8 flex-1 px-2 text-xs">
                          Texto
                        </ButtonGroupText>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          aria-label="Texto más pequeño"
                          title="Texto más pequeño"
                          disabled={cardTextSize <= 1}
                          onClick={() =>
                            setCardTextSize((current) =>
                              Math.max(1, current - 1)
                            )
                          }
                        >
                          <MinusIcon className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          aria-label="Texto más grande"
                          title="Texto más grande"
                          disabled={cardTextSize >= 4}
                          onClick={() =>
                            setCardTextSize((current) =>
                              Math.min(4, current + 1)
                            )
                          }
                        >
                          <PlusIcon className="size-4" />
                        </Button>
                      </ButtonGroup>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              <CashSessionActions
                session={cash.session}
                summary={cash.summary}
                canManage={canManageCash}
              />
            </div>
          </div>

          {selectedMenu && !selectedMenu.isAvailableNow ? (
            <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
              «{selectedMenu.name}» está fuera de horario. Puedes consultarlo,
              pero revisa la disponibilidad antes de enviar la comanda.
            </p>
          ) : null}

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-14 text-center text-sm text-muted-foreground">
              <SoupIcon className="size-8" />
              No hay artículos que coincidan con el filtro.
            </div>
          ) : (
            <div
              className="grid grid-cols-2 gap-2 md:grid-cols-[repeat(var(--np-pos-card-columns,4),minmax(0,1fr))]"
              style={
                {
                  "--np-pos-card-columns": cardColumns,
                } as React.CSSProperties
              }
            >
              {filtered.map(renderProductCard)}
            </div>
          )}
        </div>

        <Card className="flex h-fit flex-col gap-3 border p-4 ring-0 lg:sticky lg:top-4">
          <CardHeader className="flex flex-row items-center justify-between gap-2 p-0">
            <CardTitle className="flex items-center gap-2">
              <PencilLineIcon className="size-4" />
              Comanda
            </CardTitle>
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
              <SelectTrigger className="w-44" aria-label="Cuentas">
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
          </CardHeader>

          <CardContent className="flex flex-col gap-3 p-0">
            <div className="flex flex-wrap gap-1.5">
              {CHANNELS.map((value) => {
                const disabled =
                  value === "PHONE" ||
                  value === "DELIVERY" ||
                  Boolean(activeOrder)
                const active = displayChannel === value

                return (
                  <Button
                    key={value}
                    type="button"
                    variant="outline"
                    size="sm"
                    className={jalapenoChipClass(active)}
                    aria-pressed={active}
                    disabled={disabled}
                    title={
                      value === "PHONE" || value === "DELIVERY"
                        ? "Disponible próximamente"
                        : undefined
                    }
                    onClick={() => setChannel(value)}
                  >
                    {ORDER_CHANNEL_LABELS[value]}
                  </Button>
                )
              })}
            </div>

            {isDineIn ? (
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
                  <div className="flex flex-col gap-2">
                    <Select
                      value={activeOrder?.tableNumber ?? tableNumber}
                      onValueChange={(value) => setTableNumber(value ?? "1")}
                      disabled={Boolean(activeOrder)}
                      items={TABLE_OPTIONS.map((value) => ({
                        value,
                        label: `Mesa ${value}`,
                      }))}
                    >
                      <SelectTrigger id="pos-table" className="w-full" aria-label="Mesa">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TABLE_OPTIONS.map((value) => (
                          <SelectItem key={value} value={value}>
                            Mesa {value}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label>Clientes</Label>
                    <ButtonGroup aria-label="Número de clientes">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        aria-label="Quitar un cliente"
                        disabled={partySize <= 1 || guestBusy}
                        onClick={() => void changePartySize(partySize - 1)}
                      >
                        <MinusIcon />
                      </Button>
                      <Input
                        aria-label="Número de clientes"
                        inputMode="numeric"
                        className="h-8 w-12 min-w-12 text-center tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                        value={partySizeDraft}
                        onChange={(event) =>
                          setPartySizeDraft(
                            event.target.value.replace(/\D/g, "").slice(0, 2)
                          )
                        }
                        onBlur={() =>
                          void changePartySize(Number(partySizeDraft) || 1)
                        }
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault()
                            event.currentTarget.blur()
                          }
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        aria-label="Añadir un cliente"
                        disabled={partySize >= 20 || guestBusy}
                        onClick={() => void changePartySize(partySize + 1)}
                      >
                        <PlusIcon />
                      </Button>
                    </ButtonGroup>
                  </div>
                </div>

                <fieldset className="min-w-0 rounded-lg border border-dashed px-2 pt-1 pb-2">
                  <legend className="px-1 text-[10px] font-medium text-muted-foreground">
                    Orden para
                  </legend>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {guests.length > 1 ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className={jalapenoChipClass(activeGuestKey === null)}
                        aria-pressed={activeGuestKey === null}
                        onClick={() => setActiveGuestKey(null)}
                      >
                        General
                      </Button>
                    ) : null}

                    {guests.map((guest, index) => (
                      <div key={guest.key} className="flex items-center">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className={cn(
                            jalapenoChipClass(activeGuestKey === guest.key),
                            "max-w-40 rounded-r-none"
                          )}
                          aria-pressed={activeGuestKey === guest.key}
                          onClick={() => setActiveGuestKey(guest.key)}
                        >
                          <span className="truncate">
                            {guestDisplayName(guest, index)}
                          </span>
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="h-7 rounded-l-none rounded-r-full border border-destructive/40 px-2"
                          aria-label={`Quitar ${guestDisplayName(guest, index)}`}
                          disabled={partySize <= 1 || guestBusy}
                          onClick={() => requestRemoveGuest(guest)}
                        >
                          <XIcon className="size-3.5" />
                        </Button>
                      </div>
                    ))}

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1 rounded-full border-dashed px-2.5 text-xs text-muted-foreground"
                      disabled={partySize >= 20 || guestBusy}
                      onClick={() => void changePartySize(partySize + 1)}
                    >
                      <UserPlusIcon className="size-3.5" />
                      Añadir cliente
                    </Button>
                  </div>

                  {activeGuest ? (
                    <div className="mt-2 flex flex-col gap-2 border-t pt-2">
                      <div className="flex items-end gap-2">
                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                          <Label htmlFor="pos-guest-name" className="text-xs">
                            Nombre
                          </Label>
                          <GuestNameField
                            key={activeGuest.key}
                            guest={activeGuest}
                            placeholder={`Cliente ${
                              guests.findIndex(
                                (guest) => guest.key === activeGuest.key
                              ) + 1
                            }`}
                            disabled={guestBusy}
                            onChange={(name) =>
                              setGuestNameLocal(activeGuest, name)
                            }
                            onCommit={(name) =>
                              void updateGuest(activeGuest, { name })
                            }
                          />
                        </div>

                        <AgeRangePopover
                          value={activeGuest.title}
                          disabled={guestBusy}
                          onChange={(title) =>
                            void updateGuest(activeGuest, { title })
                          }
                        />
                      </div>
                    </div>
                  ) : null}
                </fieldset>
              </div>
            ) : null}

            {!activeOrder && !isDineIn && displayChannel === "COUNTER" ? (
              <div className="flex items-end gap-2">
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <Label htmlFor="pos-customer">
                    Cliente{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      (opcional)
                    </span>
                  </Label>
                  <Input
                    id="pos-customer"
                    value={customerName}
                    onChange={(event) => setCustomerName(event.target.value)}
                    maxLength={120}
                    placeholder="Nombre"
                  />
                </div>
                <AgeRangePopover
                  value={customerTitle}
                  onChange={setCustomerTitle}
                />
              </div>
            ) : null}

            {displays.length > 0 ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor="pos-display">Pantalla de cliente</Label>
                <div className="flex items-center gap-2">
                  <Select
                    value={displayId || "none"}
                    onValueChange={(value) =>
                      setDisplayId(value === "none" ? "" : (value ?? ""))
                    }
                    items={[
                      { value: "none", label: "Sin pantalla" },
                      ...displays.map((display) => ({
                        value: display.id,
                        label: display.name,
                      })),
                    ]}
                  >
                    <SelectTrigger id="pos-display" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin pantalla</SelectItem>
                      {displays.map((display) => (
                        <SelectItem key={display.id} value={display.id}>
                          {display.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {displayState?.confirmedAt ? (
                    <Badge variant="secondary">Confirmó</Badge>
                  ) : null}
                </div>
              </div>
            ) : null}

            <Separator />

          {comboNotice ? (
            <Alert className="border-chart-3/50! bg-chart-3/10! text-chart-3!">
              <SparklesIcon />
              <AlertTitle>Precio de combo ajustado</AlertTitle>
              <AlertDescription className="text-chart-3/80!">
                {comboNotice.message}
              </AlertDescription>
              {comboUndoAvailable ? (
                <AlertAction>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-chart-3 hover:bg-chart-3/15 hover:text-chart-3"
                    onClick={comboNotice.undo}
                  >
                    <Undo2Icon />
                    Revertir
                  </Button>
                </AlertAction>
              ) : null}
            </Alert>
          ) : null}

          {cart.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Elige artículos del catálogo para armar la ronda.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {cart.map((line, index) => (
                <li
                  key={line.key}
                  className={cn(
                    "flex flex-col gap-1",
                    index > 0 && "border-t border-dashed pt-2"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {line.itemName}
                        {lineGuestLabel(line) ? (
                          <span className="ml-1.5 rounded-full border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                            {lineGuestLabel(line)}
                          </span>
                        ) : null}
                      </p>
                      {line.variantName ? (
                        <p className="text-sm font-medium text-muted-foreground">
                          {line.variantName}
                        </p>
                      ) : null}
                      {line.extras.length > 0 ? (
                        <p className="text-xs text-muted-foreground">
                          + {line.extras.map((extra) => extra.name).join(", ")}
                        </p>
                      ) : null}
                      {line.options.length > 0 ? (
                        <p className="text-xs text-muted-foreground">
                          {line.options
                            .map(
                              (option) =>
                                `${option.groupName}: ${option.name}`
                            )
                            .join(" · ")}
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
                      aria-label={`Quitar una unidad de ${line.itemName}`}
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
                      aria-label={`Añadir una unidad de ${line.itemName}`}
                      onClick={() => changeQuantity(line.key, 1)}
                    >
                      <PlusIcon />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="ml-auto"
                      aria-label={`Quitar ${line.itemName} de la comanda`}
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

          <div className="flex flex-col gap-1 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="tabular-nums">
                {formatMoney(taxBreakdown.subtotal)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">IVA</span>
              <span className="tabular-nums">{formatMoney(taxBreakdown.tax)}</span>
            </div>
            <div className="flex items-center justify-between border-t pt-1">
              <span className="font-medium">Total</span>
              <span className="text-base font-semibold tabular-nums">
                {formatMoney(total)}
              </span>
            </div>
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
                disabled={!offline.isOnline || !cash.session}
                title={
                  !cash.session
                    ? "Abre la caja para cobrar"
                    : offline.isOnline
                      ? undefined
                      : "El cobro requiere conexión"
                }
                onClick={() => setCharging(true)}
              >
                <CreditCardIcon />
                Cobrar cuenta
              </Button>
              {!cash.session ? (
                <p className="text-xs text-muted-foreground">
                  Caja cerrada: caja o administración debe abrirla para cobrar.
                </p>
              ) : !offline.isOnline ? (
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
          </CardContent>
        </Card>
      </div>

      <AlertDialog
        open={comboConflict !== null}
        onOpenChange={(open) => {
          if (!open) setComboConflict(null)
        }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-chart-3/10 text-chart-3">
              <GroupIcon />
            </AlertDialogMedia>
            <AlertDialogTitle>Elige el combo correcto</AlertDialogTitle>
            <AlertDialogDescription>
              Los artículos agregados coinciden con más de un combo. Confirma
              cuál opción debe aplicarse.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="flex flex-col gap-2">
            {comboConflict?.matches.map((match) => {
              const promotion = match.combo.promotions?.[0]

              return (
                <Button
                  key={match.combo.id}
                  type="button"
                  variant="outline"
                  className="h-auto justify-between gap-3 py-2 text-left"
                  onClick={() => chooseComboConflict(match)}
                >
                  <span className="flex min-w-0 flex-col items-start gap-0.5">
                    <span className="truncate font-medium">
                      {match.combo.name}
                    </span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {promotion?.isActive
                        ? PROMOTION_TYPE_LABELS[promotion.type]
                        : "Precio normal"}
                    </span>
                  </span>
                  <span className="shrink-0 font-medium tabular-nums">
                    {formatMoney(match.comboPrice)}
                  </span>
                </Button>
              )
            })}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {selectedProduct ? (
        <AddItemDialog
          product={selectedProduct}
          guests={guests}
          activeGuestKey={activeGuestKey}
          splitByGuest={isDineIn}
          cart={cart}
          cardTextSize={cardTextScale}
          onClose={() => {
            setSelectedProduct(null)
            setPendingProductId(null)
          }}
          onSave={(configurations) => {
            applyItemOrder(selectedProduct.id, configurations)
            setSelectedProduct(null)
            setPendingProductId(null)
          }}
        />
      ) : null}

      <AlertDialog
        open={Boolean(guestRemoving)}
        onOpenChange={(next) => !next && setGuestRemoving(null)}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive">
              <Trash2Icon />
            </AlertDialogMedia>
            <AlertDialogTitle>
              Quitar a{" "}
              {guestRemoving
                ? guestDisplayName(
                    guestRemoving,
                    guests.findIndex(
                      (guest) => guest.key === guestRemoving.key
                    )
                  )
                : "este cliente"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Sus líneas se quedan en la cuenta como «General». Esta acción no
              borra los productos ya pedidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={guestBusy}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => void applyGuestRemove()}
              disabled={guestBusy}
            >
              Quitar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {charging && activeOrder ? (
        <ChargeDialog
          order={activeOrder}
          canConfirm={canConfirm}
          canRefund={canRefund}
          mercadoPago={mercadoPago}
          defaultTipPercent={branch?.defaultTipPercent ?? 0}
          displayTipPercent={displayState?.tipPercent ?? null}
          onClose={() => setCharging(false)}
          onClosed={() => {
            setCharging(false)
            setOrderId("")
            setCart([])
            setGuests([{ key: newGuestKey(), name: "", savedName: "", title: null }])
            setPartySize(1)
            setActiveGuestKey(null)
            setTableNumber("1")
            setChannel("DINE_IN")
            setCustomerName("")
            setCustomerTitle(null)
            setCustomerPhone("")
            setDeliveryAddress("")
            setDeliveryFee("0")
            setPendingProductId(null)
            dismissComboNotice()
            setComboConflict(null)
            router.refresh()
          }}
        />
      ) : null}
    </div>
  )
}

function AgeRangePopover({
  value,
  disabled,
  onChange,
}: {
  value: GuestTitle | null
  disabled?: boolean
  onChange: (title: GuestTitle | null) => void
}) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button type="button" variant="outline" className="gap-1.5">
            <CakeIcon className="size-4" />
            Edad
          </Button>
        }
      />
      <PopoverContent align="end" className="w-64">
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium">
            Rango de edad <span className="text-destructive">*</span>
          </span>
          <div className="flex flex-wrap gap-1">
            {GUEST_TITLES.map((title) => (
              <Button
                key={title}
                type="button"
                variant="outline"
                size="sm"
                className={jalapenoChipClass(value === title)}
                aria-pressed={value === title}
                disabled={disabled}
                onClick={() => onChange(value === title ? null : title)}
              >
                {GUEST_TITLE_LABELS[title]}
              </Button>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground">
            * Dato para estadísticas. No cambia el trato al cliente.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function GuestNameField({
  guest,
  placeholder,
  disabled,
  onChange,
  onCommit,
}: {
  guest: GuestDraft
  placeholder?: string
  disabled?: boolean
  onChange: (name: string) => void
  onCommit: (name: string) => void
}) {
  const [draft, setDraft] = React.useState(guest.name)

  /* eslint-disable react-hooks/set-state-in-effect */
  React.useEffect(() => {
    setDraft(guest.name)
  }, [guest.name])
  /* eslint-enable react-hooks/set-state-in-effect */

  return (
    <Input
      value={draft}
      disabled={disabled}
      maxLength={40}
      placeholder={placeholder ?? "Cliente"}
      onChange={(event) => {
        setDraft(event.target.value)
        onChange(event.target.value)
      }}
      onBlur={() => {
        const next = draft.trim()
        if (next !== guest.savedName) onCommit(next)
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault()
          event.currentTarget.blur()
        }
      }}
    />
  )
}

const GENERAL_GUEST_KEY = "__general__"

interface GuestConfig {
  /** Cantidad por presentación elegida. */
  variantQuantities: Record<string, number>
  /** Cantidad cuando el artículo no tiene presentaciones. */
  quantity: number
  extraIds: string[]
  excludedIds: string[]
  selectedOptions: Record<string, string[]>
  notes: string
  /** El tab ya tenía líneas guardadas en la comanda. */
  hasLines: boolean
}

function AddItemDialog({
  product,
  guests,
  activeGuestKey,
  splitByGuest,
  cart,
  cardTextSize,
  onClose,
  onSave,
}: {
  product: ItemListItem
  guests: GuestDraft[]
  activeGuestKey: string | null
  /** En mostrador y otros canales no se reparte el platillo por cliente. */
  splitByGuest: boolean
  cart: CartLine[]
  cardTextSize: ArticleCardTextSize
  onClose: () => void
  onSave: (
    configurations: Array<{
      guestKey: string | null
      lines: Array<Omit<CartLine, "key">>
    }>
  ) => void
}) {
  const variants = product.variants.filter((variant) => variant.isActive)
  const extras = product.extras.filter((extra) => extra.isActive)
  const exclusions = product.ingredientExclusions ?? []
  const groups = (product.optionGroups ?? []).filter(
    (group) =>
      group.group &&
      group.values.some((value) => isItemOptionValueAvailable(value))
  )

  const emptySelectedOptions = () =>
    Object.fromEntries(
      groups.map((group) => {
        const available = group.values.filter(isItemOptionValueAvailable)

        if (group.selection === "MULTIPLE") {
          const max = Math.max(1, group.maxSelect ?? available.length)

          return [
            group.id,
            available
              .filter((value) => value.isDefault)
              .slice(0, max)
              .map((value) => value.id),
          ]
        }

        if (!group.isRequired && (group.minSelect ?? 0) <= 0) {
          return [group.id, []]
        }

        const preferred =
          available.find((value) => value.isDefault) ?? available[0]

        return [group.id, preferred ? [preferred.id] : []]
      })
    ) as Record<string, string[]>

  const configFromLines = (lines: CartLine[]): GuestConfig => {
    const variantQuantities: Record<string, number> = {}
    let quantity = 0

    for (const line of lines) {
      if (line.variantId) {
        variantQuantities[line.variantId] =
          (variantQuantities[line.variantId] ?? 0) + line.quantity
      } else {
        quantity = line.quantity
      }
    }

    const first = lines[0]
    const selectedOptions = first
      ? (Object.fromEntries(
          groups.map((group) => [
            group.id,
            group.values
              .filter((value) =>
                first.options.some(
                  (option) => option.itemOptionValueId === value.id
                )
              )
              .map((value) => value.id),
          ])
        ) as Record<string, string[]>)
      : emptySelectedOptions()

    return {
      variantQuantities,
      quantity,
      extraIds: first?.extras.map((extra) => extra.id) ?? [],
      excludedIds: first?.excludedIngredientIds ?? [],
      selectedOptions,
      notes: first?.notes ?? "",
      hasLines: lines.length > 0,
    }
  }

  const [configs, setConfigs] = React.useState<Record<string, GuestConfig>>(
    () => {
      const entries: Record<string, GuestConfig> = {}
      const keys = splitByGuest
        ? [GENERAL_GUEST_KEY, ...guests.map((guest) => guest.key)]
        : [GENERAL_GUEST_KEY]

      for (const key of keys) {
        const guestKey = key === GENERAL_GUEST_KEY ? null : key

        entries[key] = configFromLines(
          cart.filter(
            (line) =>
              line.itemId === product.id &&
              (line.guestKey ?? null) === guestKey
          )
        )
      }

      return entries
    }
  )
  const [activeKey, setActiveKey] = React.useState<string>(() => {
    if (!splitByGuest) return GENERAL_GUEST_KEY

    const requested = activeGuestKey ?? GENERAL_GUEST_KEY
    return requested in configs ? requested : GENERAL_GUEST_KEY
  })

  const config =
    configs[activeKey] ?? configs[GENERAL_GUEST_KEY] ?? configFromLines([])

  const updateConfig = (
    updater: (current: GuestConfig) => GuestConfig
  ) => {
    setConfigs((current) => {
      const currentConfig =
        current[activeKey] ?? current[GENERAL_GUEST_KEY] ?? config
      return { ...current, [activeKey]: updater(currentConfig) }
    })
  }

  const selectedExtras = extras.filter((extra) =>
    config.extraIds.includes(extra.id)
  )
  const selectedCartOptions = groups.flatMap((group) =>
    group.values
      .filter((value) => config.selectedOptions[group.id]?.includes(value.id))
      .map((value) => ({
        itemOptionValueId: value.id,
        groupName: group.group.name,
        name: itemOptionValueName(value),
        price: Number(value.priceDelta),
      }))
  )

  const baseUnitPrice =
    Number(product.price) +
    selectedExtras.reduce((sum, extra) => sum + Number(extra.price), 0) +
    selectedCartOptions.reduce((sum, option) => sum + option.price, 0)

  const unitPriceFor = (priceAdjust: string | number | null | undefined) =>
    baseUnitPrice + Number(priceAdjust ?? 0)

  const total =
    variants.length > 0
      ? variants.reduce(
          (sum, candidate) =>
            sum +
            (config.variantQuantities[candidate.id] ?? 0) *
              unitPriceFor(candidate.priceAdjust),
          0
        )
      : config.quantity * unitPriceFor(0)

  const variantQuantityTotal = (candidate: GuestConfig) =>
    variants.reduce(
      (sum, variant) => sum + (candidate.variantQuantities[variant.id] ?? 0),
      0
    )

  const configHasContent = (candidate: GuestConfig) =>
    candidate.hasLines ||
    (variants.length > 0
      ? variantQuantityTotal(candidate) > 0
      : candidate.quantity > 0)

  const setVariantQuantity = (variantId: string, next: number) => {
    updateConfig((current) => ({
      ...current,
      variantQuantities: {
        ...current.variantQuantities,
        [variantId]: Math.min(99, Math.max(0, next)),
      },
    }))
  }

  const changeVariantQuantity = (variantId: string, delta: number) => {
    const current = config.variantQuantities[variantId] ?? 0
    setVariantQuantity(variantId, current + delta)
  }

  const toggleVariant = (variantId: string) => {
    const current = config.variantQuantities[variantId] ?? 0
    setVariantQuantity(variantId, current === 1 ? 0 : current === 0 ? 1 : current)
  }

  function chooseOption(
    groupId: string,
    valueId: string,
    multiple: boolean,
    required: boolean
  ) {
    updateConfig((current) => {
      const ids = current.selectedOptions[groupId] ?? []

      if (multiple) {
        return {
          ...current,
          selectedOptions: {
            ...current.selectedOptions,
            [groupId]: ids.includes(valueId)
              ? ids.filter((id) => id !== valueId)
              : [...ids, valueId],
          },
        }
      }

      if (!required && ids.includes(valueId)) {
        return {
          ...current,
          selectedOptions: { ...current.selectedOptions, [groupId]: [] },
        }
      }

      return {
        ...current,
        selectedOptions: { ...current.selectedOptions, [groupId]: [valueId] },
      }
    })
  }

  const toggleExtra = (extraId: string) => {
    updateConfig((current) => ({
      ...current,
      extraIds: current.extraIds.includes(extraId)
        ? current.extraIds.filter((id) => id !== extraId)
        : [...current.extraIds, extraId],
    }))
  }

  const toggleExclusion = (ingredientId: string) => {
    updateConfig((current) => ({
      ...current,
      excludedIds: current.excludedIds.includes(ingredientId)
        ? current.excludedIds.filter((id) => id !== ingredientId)
        : [...current.excludedIds, ingredientId],
    }))
  }

  const save = () => {
    for (const [key, candidate] of Object.entries(configs)) {
      const quantity =
        variants.length > 0
          ? variantQuantityTotal(candidate)
          : candidate.quantity

      // Un tab que se vació solo elimina sus líneas; no exige opciones.
      if (quantity <= 0) continue

      const missing = groups.find((group) => {
        const min = group.isRequired
          ? Math.max(1, group.minSelect ?? 1)
          : Math.max(0, group.minSelect ?? 0)

        return (
          min > 0 &&
          (candidate.selectedOptions[group.id]?.length ?? 0) < min
        )
      })

      if (missing) {
        setActiveKey(key)

        const min = Math.max(1, missing.minSelect ?? 1)
        toast.error(
          min > 1
            ? `Elige al menos ${min} opciones de ${missing.group.name}`
            : `Elige ${missing.group.name}`
        )
        return
      }
    }

    const configurations: Array<{
      guestKey: string | null
      lines: Array<Omit<CartLine, "key">>
    }> = []

    for (const [key, candidate] of Object.entries(configs)) {
      const guestKey = key === GENERAL_GUEST_KEY ? null : key
      const totalQuantity =
        variants.length > 0
          ? variantQuantityTotal(candidate)
          : candidate.quantity

      if (totalQuantity <= 0 && !candidate.hasLines) continue

      const candidateExtras = extras.filter((extra) =>
        candidate.extraIds.includes(extra.id)
      )
      const candidateOptions = groups.flatMap((group) =>
        group.values
          .filter((value) =>
            candidate.selectedOptions[group.id]?.includes(value.id)
          )
          .map((value) => ({
            itemOptionValueId: value.id,
            groupName: group.group.name,
            name: itemOptionValueName(value),
            price: Number(value.priceDelta),
          }))
      )
      const candidateBase =
        Number(product.price) +
        candidateExtras.reduce((sum, extra) => sum + Number(extra.price), 0) +
        candidateOptions.reduce((sum, option) => sum + option.price, 0)
      const shared = {
        notes: candidate.notes.trim() || undefined,
        extras: candidateExtras.map((extra) => ({
          id: extra.id,
          name: extra.name,
          price: Number(extra.price),
        })),
        options: candidateOptions,
        excludedIngredientIds: candidate.excludedIds,
        excludedNames: exclusions
          .filter((exclusion) =>
            candidate.excludedIds.includes(exclusion.ingredient.id)
          )
          .map((exclusion) => exclusion.ingredient.name),
      }
      const lines: Array<Omit<CartLine, "key">> = []

      if (variants.length > 0) {
        for (const variant of variants) {
          const count = candidate.variantQuantities[variant.id] ?? 0
          if (count <= 0) continue

          lines.push({
            itemId: product.id,
            itemName: product.name,
            variantId: variant.id,
            variantName: variant.name,
            unitPrice: candidateBase + Number(variant.priceAdjust),
            quantity: count,
            ...shared,
          })
        }
      } else if (candidate.quantity > 0) {
        lines.push({
          itemId: product.id,
          itemName: product.name,
          unitPrice: candidateBase,
          quantity: candidate.quantity,
          ...shared,
        })
      }

      configurations.push({ guestKey, lines })
    }

    if (configurations.length === 0) {
      toast.info("Sin cambios")
      onClose()
      return
    }

    onSave(configurations)
  }

  const hasExistingLines = Object.values(configs).some(
    (candidate) => candidate.hasLines
  )

  const tabs = splitByGuest
    ? [
        ...(guests.length > 1
          ? [{ key: GENERAL_GUEST_KEY, label: "General" }]
          : []),
        ...guests.map((guest, index) => ({
          key: guest.key,
          label: guest.name.trim() || `Cliente ${index + 1}`,
        })),
      ]
    : []

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{product.name}</DialogTitle>
          {product.description ? (
            <p className="text-sm text-muted-foreground">
              {product.description}
            </p>
          ) : null}
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {splitByGuest ? (
            <fieldset className="min-w-0 rounded-lg border border-dashed px-2 pt-1 pb-2">
              <legend className="px-1 text-[10px] font-medium text-muted-foreground">
                Orden para
              </legend>
              <div className="flex flex-wrap gap-1.5">
                {tabs.map((tab) => {
                  const candidate = configs[tab.key]
                  const active = activeKey === tab.key
                  const hasContent = candidate
                    ? configHasContent(candidate)
                    : false

                  return (
                    <Button
                      key={tab.key}
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-pressed={active}
                      className={jalapenoChipClass(active)}
                      onClick={() => setActiveKey(tab.key)}
                    >
                      {tab.label}
                      {hasContent ? (
                        <span
                          className={cn(
                            "size-1.5 rounded-full",
                            active ? "bg-chart-2" : "bg-muted-foreground"
                          )}
                        />
                      ) : null}
                    </Button>
                  )
                })}
              </div>
            </fieldset>
          ) : null}

          {variants.length > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              {variants.map((candidate) => {
                const count = config.variantQuantities[candidate.id] ?? 0
                const selected = count > 0
                const candidatePrice =
                  Number(product.price) + Number(candidate.priceAdjust)

                return (
                  <div
                    key={candidate.id}
                    className={cn(
                      "flex flex-col overflow-hidden rounded-xl border bg-card transition-shadow",
                      selected && "ring-2 ring-primary"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => toggleVariant(candidate.id)}
                      aria-pressed={selected}
                      aria-label={`Elegir ${candidate.name}`}
                      className="block w-full text-left focus-visible:outline-none"
                    >
                      <ArticleCardVisual
                        name={candidate.name}
                        price={formatMoney(candidatePrice)}
                        imageUrl={candidate.imageUrl ?? product.imageUrl}
                        imageVariants={
                          candidate.imageVariants ?? product.imageVariants
                        }
                        selected={false}
                        compact
                        textSize={cardTextSize}
                        className="rounded-none! border-0!"
                        badge={
                          candidate.isPrimary ? (
                            <Badge
                              variant="outline"
                              className="border-white/35 bg-black/35 text-[10px] text-white backdrop-blur-sm"
                            >
                              Principal
                            </Badge>
                          ) : null
                        }
                      />
                    </button>

                    <div className="flex items-center justify-between gap-1 border-t px-1.5 py-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        aria-label={`Quitar una unidad de ${candidate.name}`}
                        disabled={count <= 0}
                        onClick={() =>
                          changeVariantQuantity(candidate.id, -1)
                        }
                      >
                        <MinusIcon />
                      </Button>
                      <span className="min-w-6 text-center text-sm tabular-nums">
                        {count}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        aria-label={`Añadir una unidad de ${candidate.name}`}
                        onClick={() =>
                          changeVariantQuantity(candidate.id, 1)
                        }
                      >
                        <PlusIcon />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              <div
                className={cn(
                  "flex flex-col overflow-hidden rounded-xl border bg-card transition-shadow",
                  config.quantity > 0 && "ring-2 ring-primary"
                )}
              >
                <button
                  type="button"
                  onClick={() =>
                    updateConfig((current) => ({
                      ...current,
                      quantity:
                        current.quantity === 1
                          ? 0
                          : current.quantity === 0
                            ? 1
                            : current.quantity,
                    }))
                  }
                  aria-pressed={config.quantity > 0}
                  aria-label={`Elegir ${product.name}`}
                  className="block w-full text-left focus-visible:outline-none"
                >
                  <ArticleCardVisual
                    name={product.name}
                    price={formatMoney(Number(product.price))}
                    imageUrl={product.imageUrl}
                    imageVariants={product.imageVariants}
                    selected={false}
                    compact
                    textSize={cardTextSize}
                    className="rounded-none! border-0!"
                  />
                </button>

                <div className="flex items-center justify-between gap-1 border-t px-1.5 py-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    aria-label={`Quitar una unidad de ${product.name}`}
                    disabled={config.quantity <= 0}
                    onClick={() =>
                      updateConfig((current) => ({
                        ...current,
                        quantity: Math.max(0, current.quantity - 1),
                      }))
                    }
                  >
                    <MinusIcon />
                  </Button>
                  <span className="min-w-6 text-center text-sm tabular-nums">
                    {config.quantity}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    aria-label={`Añadir una unidad de ${product.name}`}
                    onClick={() =>
                      updateConfig((current) => ({
                        ...current,
                        quantity: Math.min(99, current.quantity + 1),
                      }))
                    }
                  >
                    <PlusIcon />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {groups.map((group) => {
            const availableValues = group.values.filter((value) =>
              isItemOptionValueAvailable(value)
            )
            const chosen = config.selectedOptions[group.id] ?? []
            const chosenCount = chosen.filter((id) =>
              availableValues.some((value) => value.id === id)
            ).length
            const maxSelectable = Math.max(
              1,
              group.maxSelect ?? availableValues.length
            )
            const required =
              group.isRequired || (group.minSelect ?? 0) > 0

            return (
              <div key={group.id} className="flex flex-col gap-2">
                <div className="flex flex-wrap items-baseline gap-1 text-sm font-medium">
                  <span>
                    {group.group.name}
                    {required ? (
                      <span className="text-destructive"> *</span>
                    ) : null}
                  </span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {group.selection === "SINGLE"
                      ? "(Puedes elegir una)"
                      : `(${chosenCount}/${maxSelectable} seleccionables)`}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {availableValues.map((value) => {
                    const checked = chosen.includes(value.id)
                    const disabled =
                      group.selection === "MULTIPLE" &&
                      !checked &&
                      chosenCount >= maxSelectable
                    const valueName = itemOptionValueName(value)
                    const delta = Number(value.priceDelta)

                    return (
                      <Button
                        key={value.id}
                        type="button"
                        variant="outline"
                        size="sm"
                        aria-pressed={checked}
                        disabled={disabled}
                        className={jalapenoChipClass(checked)}
                        onClick={() =>
                          chooseOption(
                            group.id,
                            value.id,
                            group.selection === "MULTIPLE",
                            required
                          )
                        }
                      >
                        {valueName}
                        {delta !== 0 ? (
                          <span className="tabular-nums opacity-80">
                            +{formatMoney(value.priceDelta)}
                          </span>
                        ) : null}
                      </Button>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {extras.length > 0 ? (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Extras</span>
              <div className="flex flex-wrap gap-1.5">
                {extras.map((extra) => {
                  const active = config.extraIds.includes(extra.id)

                  return (
                    <Button
                      key={extra.id}
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-pressed={active}
                      className={jalapenoChipClass(active)}
                      onClick={() => toggleExtra(extra.id)}
                    >
                      {extra.name}
                      {Number(extra.price) !== 0 ? (
                        <span className="tabular-nums opacity-80">
                          +{formatMoney(extra.price)}
                        </span>
                      ) : null}
                    </Button>
                  )
                })}
              </div>
            </div>
          ) : null}

          {exclusions.length > 0 ? (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Sin…</span>
              <div className="flex flex-wrap gap-1.5">
                {exclusions.map((exclusion) => {
                  const active = config.excludedIds.includes(
                    exclusion.ingredient.id
                  )

                  return (
                    <Button
                      key={exclusion.id}
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-pressed={active}
                      className={jalapenoChipClass(active)}
                      onClick={() =>
                        toggleExclusion(exclusion.ingredient.id)
                      }
                    >
                      Sin {exclusion.ingredient.name}
                    </Button>
                  )
                })}
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            <Label htmlFor="pos-notes">Notas para cocina</Label>
            <Textarea
              id="pos-notes"
              value={config.notes}
              onChange={(event) =>
                updateConfig((current) => ({
                  ...current,
                  notes: event.target.value,
                }))
              }
              placeholder="Ej. sin azúcar, bien caliente…"
              maxLength={200}
              rows={3}
              className="w-full"
            />
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Total</span>
            <span className="font-semibold tabular-nums">
              {formatMoney(total)}
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" onClick={save}>
            {hasExistingLines ? "Guardar pedido" : "Añadir a la comanda"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
