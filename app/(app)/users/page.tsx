import { redirect } from "next/navigation"

import { UsersTable } from "@/components/users/users-table"
import { apiFetch } from "@/lib/api"
import { getActiveBranch, getBranches } from "@/lib/branch-server"
import { isAdmin, requireUser } from "@/lib/session"
import type { InternalUser } from "@/lib/users"

export default async function UsersPage() {
  const user = await requireUser()

  if (!isAdmin(user)) {
    redirect("/settings")
  }

  const [response, branches, activeBranch] = await Promise.all([
    apiFetch("/users"),
    getBranches(),
    getActiveBranch(),
  ])

  if (!response.ok) {
    return (
      <div className="@container/main flex flex-1 items-center justify-center px-4 py-10">
        <div className="max-w-md text-center">
          <h2 className="text-lg font-medium">No se pudo cargar el equipo</h2>
          <p className="text-sm text-muted-foreground mt-2">
            La API no respondió correctamente. Comprueba que está en marcha e
            inténtalo de nuevo.
          </p>
        </div>
      </div>
    )
  }

  const users = (await response.json()) as InternalUser[]

  return (
    <UsersTable
      users={users}
      branches={branches}
      activeBranch={activeBranch}
      currentUserId={user.id}
      organizationDomain={user.organizationDomain ?? ""}
    />
  )
}
