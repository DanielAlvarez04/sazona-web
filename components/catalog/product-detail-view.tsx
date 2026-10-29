import Link from "next/link"
import { ArrowLeftIcon } from "lucide-react"

import { ProductCombo } from "@/components/catalog/product-combo"
import { ProductExclusions } from "@/components/catalog/product-exclusions"
import { ProductExtras } from "@/components/catalog/product-extras"
import { ProductGeneralForm } from "@/components/catalog/product-general-form"
import { ProductVariants } from "@/components/catalog/product-variants"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { formatMoney, formatPercent } from "@/lib/catalog"
import type {
  Category,
  Ingredient,
  ProductDetail,
  ProductListItem,
} from "@/lib/catalog"

export function ProductDetailView({
  product,
  categories,
  ingredients,
  products,
  organizationTaxRate,
  canManage,
}: {
  product: ProductDetail
  categories: Category[]
  ingredients: Ingredient[]
  products: ProductListItem[]
  organizationTaxRate: string
  canManage: boolean
}) {
  return (
    <div className="@container/main flex flex-1 flex-col gap-4 px-4 py-6 lg:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <Link
            href="/catalog"
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            <ArrowLeftIcon />
            Volver al catálogo
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold tracking-tight">
                {product.name}
              </h2>
              {product.isCombo ? <Badge>Combo</Badge> : null}
              {product.isActive ? (
                <Badge variant="secondary">Activo</Badge>
              ) : (
                <Badge variant="outline">Inactivo</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {product.sku ?? "Sin SKU"} ·{" "}
              {product.category?.name ?? "Sin categoría"} ·{" "}
              {formatMoney(product.price)} · IVA{" "}
              {formatPercent(product.taxRate ?? organizationTaxRate)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="xl:col-span-2">
          <ProductGeneralForm
            product={product}
            categories={categories}
            canManage={canManage}
          />
        </div>

        <ProductVariants product={product} canManage={canManage} />

        <ProductExtras
          product={product}
          ingredients={ingredients}
          canManage={canManage}
        />

        <ProductExclusions
          product={product}
          ingredients={ingredients}
          canManage={canManage}
        />

        {product.isCombo ? (
          <ProductCombo
            product={product}
            products={products}
            canManage={canManage}
          />
        ) : null}
      </div>
    </div>
  )
}
