import { InventoryClient } from "./inventory-client"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { apiFetch } from "@/lib/api"
import { getActiveBranch, getBranches } from "@/lib/branch-server"
import { TriangleAlertIcon } from "lucide-react"
import {
  canManageInventory,
  type Ingredient,
  type InventoryMovement,
} from "@/lib/catalog"
import type { InventoryReport } from "@/lib/dashboard"
import { requireUser } from "@/lib/session"

/** Ventana del reporte de consumo que alimenta las tarjetas de resumen. */
const SUMMARY_DAYS = 30

function dateParam(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export default async function InventoryPage() {
  const user = await requireUser()

  const today = new Date()
  const since = new Date(today.getTime() - (SUMMARY_DAYS - 1) * 86400000)
  const reportQuery = `from=${dateParam(since)}&to=${dateParam(today)}`

  const [ingredientsResponse, movementsResponse, reportResponse, branch, branches] =
    await Promise.all([
      // `includeBranchStocks` alimenta el KPI del Modo Global.
      apiFetch("/inventory/ingredients?includeInactive=true&includeBranchStocks=true"),
      apiFetch("/inventory/movements?limit=200"),
      apiFetch(`/reports/inventory?${reportQuery}`),
      getActiveBranch(),
      getBranches(),
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
  const movements = movementsResponse.ok
    ? ((await movementsResponse.json()) as InventoryMovement[])
    : []
  const inventoryReport = reportResponse.ok
    ? ((await reportResponse.json()) as InventoryReport)
    : null

  return (
    <InventoryClient
      initialIngredients={ingredients}
      initialMovements={movements}
      inventoryReport={inventoryReport}
      branches={branches}
      canManage={canManageInventory(user.roles)}
      initialBranch={branch}
    />
  )
}
