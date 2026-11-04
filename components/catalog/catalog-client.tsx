"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import {
  BoxesIcon,
  FlaskConicalIcon,
  LayersIcon,
  ListChecksIcon,
  Trash2Icon,
  UnlinkIcon,
} from "lucide-react"
import { toast } from "sonner"

import {
  activateItem,
  deactivateItem,
  deleteItems,
  deleteRecipe,
  unpublishRecipe,
  updateRecipe,
} from "@/app/(app)/catalog/actions"
import { ArticleDialog } from "@/components/catalog/article-dialog"
import { ArticlesTable } from "@/components/catalog/articles-table"
import { CatalogSummary } from "@/components/catalog/catalog-summary"
import { CategoryDialog } from "@/components/catalog/category-dialog"
import { CombosPanel } from "@/components/catalog/combos-panel"
import { ImportDialog } from "@/components/catalog/import-dialog"
import { OptionGroupsPanel } from "@/components/catalog/option-groups-panel"
import { ProduceDialog } from "@/components/catalog/produce-dialog"
import { RecipesTable } from "@/components/catalog/recipes-table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useActionForm } from "@/hooks/use-action-form"
import type { Branch } from "@/lib/branches"
import type {
  ArticleListItem,
  Category,
  Ingredient,
  OptionGroup,
  OptionGroupPreset,
  Recipe,
} from "@/lib/catalog"

export function CatalogClient({
  recipes,
  articles,
  articleCategories,
  recipeCategories,
  ingredients,
  optionGroups,
  optionPresets,
  canManage,
  branch,
}: {
  recipes: Recipe[]
  articles: ArticleListItem[]
  articleCategories: Category[]
  recipeCategories: Category[]
  ingredients: Ingredient[]
  optionGroups: OptionGroup[]
  optionPresets: OptionGroupPreset[]
  canManage: boolean
  branch: Branch | null
}) {
  const router = useRouter()
  const rowForm = useActionForm(() => router.refresh())
  const regularArticles = articles.filter((article) => !article.isCombo)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<"article" | "recipe">("article")
  const [editingArticle, setEditingArticle] = useState<ArticleListItem | null>(
    null
  )
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null)
  const [publishIntent, setPublishIntent] = useState(false)
  const [producing, setProducing] = useState<Recipe | null>(null)

  const [categoriesOpen, setCategoriesOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  // Confirmación de acciones destructivas sobre recetas.
  const [confirmRecipe, setConfirmRecipe] = useState<{
    kind: "unpublish" | "delete"
    recipe: Recipe
  } | null>(null)

  function openNewRecipe() {
    setDialogMode("recipe")
    setEditingArticle(null)
    setEditingRecipe(null)
    setPublishIntent(false)
    setDialogOpen(true)
  }

  function openRecipe(recipe: Recipe, publish = false) {
    setDialogMode("recipe")
    setEditingRecipe(recipe)
    setEditingArticle(
      recipe.itemId
        ? (articles.find((article) => article.id === recipe.itemId) ?? null)
        : null
    )
    setPublishIntent(publish || Boolean(recipe.itemId))
    setDialogOpen(true)
  }

  function openNewArticle() {
    setDialogMode("article")
    setEditingArticle(null)
    setEditingRecipe(null)
    setPublishIntent(true)
    setDialogOpen(true)
  }

  function openArticle(article: ArticleListItem) {
    setDialogMode("article")
    setEditingArticle(article)
    setEditingRecipe(
      recipes.find(
        (recipe) => recipe.itemId === article.id && !recipe.variantId
      ) ?? null
    )
    setPublishIntent(true)
    setDialogOpen(true)
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
    setConfirmRecipe({ kind: "unpublish", recipe })
  }

  function handleDeleteRecipe(recipe: Recipe) {
    if (recipe.itemId) {
      toast.error("Despublica la receta antes de eliminarla")
      return
    }

    setConfirmRecipe({ kind: "delete", recipe })
  }

  /** Ejecuta la acción confirmada en el `AlertDialog`. */
  function confirmRecipeAction() {
    const pending = confirmRecipe
    if (!pending) return

    if (pending.kind === "unpublish") {
      rowForm.run(() =>
        unpublishRecipe(pending.recipe.id).then((result) => {
          if (result.ok) toast.success("Artículo desvinculado")
          return result
        })
      )
      return
    }

    rowForm.run(() =>
      deleteRecipe(pending.recipe.id).then((result) => {
        if (result.ok) toast.success("Receta eliminada")
        return result
      })
    )
  }

  function handleDeactivateArticle(article: ArticleListItem): Promise<boolean> {
    return rowForm.run(() =>
      deactivateItem(article.id).then((result) => {
        if (result.ok) {
          toast.success("Artículo desactivado")
        } else {
          toast.error(result.message ?? "No se pudo desactivar el artículo")
        }
        return result
      })
    )
  }

  function handleActivateArticle(article: ArticleListItem): Promise<boolean> {
    return rowForm.run(() =>
      activateItem(article.id).then((result) => {
        if (result.ok) {
          toast.success("Artículo activado")
        } else {
          toast.error(result.message ?? "No se pudo activar el artículo")
        }
        return result
      })
    )
  }

  function handleDeleteArticles(
    targets: ArticleListItem[]
  ): Promise<boolean> {
    const ids = targets.map((article) => article.id)

    return rowForm.run(() =>
      deleteItems(ids).then((result) => {
        if (result.ok) {
          toast.success(
            ids.length === 1
              ? "Artículo eliminado"
              : `${result.data?.deletedCount ?? ids.length} artículos eliminados`
          )
        } else {
          toast.error(result.message ?? "No se pudieron eliminar los artículos")
        }
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
          <TabsTrigger type="button" value="combos">
            <LayersIcon className="size-4" />
            Combos
          </TabsTrigger>
          <TabsTrigger type="button" value="grupos-opciones">
            <ListChecksIcon className="size-4" />
            Grupos de opciones
          </TabsTrigger>
        </TabsList>

        <TabsContent value="articulos" keepMounted>
          <div className="flex flex-col gap-4">
            <CatalogSummary mode="articles" recipes={recipes} articles={regularArticles} />
            {rowForm.error ? (
              <p role="alert" className="text-sm text-destructive">
                {rowForm.error}
              </p>
            ) : null}
            <ArticlesTable
              articles={regularArticles}
              categories={articleCategories}
              canManage={canManage}
              onCreate={openNewArticle}
              onEdit={openArticle}
              onActivate={handleActivateArticle}
              onDeactivate={handleDeactivateArticle}
              onDelete={handleDeleteArticles}
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

        <TabsContent value="combos" keepMounted>
          <CombosPanel
            combos={articles.filter((article) => article.isCombo)}
            products={articles.filter((article) => !article.isCombo)}
            categories={articleCategories}
            optionGroups={optionGroups}
            optionPresets={optionPresets}
            canManage={canManage}
            onActivate={handleActivateArticle}
            onDeactivate={handleDeactivateArticle}
            onDelete={handleDeleteArticles}
          />
        </TabsContent>

        <TabsContent value="grupos-opciones" keepMounted>
          <OptionGroupsPanel
            groups={optionGroups}
            presets={optionPresets}
            canManage={canManage}
          />
        </TabsContent>
      </Tabs>

      {canManage && dialogOpen ? (
        <ArticleDialog
          open
          onOpenChange={(open) => {
            if (!open) {
              setDialogOpen(false)
              setPublishIntent(false)
            }
          }}
          mode={dialogMode}
          article={editingArticle}
          recipe={editingRecipe}
          categories={articleCategories}
          recipeCategories={recipeCategories}
          ingredients={ingredients}
          optionGroups={optionGroups}
          optionPresets={optionPresets}
          initialArticle={publishIntent}
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

      <AlertDialog
        open={confirmRecipe !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmRecipe(null)
        }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogMedia
              className={
                confirmRecipe?.kind === "delete"
                  ? "bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive"
                  : undefined
              }
            >
              {confirmRecipe?.kind === "delete" ? (
                <Trash2Icon />
              ) : (
                <UnlinkIcon />
              )}
            </AlertDialogMedia>
            <AlertDialogTitle>
              {confirmRecipe?.kind === "delete"
                ? "Eliminar receta"
                : "Quitar de artículos"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmRecipe?.kind === "delete"
                ? `¿Eliminar la receta «${confirmRecipe.recipe.name}»? Esta acción no se puede deshacer.`
                : `¿Quitar «${confirmRecipe?.recipe.name ?? ""}» de artículos? La receta seguirá existiendo.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant={
                confirmRecipe?.kind === "delete" ? "destructive" : "default"
              }
              onClick={confirmRecipeAction}
            >
              {confirmRecipe?.kind === "delete" ? "Eliminar" : "Quitar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
