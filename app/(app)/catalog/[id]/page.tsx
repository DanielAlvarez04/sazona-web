import { notFound } from "next/navigation"
import { TriangleAlertIcon } from "lucide-react"

import { ProductDetailView } from "@/components/catalog/product-detail-view"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { apiFetch } from "@/lib/api"
import {
  canManageCatalog,
  type Category,
  type Ingredient,
  type ItemDetail,
  type ItemListItem,
} from "@/lib/catalog"
import { requireUser } from "@/lib/session"

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await requireUser()

  const [productResponse, categoriesResponse, ingredientsResponse, productsResponse] =
    await Promise.all([
      apiFetch(`/catalog/items/${encodeURIComponent(id)}`),
      apiFetch("/catalog/categories?includeInactive=true"),
      apiFetch("/inventory/ingredients"),
      apiFetch("/catalog/items?includeInactive=true"),
    ])

  if (productResponse.status === 404) {
    notFound()
  }

  if (
    !productResponse.ok ||
    !categoriesResponse.ok ||
    !ingredientsResponse.ok ||
    !productsResponse.ok
  ) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <Card className="max-w-md text-center">
          <CardHeader className="items-center">
            <TriangleAlertIcon className="size-6 text-destructive" />
            <CardTitle>No se pudo cargar el artículo</CardTitle>
            <CardDescription>
              La API no respondió correctamente. Comprueba que está en marcha e
              inténtalo de nuevo.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const [product, categories, ingredients, products] = await Promise.all([
    productResponse.json() as Promise<ItemDetail>,
    categoriesResponse.json() as Promise<Category[]>,
    ingredientsResponse.json() as Promise<Ingredient[]>,
    productsResponse.json() as Promise<ItemListItem[]>,
  ])

  return (
    <ProductDetailView
      product={product}
      categories={categories}
      ingredients={ingredients}
      products={products}
      organizationTaxRate={user.organizationTaxRate}
      canManage={canManageCatalog(user.roles)}
    />
  )
}
