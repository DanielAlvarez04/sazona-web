import { TriangleAlertIcon } from "lucide-react"

import { PosView } from "@/components/pos/pos-view"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { apiFetch } from "@/lib/api"
import { getActiveBranch } from "@/lib/branch-server"
import type { Category, ItemListItem } from "@/lib/catalog"
import type { Menu } from "@/lib/menus"
import {
  canConfirmPayments,
  canDraftOrders,
  canManageCash,
  canRefundPayments,
  canRegisterPayments,
  canSendOrders,
  type Order,
} from "@/lib/orders"
import type { CashSessionPayload } from "@/lib/cash"
import type { PosDisplayInfo } from "@/lib/pos-display"
import type { MercadoPagoPointConfig } from "@/lib/mercadopago"
import { requireUser } from "@/lib/session"

export default async function PointOfSalePage() {
  const user = await requireUser()
  const canRegister = canRegisterPayments(user.roles)

  const [
    productsResponse,
    categoriesResponse,
    ordersResponse,
    menusResponse,
    branch,
    cashResponse,
    displaysResponse,
    pointConfigResponse,
  ] = await Promise.all([
    apiFetch("/catalog/items"),
    apiFetch("/catalog/categories"),
    apiFetch("/orders?status=OPEN"),
    apiFetch("/catalog/menus"),
    getActiveBranch(),
    apiFetch("/cash/sessions/current"),
    apiFetch("/pos/displays"),
    canRegister
      ? apiFetch("/mercadopago/point-config")
      : Promise.resolve(null),
  ])

  if (
    !productsResponse.ok ||
    !categoriesResponse.ok ||
    !ordersResponse.ok ||
    !menusResponse.ok
  ) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <Card className="max-w-md text-center">
          <CardHeader className="items-center">
            <TriangleAlertIcon className="size-6 text-destructive" />
            <CardTitle>No se pudo cargar el punto de venta</CardTitle>
            <CardDescription>
              La API no respondió correctamente. Comprueba que está en marcha e
              inténtalo de nuevo.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const [products, categories, orders, menus] = await Promise.all([
    productsResponse.json() as Promise<ItemListItem[]>,
    categoriesResponse.json() as Promise<Category[]>,
    ordersResponse.json() as Promise<Order[]>,
    menusResponse.json() as Promise<Menu[]>,
  ])

  const pointConfigRaw: MercadoPagoPointConfig = pointConfigResponse?.ok
    ? ((await pointConfigResponse.json()) as MercadoPagoPointConfig)
    : { enabled: false, terminals: [] }

  const pointTerminals = pointConfigRaw.terminals.filter(
    (terminal) =>
      !terminal.branchId || !branch || terminal.branchId === branch.id
  )
  const pointConfig: MercadoPagoPointConfig = {
    enabled: pointConfigRaw.enabled && pointTerminals.length > 0,
    terminals: pointTerminals,
  }

  const cash: CashSessionPayload = cashResponse.ok
    ? ((await cashResponse.json()) as CashSessionPayload)
    : { session: null, summary: null }

  const displays: PosDisplayInfo[] = displaysResponse.ok
    ? ((await displaysResponse.json()) as PosDisplayInfo[])
    : []

  return (
    <PosView
      products={products}
      categories={categories}
      orders={orders}
      menus={menus}
      canDraft={canDraftOrders(user.roles)}
      canSend={canSendOrders(user.roles)}
      canRegister={canRegister}
      canConfirm={canConfirmPayments(user.roles)}
      canRefund={canRefundPayments(user.roles)}
      branch={branch}
      mercadoPago={pointConfig}
      cash={cash}
      canManageCash={canManageCash(user.roles)}
      displays={displays}
      taxRate={user.organizationTaxRate ?? "0.16"}
    />
  )
}
