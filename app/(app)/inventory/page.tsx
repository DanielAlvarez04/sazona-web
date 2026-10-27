import { TriangleAlertIcon } from "lucide-react"

import { InventoryView } from "@/components/inventory/inventory-view"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { apiFetch } from "@/lib/api"
import {
  canManageInventory,
  type Ingredient,
  type InventoryMovement,
  type StockAlert,
} from "@/lib/catalog"
import { requireUser } from "@/lib/session"

export default async function InventoryPage() {
  const user = await requireUser()

  const [ingredientsResponse, alertsResponse, movementsResponse] =
    await Promise.all([
      apiFetch("/inventory/ingredients?includeInactive=true"),
      apiFetch("/inventory/alerts"),
      apiFetch("/inventory/movements?limit=50"),
    ])

  if (
    !ingredientsResponse.ok ||
    !alertsResponse.ok ||
    !movementsResponse.ok
  ) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <Card className="max-w-md text-center">
          <CardHeader className="items-center">
            <TriangleAlertIcon className="size-6 text-destructive" />
            <CardTitle>No se pudo cargar el inventario</CardTitle>
            <CardDescription>
              La API no respondió correctamente. Comprueba que está en marcha e
              inténtalo de nuevo.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const [ingredients, alerts, movements] = await Promise.all([
    ingredientsResponse.json() as Promise<Ingredient[]>,
    alertsResponse.json() as Promise<StockAlert[]>,
    movementsResponse.json() as Promise<InventoryMovement[]>,
  ])

  return (
    <InventoryView
      ingredients={ingredients}
      alerts={alerts}
      movements={movements}
      canManage={canManageInventory(user.roles)}
    />
  )
}
