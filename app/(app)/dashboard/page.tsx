import { TriangleAlertIcon } from "lucide-react"

import { DashboardView } from "@/components/dashboard/dashboard-view"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { apiFetch } from "@/lib/api"
import { getActiveBranch } from "@/lib/branch-server"
import type { DashboardOverview } from "@/lib/dashboard"
import { displayName, requireUser } from "@/lib/session"

type SearchParams = Promise<Record<string, string | string[] | undefined>>

/** Periodos ofrecidos por el selector del panel. */
const PERIODS = [7, 30, 90] as const

export default async function Page({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const user = await requireUser()
  const params = await searchParams
  const rawDays = Array.isArray(params.days) ? params.days[0] : params.days
  const parsed = Number(rawDays)
  const days = PERIODS.find((value) => value === parsed) ?? 7

  const [response, branch] = await Promise.all([
    apiFetch(`/dashboard?days=${days}`),
    getActiveBranch(),
  ])

  if (!response.ok) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <Card className="max-w-md text-center">
          <CardHeader className="items-center">
            <TriangleAlertIcon className="size-6 text-destructive" />
            <CardTitle>No se pudo cargar el panel</CardTitle>
            <CardDescription>
              La API no respondió correctamente. Comprueba que está en marcha e
              inténtalo de nuevo.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const data = (await response.json()) as DashboardOverview

  return (
    <DashboardView
      data={data}
      userName={displayName(user)}
      branch={branch}
      days={days}
    />
  )
}
