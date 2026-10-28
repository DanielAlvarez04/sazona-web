"use server"

import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"

import { BRANCH_COOKIE } from "@/lib/api"
import { getBranches } from "@/lib/branch-server"

export interface BranchActionResult {
  ok: boolean
  message?: string
}

/**
 * Cambia la sucursal activa de la sesión.
 *
 * Con `null` se vuelve a la vista consolidada de la organización. La cookie
 * se envía a la API como `x-branch-id` en cada petición de negocio.
 */
export async function setActiveBranch(
  branchId: string | null
): Promise<BranchActionResult> {
  const store = await cookies()

  if (!branchId) {
    store.delete(BRANCH_COOKIE)
    revalidatePath("/", "layout")
    return { ok: true }
  }

  const branches = await getBranches()
  const branch = branches.find(
    (candidate) => candidate.id === branchId && candidate.isActive
  )

  if (!branch) {
    return { ok: false, message: "Esa sucursal no está disponible." }
  }

  store.set(BRANCH_COOKIE, branch.id, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
  })

  revalidatePath("/", "layout")

  return { ok: true }
}
