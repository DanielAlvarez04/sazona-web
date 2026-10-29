"use client"

import { useEffect, useState } from "react"
import { BoxesIcon, HistoryIcon } from "lucide-react"

import { BulkIngredientsDialog } from "@/components/inventory/bulk-ingredients-dialog"
import { ImportIngredientsDialog } from "@/components/inventory/import-ingredients-dialog"
import { IngredientDialog } from "@/components/inventory/ingredient-dialog"
import { IngredientsTable } from "@/components/inventory/ingredients-table"
import { InventorySummary } from "@/components/inventory/inventory-summary"
import { KardexTable } from "@/components/inventory/kardex-table"
import { listIngredientCategories, listIngredientLocations } from "@/app/(app)/inventory/actions"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  type IngredientCategory,
  type IngredientLocation,
  type Ingredient,
  type InventoryMovement,
} from "@/lib/catalog"
import type { InventoryReport } from "@/lib/dashboard"
import { type Branch } from "@/lib/branches"

interface InventoryClientProps {
  initialIngredients: Ingredient[]
  initialMovements: InventoryMovement[]
  inventoryReport: InventoryReport | null
  branches: Branch[]
  canManage: boolean
  initialBranch: Branch | null
}

export function InventoryClient({
  initialIngredients,
  initialMovements,
  inventoryReport,
  branches,
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
      <Tabs defaultValue="inventario" className="gap-4">
        <TabsList>
          <TabsTrigger type="button" value="inventario">
            <BoxesIcon className="size-4" />
            Inventario
          </TabsTrigger>
          <TabsTrigger type="button" value="kardex">
            <HistoryIcon className="size-4" />
            Kardex
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inventario" keepMounted>
          <div className="flex flex-col gap-4">
            <InventorySummary
              ingredients={initialIngredients}
              report={inventoryReport}
              branch={branch}
              branches={branches}
            />
            <IngredientsTable
              idPrefix="ingredients"
              ingredients={initialIngredients}
              branch={branch}
              global={branch === null}
              canManage={canManage}
              onCreate={() => setCreating(true)}
              onBulkCreate={() => setBulkCreating(true)}
              onImportCsv={() => setImportingCsv(true)}
              onEdit={(ingredient) => setEditing(ingredient)}
              categories={categories}
              locations={locations}
            />
          </div>
        </TabsContent>

        <TabsContent value="kardex" keepMounted>
          <KardexTable movements={initialMovements} branch={branch} />
        </TabsContent>
      </Tabs>

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
        <BulkIngredientsDialog
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
        <ImportIngredientsDialog
          open
          onOpenChange={(open) => {
            if (!open) setImportingCsv(false)
          }}
          branchName={branch?.name ?? null}
          existingNames={initialIngredients.map((ingredient) => ingredient.name)}
        />
      ) : null}
    </div>
  )
}