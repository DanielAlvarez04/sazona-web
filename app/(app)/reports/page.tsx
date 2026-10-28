import { redirect } from "next/navigation"

import { ReportsView } from "@/components/reports/reports-view"
import { apiFetch } from "@/lib/api"
import { getActiveBranch } from "@/lib/branch-server"
import type {
  InventoryReport,
  KitchenReport,
  SalesReport,
} from "@/lib/dashboard"
import { canReadMoney, canWorkKitchen } from "@/lib/orders"
import { requireUser } from "@/lib/session"

type SearchParams = Promise<Record<string, string | string[] | undefined>>

const OPERATIONS_ROLES = ["ADMIN", "WAITER", "KITCHEN", "INVENTORY_MANAGER"]

/** Periodos ofrecidos por el selector de reportes. */
const PERIODS = [7, 30, 90] as const

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const user = await requireUser()
  const params = await searchParams
  const rawDays = Array.isArray(params.days) ? params.days[0] : params.days
  const parsed = Number(rawDays)
  const days = PERIODS.find((value) => value === parsed) ?? 7

  const money = canReadMoney(user.roles)
  const operations =
    user.roles.some((role) => OPERATIONS_ROLES.includes(role)) ||
    canWorkKitchen(user.roles)

  if (!money && !operations) {
    redirect("/dashboard")
  }

  const { from, to } = range(days)

  const [salesResponse, inventoryResponse, kitchenResponse, branch] =
    await Promise.all([
      money
        ? apiFetch(`/reports/sales?from=${from}&to=${to}`)
        : Promise.resolve(null),
      operations
        ? apiFetch(`/reports/inventory?from=${from}&to=${to}`)
        : Promise.resolve(null),
      operations
        ? apiFetch(`/reports/kitchen?from=${from}&to=${to}`)
        : Promise.resolve(null),
      getActiveBranch(),
    ])

  const sales =
    salesResponse && salesResponse.ok
      ? ((await salesResponse.json()) as SalesReport)
      : null
  const inventory =
    inventoryResponse && inventoryResponse.ok
      ? ((await inventoryResponse.json()) as InventoryReport)
      : null
  const kitchen =
    kitchenResponse && kitchenResponse.ok
      ? ((await kitchenResponse.json()) as KitchenReport)
      : null

  return (
    <ReportsView
      days={days}
      sales={sales}
      inventory={inventory}
      kitchen={kitchen}
      branch={branch}
    />
  )
}

/** Periodo en fechas `YYYY-MM-DD` (hora local del servidor). */
function range(days: number): { from: string; to: string } {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  start.setDate(start.getDate() - (days - 1))

  const format = (date: Date) => {
    const month = `${date.getMonth() + 1}`.padStart(2, "0")
    const day = `${date.getDate()}`.padStart(2, "0")
    return `${date.getFullYear()}-${month}-${day}`
  }

  return { from: format(start), to: format(now) }
}
