"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import {
  BlenderIcon,
  GroupIcon,
  ListChecksIcon,
  SoupIcon,
  Trash2Icon,
  UnlinkIcon,
} from "lucide-react"
import { toast } from "sonner"

import {
  activateItem,
  deactivateItem,
  deleteItems,
  deleteRecipe,
  deleteRecipes,
  unpublishRecipe,
  updateRecipe,
} from "@/app/(app)/catalog/actions"
import {
  ProductDialog,
  type ProductSaveAs,
} from "@/components/catalog/product-dialog"
import { ArticlesTable } from "@/components/catalog/articles-table"
import { CatalogSummary } from "@/components/catalog/catalog-summary"
import { CategoryDialog } from "@/components/catalog/category-dialog"
import { CombosSummary } from "@/components/catalog/combos-summary"
import { CombosTable } from "@/components/catalog/combos-table"
import { ImportDialog } from "@/components/catalog/import-dialog"
import { OptionGroupsPanel } from "@/components/catalog/option-groups-panel"
import { ProduceDialog } from "@/components/catalog/produce-dialog"
import { RecipesTable } from "@/components/catalog/recipes-table"
import { usePersistentViewMode } from "@/hooks/use-persistent-view-mode"
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
  IngredientCategory,
  OptionGroup,
  OptionGroupPreset,
  Recipe,
} from "@/lib/catalog"

export function CatalogClient({
  recipes,
  articles,
  articleCategories,
  recipeCategories,
  ingredientCategories,
  ingredients,
  optionGroups,
  optionPresets,
  canManage,
  branch,
  taxRate,
}: {
  recipes: Recipe[]
  articles: ArticleListItem[]
  articleCategories: Category[]
  recipeCategories: Category[]
  ingredientCategories: IngredientCategory[]
  ingredients: Ingredient[]
  optionGroups: OptionGroup[]
  optionPresets: OptionGroupPreset[]
  canManage: boolean
  branch: Branch | null
  /** Tasa de IVA por defecto de la organización (fracción). */
  taxRate: string
}) {
  const router = useRouter()
  const rowForm = useActionForm(() => router.refresh())
  // Los artículos archivados no se listan, pero el diálogo los necesita para
  // conservar presentaciones, opciones y precio al cambiar de chip.
  const visibleArticles = articles.filter((article) => !article.isArchived)
  const regularArticles = visibleArticles.filter((article) => !article.isCombo)

  const [tab, setTab] = useState("articulos")
  // El modo de vista se comparte entre Artículos y Recetas y se persiste entre
  // recargas para no tener que cambiarlo manualmente cada vez.
  const [viewMode, setViewMode] = usePersistentViewMode()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [initialSaveAs, setInitialSaveAs] =
    useState<ProductSaveAs>("article")
  const [editingArticle, setEditingArticle] = useState<ArticleListItem | null>(
    null
  )
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null)
  const [producing, setProducing] = useState<Recipe | null>(null)

  const [categoriesOpen, setCategoriesOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  // Confirmación de acciones destructivas sobre recetas.
  const [confirmRecipe, setConfirmRecipe] = useState<{
    kind: "unpublish" | "delete"
    recipe: Recipe
  } | null>(null)

  function openNewProduct(saveAs: ProductSaveAs) {
    setInitialSaveAs(saveAs)
    setEditingArticle(null)
    setEditingRecipe(null)
    setDialogOpen(true)
  }

  /** Artículo vinculado o borrador archivado que comparte la entrada. */
  function articleOfRecipe(recipe: Recipe): ArticleListItem | null {
    if (recipe.itemId) {
      return articles.find((article) => article.id === recipe.itemId) ?? null
    }

    if (!recipe.catalogEntryId) return null

    return (
      articles.find(
        (article) => article.catalogEntryId === recipe.catalogEntryId
      ) ?? null
    )
  }

  function openRecipe(recipe: Recipe, publish = false) {
    setEditingRecipe(recipe)
    setEditingArticle(articleOfRecipe(recipe))
    setInitialSaveAs(
      recipe.producesIngredientId
        ? "ingredient"
        : publish || recipe.itemId
          ? "article"
          : "recipe"
    )
    setDialogOpen(true)
  }

  function openArticle(article: ArticleListItem) {
    setEditingArticle(article)
    setEditingRecipe(
      recipes.find(
        (recipe) => recipe.itemId === article.id && !recipe.variantId
      ) ?? null
    )
    setInitialSaveAs("article")
    setDialogOpen(true)
  }

  function openCombo(combo: ArticleListItem) {
    setEditingArticle(combo)
    setEditingRecipe(null)
    setInitialSaveAs("combo")
    setDialogOpen(true)
  }

  function openComboById(comboId: string) {
    const combo = articles.find((article) => article.id === comboId)
    if (combo) openCombo(combo)
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

  function handleDeleteRecipes(targets: Recipe[]): Promise<boolean> {
    const ids = targets.map((recipe) => recipe.id)

    return rowForm.run(() =>
      deleteRecipes(ids).then((result) => {
        if (result.ok) {
          toast.success(
            ids.length === 1
              ? "Receta eliminada"
              : `${result.data?.deletedCount ?? ids.length} recetas eliminadas`
          )
        } else {
          toast.error(result.message ?? "No se pudieron eliminar las recetas")
        }
        return result
      })
    )
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

  function handleDeactivateCombo(combo: ArticleListItem): Promise<boolean> {
    return rowForm.run(() =>
      deactivateItem(combo.id).then((result) => {
        if (result.ok) {
          toast.success("Combo desactivado")
        } else {
          toast.error(result.message ?? "No se pudo desactivar el combo")
        }
        return result
      })
    )
  }

  function handleActivateCombo(combo: ArticleListItem): Promise<boolean> {
    return rowForm.run(() =>
      activateItem(combo.id).then((result) => {
        if (result.ok) {
          toast.success("Combo activado")
        } else {
          toast.error(result.message ?? "No se pudo activar el combo")
        }
        return result
      })
    )
  }

  function handleDeleteCombos(combos: ArticleListItem[]): Promise<boolean> {
    const ids = combos.map((combo) => combo.id)

    return rowForm.run(() =>
      deleteItems(ids).then((result) => {
        if (result.ok) {
          toast.success(
            ids.length === 1
              ? "Combo eliminado"
              : `${result.data?.deletedCount ?? ids.length} combos eliminados`
          )
        } else {
          toast.error(result.message ?? "No se pudieron eliminar los combos")
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
      <Tabs value={tab} onValueChange={setTab} className="gap-4">
        <TabsList>
          <TabsTrigger type="button" value="articulos">
            <SoupIcon className="size-4" />
            Artículos
          </TabsTrigger>
          <TabsTrigger type="button" value="recetas">
            <BlenderIcon className="size-4" />
            Recetas
          </TabsTrigger>
          <TabsTrigger type="button" value="combos">
            <GroupIcon className="size-4" />
            Combos
          </TabsTrigger>
          <TabsTrigger type="button" value="grupos-opciones">
            <ListChecksIcon className="size-4" />
            Grupos de opciones
          </TabsTrigger>
        </TabsList>

        <TabsContent value="articulos" keepMounted>
          <div className="flex flex-col gap-4">
            <CatalogSummary
              mode="articles"
              recipes={recipes}
              articles={regularArticles}
              taxRate={taxRate}
            />
            {rowForm.error ? (
              <p role="alert" className="text-sm text-destructive">
                {rowForm.error}
              </p>
            ) : null}
            <ArticlesTable
              articles={regularArticles}
              recipes={recipes}
              categories={articleCategories}
              canManage={canManage}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              taxRate={taxRate}
              onCreate={() => openNewProduct("article")}
              onEdit={openArticle}
              onActivate={handleActivateArticle}
              onDeactivate={handleDeactivateArticle}
              onDelete={handleDeleteArticles}
              onEditCombo={canManage ? openComboById : () => {}}
              onManageCategories={() => setCategoriesOpen(true)}
              onImportCsv={() => setImportOpen(true)}
            />
          </div>
        </TabsContent>

        <TabsContent value="recetas" keepMounted>
          <div className="flex flex-col gap-4">
            <CatalogSummary
              mode="recipes"
              recipes={recipes}
              articles={articles}
              taxRate={taxRate}
            />
            {rowForm.error ? (
              <p role="alert" className="text-sm text-destructive">
                {rowForm.error}
              </p>
            ) : null}
            <RecipesTable
              recipes={recipes}
              articles={articles}
              categories={recipeCategories}
              canManage={canManage}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              taxRate={taxRate}
              onCreate={() => openNewProduct("recipe")}
              onEdit={(recipe) => openRecipe(recipe)}
              onPublish={(recipe) => openRecipe(recipe, true)}
              onUnpublish={handleUnpublish}
              onProduce={(recipe) => setProducing(recipe)}
              onToggleActive={toggleRecipeActive}
              onDelete={handleDeleteRecipe}
              onDeleteMany={handleDeleteRecipes}
              onEditCombo={canManage ? openComboById : () => {}}
              onManageCategories={() => setCategoriesOpen(true)}
            />
          </div>
        </TabsContent>

        <TabsContent value="combos" keepMounted>
          <div className="flex flex-col gap-4">
            <CombosSummary
              combos={visibleArticles.filter((article) => article.isCombo)}
              recipes={recipes}
            />
            <CombosTable
              combos={visibleArticles.filter((article) => article.isCombo)}
              recipes={recipes}
              canManage={canManage}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              onCreate={() => openNewProduct("combo")}
              onEdit={openCombo}
              onActivate={handleActivateCombo}
              onDeactivate={handleDeactivateCombo}
              onDelete={handleDeleteCombos}
            />
          </div>
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
        <ProductDialog
          open
          onOpenChange={(open) => {
            if (!open) setDialogOpen(false)
          }}
          article={editingArticle}
          recipe={editingRecipe}
          initialSaveAs={initialSaveAs}
          categories={articleCategories}
          recipeCategories={recipeCategories}
          ingredientCategories={ingredientCategories}
          ingredients={ingredients}
          optionGroups={optionGroups}
          optionPresets={optionPresets}
          products={articles.filter(
            (article) => !article.isCombo && !article.isArchived
          )}
          taxRate={taxRate}
          onSaved={(saveAs) =>
            setTab(
              saveAs === "combo"
                ? "combos"
                : saveAs === "article"
                  ? "articulos"
                  : "recetas"
            )
          }
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
