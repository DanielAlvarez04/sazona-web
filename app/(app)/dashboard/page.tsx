import { TriangleAlertIcon } from "lucide-react"

import { DashboardView } from "@/components/dashboard/dashboard-view"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { apiFetch } from "@/lib/api"
import type { DashboardOverview } from "@/lib/dashboard"
import { displayName, requireUser } from "@/lib/session"

export default async function Page() {
  const user = await requireUser()

  const response = await apiFetch("/dashboard?days=7")

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

  return <DashboardView data={data} userName={displayName(user)} />
}
