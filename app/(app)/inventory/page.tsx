import { InventoryClient } from "./inventory-client"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { apiFetch } from "@/lib/api"
import { getActiveBranch } from "@/lib/branch-server"
import { TriangleAlertIcon } from "lucide-react"
import { canManageInventory, type Ingredient } from "@/lib/catalog"
import { requireUser } from "@/lib/session"

export default async function InventoryPage() {
  const user = await requireUser()

  const [ingredientsResponse, branch] = await Promise.all([
    apiFetch("/inventory/ingredients?includeInactive=true"),
    getActiveBranch(),
  ])

  if (!ingredientsResponse.ok) {
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

  const ingredients = (await ingredientsResponse.json()) as Ingredient[]

  return (
    <InventoryClient
      initialIngredients={ingredients}
      canManage={canManageInventory(user.roles)}
      initialBranch={branch}
    />
  )
}
