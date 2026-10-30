"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import {
  BoxesIcon,
  FlaskConicalIcon,
} from "lucide-react"
import { toast } from "sonner"

import {
  deactivateItem,
  deleteRecipe,
  unpublishRecipe,
  updateRecipe,
} from "@/app/(app)/catalog/actions"
import { ArticleDialog } from "@/components/catalog/article-dialog"
import { ArticlesTable } from "@/components/catalog/articles-table"
import { CatalogSummary } from "@/components/catalog/catalog-summary"
import { CategoryDialog } from "@/components/catalog/category-dialog"
import { ImportDialog } from "@/components/catalog/import-dialog"
import { ProduceDialog } from "@/components/catalog/produce-dialog"
import { RecipeDialog } from "@/components/catalog/recipe-dialog"
import { RecipesTable } from "@/components/catalog/recipes-table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useActionForm } from "@/hooks/use-action-form"
import type { Branch } from "@/lib/branches"
import type {
  ArticleListItem,
  Category,
  Ingredient,
  Recipe,
} from "@/lib/catalog"

export function CatalogClient({
  recipes,
  articles,
  articleCategories,
  recipeCategories,
  ingredients,
  canManage,
  branch,
}: {
  recipes: Recipe[]
  articles: ArticleListItem[]
  articleCategories: Category[]
  recipeCategories: Category[]
  ingredients: Ingredient[]
  canManage: boolean
  branch: Branch | null
}) {
  const router = useRouter()
  const rowForm = useActionForm(() => router.refresh())

  const [recipeDialogOpen, setRecipeDialogOpen] = useState(false)
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null)
  const [publishIntent, setPublishIntent] = useState(false)
  const [producing, setProducing] = useState<Recipe | null>(null)

  const [articleDialogOpen, setArticleDialogOpen] = useState(false)
  const [editingArticle, setEditingArticle] = useState<ArticleListItem | null>(
    null
  )

  const [categoriesOpen, setCategoriesOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  function openNewRecipe() {
    setEditingRecipe(null)
    setPublishIntent(false)
    setRecipeDialogOpen(true)
  }

  function openRecipe(recipe: Recipe, publish = false) {
    setEditingRecipe(recipe)
    setPublishIntent(publish)
    setRecipeDialogOpen(true)
  }

  function openNewArticle() {
    setEditingArticle(null)
    setArticleDialogOpen(true)
  }

  function openArticle(article: ArticleListItem) {
    setEditingArticle(article)
    setArticleDialogOpen(true)
  }

  function toggleRecipeActive(recipe: Recipe) {
    rowForm.run(() =>
      updateRecipe(recipe.id, { isActive: !recipe.isActive }).then((result) => {
        if (result.ok) {
          toast.success(
            recipe.isActive ? "Receta desactivada" : "Receta activada"
          )
        }
        return result
      })
    )
  }

  function handleUnpublish(recipe: Recipe) {
    if (
      !window.confirm(
        `¿Quitar "${recipe.name}" de artículos? La receta seguirá existiendo.`
      )
    ) {
      return
    }

    rowForm.run(() =>
      unpublishRecipe(recipe.id).then((result) => {
        if (result.ok) toast.success("Artículo desvinculado")
        return result
      })
    )
  }

  function handleDeleteRecipe(recipe: Recipe) {
    if (recipe.itemId) {
      toast.error("Despublica la receta antes de eliminarla")
      return
    }

    if (!window.confirm(`¿Eliminar la receta "${recipe.name}"?`)) return

    rowForm.run(() =>
      deleteRecipe(recipe.id).then((result) => {
        if (result.ok) toast.success("Receta eliminada")
        return result
      })
    )
  }

  function handleDeactivateArticle(article: ArticleListItem) {
    if (
      !window.confirm(
        `¿Desactivar "${article.name}"? Dejará de aparecer en el punto de venta.`
      )
    ) {
      return
    }

    rowForm.run(() =>
      deactivateItem(article.id).then((result) => {
        if (result.ok) toast.success("Artículo desactivado")
        return result
      })
    )
  }

  return (
    <div className="@container/main flex flex-1 flex-col gap-4 px-4 py-6 lg:px-6">
      <Tabs defaultValue="articulos" className="gap-4">
        <TabsList>
          <TabsTrigger type="button" value="articulos">
            <BoxesIcon className="size-4" />
            Artículos
          </TabsTrigger>
          <TabsTrigger type="button" value="recetas">
            <FlaskConicalIcon className="size-4" />
            Recetas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="articulos" keepMounted>
          <div className="flex flex-col gap-4">
            <CatalogSummary mode="articles" recipes={recipes} articles={articles} />
            {rowForm.error ? (
              <p role="alert" className="text-sm text-destructive">
                {rowForm.error}
              </p>
            ) : null}
            <ArticlesTable
              articles={articles}
              categories={articleCategories}
              canManage={canManage}
              onCreate={openNewArticle}
              onEdit={openArticle}
              onDeactivate={handleDeactivateArticle}
              onManageCategories={() => setCategoriesOpen(true)}
              onImportCsv={() => setImportOpen(true)}
            />
          </div>
        </TabsContent>

        <TabsContent value="recetas" keepMounted>
          <div className="flex flex-col gap-4">
            <CatalogSummary mode="recipes" recipes={recipes} articles={articles} />
            {rowForm.error ? (
              <p role="alert" className="text-sm text-destructive">
                {rowForm.error}
              </p>
            ) : null}
            <RecipesTable
              recipes={recipes}
              categories={recipeCategories}
              canManage={canManage}
              onCreate={openNewRecipe}
              onEdit={(recipe) => openRecipe(recipe)}
              onPublish={(recipe) => openRecipe(recipe, true)}
              onUnpublish={handleUnpublish}
              onProduce={(recipe) => setProducing(recipe)}
              onToggleActive={toggleRecipeActive}
              onDelete={handleDeleteRecipe}
              onManageCategories={() => setCategoriesOpen(true)}
            />
          </div>
        </TabsContent>
      </Tabs>

      {canManage && recipeDialogOpen ? (
        <RecipeDialog
          open
          onOpenChange={(open) => {
            if (!open) {
              setRecipeDialogOpen(false)
              setPublishIntent(false)
            }
          }}
          recipe={editingRecipe}
          categories={recipeCategories}
          ingredients={ingredients}
          initialPublish={publishIntent}
        />
      ) : null}

      {canManage && articleDialogOpen ? (
        <ArticleDialog
          open
          onOpenChange={(open) => {
            if (!open) setArticleDialogOpen(false)
          }}
          article={editingArticle}
          categories={articleCategories}
        />
      ) : null}

      {canManage && producing ? (
        <ProduceDialog
          open
          onOpenChange={(open) => {
            if (!open) setProducing(null)
          }}
          recipe={producing}
          branchName={branch?.name ?? null}
        />
      ) : null}

      {canManage ? (
        <>
          <CategoryDialog
            open={categoriesOpen}
            onOpenChange={setCategoriesOpen}
            articleCategories={articleCategories}
            recipeCategories={recipeCategories}
          />
          <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
        </>
      ) : null}
    </div>
  )
}
