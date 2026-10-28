import { TriangleAlertIcon } from "lucide-react"

import { CatalogView } from "@/components/catalog/catalog-view"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { apiFetch } from "@/lib/api"
import { getActiveBranch } from "@/lib/branch-server"
import {
  canManageCatalog,
  type Category,
  type Ingredient,
  type ProductListItem,
} from "@/lib/catalog"
import { requireUser } from "@/lib/session"

export default async function CatalogPage() {
  const user = await requireUser()

  const [productsResponse, categoriesResponse, ingredientsResponse, branch] =
    await Promise.all([
      apiFetch("/catalog/products?includeInactive=true"),
      apiFetch("/catalog/categories?includeInactive=true"),
      apiFetch("/inventory/ingredients"),
      getActiveBranch(),
    ])

  if (
    !productsResponse.ok ||
    !categoriesResponse.ok ||
    !ingredientsResponse.ok
  ) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <Card className="max-w-md text-center">
          <CardHeader className="items-center">
            <TriangleAlertIcon className="size-6 text-destructive" />
            <CardTitle>No se pudo cargar el catálogo</CardTitle>
            <CardDescription>
              La API no respondió correctamente. Comprueba que está en marcha e
              inténtalo de nuevo.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const [products, categories, ingredients] = await Promise.all([
    productsResponse.json() as Promise<ProductListItem[]>,
    categoriesResponse.json() as Promise<Category[]>,
    ingredientsResponse.json() as Promise<Ingredient[]>,
  ])

  return (
    <CatalogView
      products={products}
      categories={categories}
      ingredients={ingredients}
      organizationTaxRate={user.organizationTaxRate}
      canManage={canManageCatalog(user.roles)}
      branch={branch}
    />
  )
}
