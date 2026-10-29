import { TriangleAlertIcon } from "lucide-react"

import { CatalogClient } from "@/components/catalog/catalog-client"
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
  type ArticleListItem,
  type Category,
  type Ingredient,
  type Recipe,
} from "@/lib/catalog"
import { requireUser } from "@/lib/session"

export default async function CatalogPage() {
  const user = await requireUser()

  const [
    recipesResponse,
    productsResponse,
    categoriesResponse,
    ingredientsResponse,
    branch,
  ] = await Promise.all([
    apiFetch("/catalog/recipes?includeInactive=true"),
    apiFetch("/catalog/products?includeInactive=true"),
    apiFetch("/catalog/categories?includeInactive=true"),
    apiFetch("/inventory/ingredients?includeInactive=true"),
    getActiveBranch(),
  ])

  if (
    !recipesResponse.ok ||
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

  const [recipes, articles, categories, ingredients] = await Promise.all([
    recipesResponse.json() as Promise<Recipe[]>,
    productsResponse.json() as Promise<ArticleListItem[]>,
    categoriesResponse.json() as Promise<Category[]>,
    ingredientsResponse.json() as Promise<Ingredient[]>,
  ])

  return (
    <CatalogClient
      recipes={recipes}
      articles={articles}
      categories={categories}
      ingredients={ingredients}
      canManage={canManageCatalog(user.roles)}
      branch={branch}
    />
  )
}


