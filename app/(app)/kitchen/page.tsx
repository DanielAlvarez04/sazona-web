import { TriangleAlertIcon } from "lucide-react"

import { KitchenView } from "@/components/kitchen/kitchen-view"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { apiFetch } from "@/lib/api"
import { canWorkKitchen, type KitchenRound } from "@/lib/orders"
import { requireUser } from "@/lib/session"

export default async function KitchenPage() {
  const user = await requireUser()

  const response = await apiFetch("/kitchen/rounds")

  if (!response.ok) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <Card className="max-w-md text-center">
          <CardHeader className="items-center">
            <TriangleAlertIcon className="size-6 text-destructive" />
            <CardTitle>No se pudo cargar la cocina</CardTitle>
            <CardDescription>
              La API no respondió correctamente. Comprueba que está en marcha e
              inténtalo de nuevo.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const rounds = (await response.json()) as KitchenRound[]

  return <KitchenView rounds={rounds} canWork={canWorkKitchen(user.roles)} />
}
