"use client"

import { useRouter } from "next/navigation"
import { TagsIcon } from "lucide-react"
import { toast } from "sonner"

import { setCoreCategoryGroupActive } from "@/app/(app)/settings/actions"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { FieldError } from "@/components/ui/field"
import { Switch } from "@/components/ui/switch"
import { useActionForm } from "@/hooks/use-action-form"
import type { Category, CategoryKind } from "@/lib/catalog"

function CoreGroupToggle({
  title,
  description,
  categories,
  kind,
  canManage,
  pending,
  onToggle,
}: {
  title: string
  description: string
  categories: Category[]
  kind: CategoryKind
  canManage: boolean
  pending: boolean
  onToggle: (kind: CategoryKind, checked: boolean) => void
}) {
  const allActive =
    categories.length > 0 && categories.every((category) => category.isActive)
  const anyActive = categories.some((category) => category.isActive)
  const countKey = kind === "ARTICLE" ? "items" : "recipes"
  const usage = categories.reduce(
    (total, category) => total + (category._count[countKey] ?? 0),
    0
  )
  const noun = kind === "ARTICLE" ? "artículo" : "receta"

  return (
    <section className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="text-sm font-medium">{title}</h3>
          <p className="text-xs text-muted-foreground">{description}</p>
          <p className="text-xs text-muted-foreground">
            {categories.length} categoría{categories.length === 1 ? "" : "s"} ·{" "}
            {usage} {noun}
            {usage === 1 ? "" : "s"} con categoría core
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {allActive ? "Activas" : anyActive ? "Parciales" : "Inactivas"}
          </span>
          <Switch
            aria-label={`${allActive ? "Desactivar" : "Activar"} ${title.toLowerCase()}`}
            checked={allActive}
            disabled={!canManage || pending || categories.length === 0}
            onCheckedChange={(checked) => onToggle(kind, checked)}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {categories.map((category) => (
          <Badge
            key={category.id}
            variant={category.isActive ? "secondary" : "outline"}
          >
            {category.name}
          </Badge>
        ))}
      </div>
    </section>
  )
}

export function CatalogCategoriesCard({
  articleCategories,
  recipeCategories,
  canManage,
}: {
  articleCategories: Category[]
  recipeCategories: Category[]
  canManage: boolean
}) {
  const router = useRouter()
  const form = useActionForm(() => router.refresh())

  const coreArticles = articleCategories.filter((category) => category.isCore)
  const coreRecipes = recipeCategories.filter((category) => category.isCore)

  function handleToggle(kind: CategoryKind, checked: boolean) {
    const categories = kind === "ARTICLE" ? coreArticles : coreRecipes
    const countKey = kind === "ARTICLE" ? "items" : "recipes"
    const usage = categories.reduce(
      (total, category) => total + (category._count[countKey] ?? 0),
      0
    )
    const noun = kind === "ARTICLE" ? "artículo(s)" : "receta(s)"

    if (
      !checked &&
      !window.confirm(
        usage > 0
          ? `¿Desactivar todas las categorías de ${kind === "ARTICLE" ? "artículos" : "recetas"}? Se quitará la categoría a ${usage} ${noun}.`
          : `¿Desactivar todas las categorías de ${kind === "ARTICLE" ? "artículos" : "recetas"}?`
      )
    ) {
      return
    }

    form.run(() =>
      setCoreCategoryGroupActive(kind, checked).then((result) => {
        if (result.ok) {
          toast.success(
            checked
              ? "Categorías activadas"
              : "Categorías desactivadas"
          )
        }
        return result
      })
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TagsIcon className="size-4" />
          Categorías core del catálogo
        </CardTitle>
        <CardDescription>
          Activa o desactiva de una vez todas las categorías compartidas de
          artículos o de recetas. Al desactivarlas, se quitan de los registros
          que las usaban.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <CoreGroupToggle
          title="Categorías de artículos"
          description="Se aplican a los artículos vendibles del catálogo."
          categories={coreArticles}
          kind="ARTICLE"
          canManage={canManage}
          pending={form.pending}
          onToggle={handleToggle}
        />

        <CoreGroupToggle
          title="Categorías de recetas"
          description="Se aplican a recetas y preparaciones."
          categories={coreRecipes}
          kind="RECIPE"
          canManage={canManage}
          pending={form.pending}
          onToggle={handleToggle}
        />

        {!canManage ? (
          <p className="text-xs text-muted-foreground">
            Solo un administrador o encargado de catálogo puede cambiar las
            categorías.
          </p>
        ) : null}

        {form.error ? <FieldError>{form.error}</FieldError> : null}
      </CardContent>
    </Card>
  )
}
