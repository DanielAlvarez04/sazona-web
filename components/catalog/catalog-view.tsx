"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import {
  Loader2Icon,
  PackageIcon,
  PlusIcon,
  SearchIcon,
  TagsIcon,
  UploadIcon,
} from "lucide-react"

import { deactivateProduct } from "@/app/(app)/catalog/actions"
import { CategoryDialog } from "@/components/catalog/category-dialog"
import { ImportDialog } from "@/components/catalog/import-dialog"
import { ProductCreateDialog } from "@/components/catalog/product-create-dialog"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useActionForm } from "@/hooks/use-action-form"
import type { Branch } from "@/lib/branches"
import {
  formatMoney,
  formatPercent,
  type Category,
  type Ingredient,
  type ProductListItem,
} from "@/lib/catalog"

export function CatalogView({
  products,
  categories,
  ingredients,
  organizationTaxRate,
  canManage,
  branch,
}: {
  products: ProductListItem[]
  categories: Category[]
  ingredients: Ingredient[]
  organizationTaxRate: string
  canManage: boolean
  /** Sucursal activa; `null` = vista consolidada. */
  branch: Branch | null
}) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [createOpen, setCreateOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [categoriesOpen, setCategoriesOpen] = useState(false)
  const rowForm = useActionForm(() => router.refresh())

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()

    return products.filter((product) => {
      if (categoryId && product.category?.id !== categoryId) return false
      if (!needle) return true

      return (
        product.name.toLowerCase().includes(needle) ||
        (product.sku ?? "").toLowerCase().includes(needle)
      )
    })
  }, [products, search, categoryId])

  const activeCount = products.filter((product) => product.isActive).length

  return (
    <div className="@container/main flex flex-1 flex-col gap-4 px-4 py-6 lg:px-6">
      <PageHeader
        title="Catálogo"
        description={`${products.length} producto(s) · ${activeCount} activo(s) · ${categories.length} categoría(s) · Compartido por todas las sucursales`}
        branch={branch}
        actions={
          canManage ? (
            <>
              <Button
                variant="outline"
                onClick={() => setCategoriesOpen(true)}
              >
                <TagsIcon />
                Categorías
              </Button>
              <Button variant="outline" onClick={() => setImportOpen(true)}>
                <UploadIcon />
                Importar CSV
              </Button>
              <Button onClick={() => setCreateOpen(true)}>
                <PlusIcon />
                Nuevo producto
              </Button>
            </>
          ) : null
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nombre o SKU"
            className="pl-8"
            aria-label="Buscar productos"
          />
        </div>
        <Select
          value={categoryId || "all"}
          onValueChange={(value) =>
            setCategoryId(value === "all" ? "" : (value ?? ""))
          }
          items={[
            { value: "all", label: "Todas las categorías" },
            ...categories.map((category) => ({
              value: category.id,
              label: category.name,
            })),
          ]}
        >
          <SelectTrigger className="w-56" aria-label="Filtrar por categoría">
            <SelectValue placeholder="Todas las categorías" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {rowForm.error ? (
        <p role="alert" className="text-sm text-destructive">
          {rowForm.error}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Productos</CardTitle>
          <CardDescription>
            Los cambios en el catálogo no alteran las ventas ya registradas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
              <PackageIcon className="size-8" />
              No hay productos que coincidan con el filtro.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead className="text-right">Precio</TableHead>
                  <TableHead className="text-right">IVA</TableHead>
                  <TableHead className="text-center">Variantes</TableHead>
                  <TableHead className="text-center">Recetas</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <Link
                        href={`/catalog/${product.id}`}
                        className="font-medium hover:underline"
                      >
                        {product.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {product.sku ?? "Sin SKU"}
                      </p>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {product.category?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(product.price)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatPercent(product.taxRate ?? organizationTaxRate)}
                    </TableCell>
                    <TableCell className="text-center tabular-nums">
                      {product.variants.length}
                    </TableCell>
                    <TableCell className="text-center tabular-nums">
                      {product._count.recipes}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {product.isCombo ? <Badge>Combo</Badge> : null}
                        {product.isActive ? (
                          <Badge variant="secondary">Activo</Badge>
                        ) : (
                          <Badge variant="outline">Inactivo</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Link
                          href={`/catalog/${product.id}`}
                          className={buttonVariants({
                            variant: "ghost",
                            size: "sm",
                          })}
                        >
                          Editar
                        </Link>
                        {canManage && product.isActive ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={rowForm.pending}
                            onClick={() => {
                              if (
                                !window.confirm(
                                  `¿Desactivar "${product.name}"? Dejará de aparecer en el punto de venta.`
                                )
                              ) {
                                return
                              }
                              rowForm.run(() => deactivateProduct(product.id))
                            }}
                          >
                            {rowForm.pending ? (
                              <Loader2Icon className="animate-spin" />
                            ) : null}
                            Desactivar
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {canManage ? (
        <>
          <ProductCreateDialog
            open={createOpen}
            onOpenChange={setCreateOpen}
            categories={categories}
            ingredients={ingredients}
          />
          <CategoryDialog
            open={categoriesOpen}
            onOpenChange={setCategoriesOpen}
            categories={categories}
          />
          <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
        </>
      ) : null}
    </div>
  )
}
