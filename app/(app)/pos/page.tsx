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
import type { Category, ProductListItem } from "@/lib/catalog"
import {
  canConfirmPayments,
  canDraftOrders,
  canRefundPayments,
  canRegisterPayments,
  canSendOrders,
  type Order,
} from "@/lib/orders"
import { requireUser } from "@/lib/session"

export default async function PointOfSalePage() {
  const user = await requireUser()

  const [productsResponse, categoriesResponse, ordersResponse, branch] =
    await Promise.all([
      apiFetch("/catalog/products"),
      apiFetch("/catalog/categories"),
      apiFetch("/orders?status=OPEN"),
      getActiveBranch(),
    ])

  if (
    !productsResponse.ok ||
    !categoriesResponse.ok ||
    !ordersResponse.ok
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

  const [products, categories, orders] = await Promise.all([
    productsResponse.json() as Promise<ProductListItem[]>,
    categoriesResponse.json() as Promise<Category[]>,
    ordersResponse.json() as Promise<Order[]>,
  ])

  return (
    <PosView
      products={products}
      categories={categories}
      orders={orders}
      canDraft={canDraftOrders(user.roles)}
      canSend={canSendOrders(user.roles)}
      canRegister={canRegisterPayments(user.roles)}
      canConfirm={canConfirmPayments(user.roles)}
      canRefund={canRefundPayments(user.roles)}
      branch={branch}
    />
  )
}
