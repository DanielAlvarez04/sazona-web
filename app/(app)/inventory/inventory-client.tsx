"use client"

import { useEffect, useState } from "react"

import { BulkIngredientsSheet } from "@/components/inventory/bulk-ingredients-sheet"
import { ImportCsvSheet } from "@/components/inventory/import-csv-sheet"
import { IngredientDialog } from "@/components/inventory/ingredient-dialog"
import { IngredientsTable } from "@/components/inventory/ingredients-table"
import { listIngredientCategories, listIngredientLocations } from "@/app/(app)/inventory/actions"
import {
  type IngredientCategory,
  type IngredientLocation,
  type Ingredient,
} from "@/lib/catalog"
import { type Branch } from "@/lib/branches"

interface InventoryClientProps {
  initialIngredients: Ingredient[]
  canManage: boolean
  initialBranch: Branch | null
}

export function InventoryClient({
  initialIngredients,
  canManage,
  initialBranch,
}: InventoryClientProps) {
  const [branch] = useState<Branch | null>(initialBranch)
  const [categories, setCategories] = useState<IngredientCategory[]>([])
  const [locations, setLocations] = useState<IngredientLocation[]>([])
  const [creating, setCreating] = useState(false)
  const [bulkCreating, setBulkCreating] = useState(false)
  const [importingCsv, setImportingCsv] = useState(false)
  const [editing, setEditing] = useState<Ingredient | null>(null)

  // Cargar categorías y ubicaciones
  useEffect(() => {
    async function loadCategoriesAndLocations() {
      try {
        const [catsResult, locsResult] = await Promise.all([
          listIngredientCategories(),
          listIngredientLocations(),
        ])
        if (catsResult.ok && catsResult.data) {
          setCategories(catsResult.data)
        }
        if (locsResult.ok && locsResult.data) {
          setLocations(locsResult.data)
        }
      } catch {
        // Silencioso
      }
    }
    loadCategoriesAndLocations()
  }, [])

  return (
    <div className="@container/main flex flex-1 flex-col gap-4 px-4 py-6 lg:px-6">
      <IngredientsTable
        idPrefix="ingredients"
        ingredients={initialIngredients}
        branch={branch}
        canManage={canManage}
        onCreate={() => setCreating(true)}
        onBulkCreate={() => setBulkCreating(true)}
        onImportCsv={() => setImportingCsv(true)}
        onEdit={(ingredient) => setEditing(ingredient)}
        categories={categories}
        locations={locations}
      />

      {canManage && creating ? (
        <IngredientDialog
          open
          onOpenChange={(open) => {
            if (!open) setCreating(false)
          }}
          ingredient={null}
          categories={categories}
          locations={locations}
          branchName={branch?.name ?? null}
        />
      ) : null}

      {canManage && editing ? (
        <IngredientDialog
          open
          onOpenChange={(open) => {
            if (!open) setEditing(null)
          }}
          ingredient={editing}
          categories={categories}
          locations={locations}
          branchName={branch?.name ?? null}
        />
      ) : null}

      {canManage && bulkCreating ? (
        <BulkIngredientsSheet
          open
          onOpenChange={(open) => {
            if (!open) setBulkCreating(false)
          }}
          categories={categories}
          locations={locations}
          branchName={branch?.name ?? null}
        />
      ) : null}

      {canManage && importingCsv ? (
        <ImportCsvSheet
          open
          onOpenChange={(open) => {
            if (!open) setImportingCsv(false)
          }}
          branchName={branch?.name ?? null}
        />
      ) : null}
    </div>
  )
}