import { TriangleAlertIcon } from "lucide-react"

import { MenusClient } from "@/components/menus/menus-client"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { apiFetch } from "@/lib/api"
import {
  canManageCatalog,
  type ArticleListItem,
  type Category,
} from "@/lib/catalog"
import type { Menu } from "@/lib/menus"
import { requireUser } from "@/lib/session"

export default async function MenusPage() {
  const user = await requireUser()

  const [menusResponse, itemsResponse, categoriesResponse] = await Promise.all([
    apiFetch("/catalog/menus?includeInactive=true"),
    apiFetch("/catalog/items?includeInactive=true"),
    apiFetch("/catalog/categories?kind=article"),
  ])

  if (!menusResponse.ok || !itemsResponse.ok || !categoriesResponse.ok) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <Card className="max-w-md text-center">
          <CardHeader className="items-center">
            <TriangleAlertIcon className="size-6 text-destructive" />
            <CardTitle>No se pudieron cargar los menús</CardTitle>
            <CardDescription>
              La API no respondió correctamente. Comprueba que está en marcha e
              inténtalo de nuevo.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const [menus, items, categories] = await Promise.all([
    menusResponse.json() as Promise<Menu[]>,
    itemsResponse.json() as Promise<ArticleListItem[]>,
    categoriesResponse.json() as Promise<Category[]>,
  ])

  return (
    <MenusClient
      menus={menus}
      items={items}
      categories={categories}
      canManage={canManageCatalog(user.roles)}
    />
  )
}
