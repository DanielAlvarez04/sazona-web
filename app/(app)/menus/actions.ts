"use server"

import type { Menu } from "@/lib/menus"
import { mutateApi, type ActionResult } from "@/lib/server-api"

const MENU_PATHS = ["/menus", "/pos", "/catalog"]
const menuPaths = (menuId: string) => [...MENU_PATHS, `/menus/${menuId}`]

export interface MenuItemInput {
  itemId: string
  sortOrder?: number
}

export interface MenuInput {
  name: string
  description?: string | null
  isActive?: boolean
  sortOrder?: number
  daysOfWeek?: number[]
  startTime?: string | null
  endTime?: string | null
  startsAt?: string | null
  endsAt?: string | null
  items: MenuItemInput[]
}

export async function createMenu(
  input: MenuInput
): Promise<ActionResult<Menu>> {
  return mutateApi<Menu>("/catalog/menus", "POST", input, MENU_PATHS)
}

export async function updateMenu(
  menuId: string,
  input: Partial<Omit<MenuInput, "items">> & { items?: MenuItemInput[] }
): Promise<ActionResult> {
  return mutateApi(
    `/catalog/menus/${menuId}`,
    "PATCH",
    input,
    menuPaths(menuId)
  )
}

export async function replaceMenuItems(
  menuId: string,
  items: MenuItemInput[]
): Promise<ActionResult> {
  return mutateApi(
    `/catalog/menus/${menuId}/items`,
    "PUT",
    { items },
    menuPaths(menuId)
  )
}

export async function deactivateMenu(menuId: string): Promise<ActionResult> {
  return mutateApi(
    `/catalog/menus/${menuId}`,
    "DELETE",
    undefined,
    menuPaths(menuId)
  )
}

export async function activateMenu(menuId: string): Promise<ActionResult> {
  return mutateApi(
    `/catalog/menus/${menuId}`,
    "PATCH",
    { isActive: true },
    menuPaths(menuId)
  )
}
