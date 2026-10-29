"use client"

import { useRouter } from "next/navigation"
import { useMemo, useState, useEffect } from "react"
import { toast } from "sonner"
import {
  ArrowLeftRightIcon,
  ChevronDownIcon,
  FileTextIcon,
  ListPlusIcon,
  Loader2Icon,
  MinusIcon,
  PackageIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  TriangleAlertIcon,
} from "lucide-react"

import { adjustStock, deactivateIngredient, getEquivalences, listIngredientCategories, listIngredientLocations } from "@/app/(app)/inventory/actions"
import { AdjustStockDialog } from "@/components/inventory/adjust-stock-dialog"
import { BulkIngredientsDialog } from "@/components/inventory/bulk-ingredients-dialog"
import { EquivalencesDialog } from "@/components/inventory/equivalences-dialog"
import { ImportIngredientsDialog } from "@/components/inventory/import-ingredients-dialog"
import { IngredientDialog } from "@/components/inventory/ingredient-dialog"
import { IngredientsTable } from "@/components/inventory/ingredients-table"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
  formatDateTime,
  formatQuantity,
  MOVEMENT_LABELS,
  unitLabel,
  type Equivalence,
  type Ingredient,
  type IngredientCategory,
  type IngredientLocation,
  type InventoryMovement,
  type StockAlert,
  type UnitCode,
} from "@/lib/catalog"

const STATUS_ALL = "all"
const STATUS_LOW = "low"
const STATUS_INACTIVE = "inactive"

export function InventoryView({
  ingredients,
  alerts,
  movements,
  canManage,
  branch,
}: {
  ingredients: Ingredient[]
  alerts: StockAlert[]
  movements: InventoryMovement[]
  canManage: boolean
  /** Sucursal activa; `null` = vista consolidada. */
  branch: Branch | null
}) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState(STATUS_ALL)
  const [creating, setCreating] = useState(false)
  const [bulkCreating, setBulkCreating] = useState(false)
  const [importingCsv, setImportingCsv] = useState(false)
  const [editing, setEditing] = useState<Ingredient | null>(null)
  const [adjusting, setAdjusting] = useState<{ ingredient: Ingredient; type: "add" | "subtract" } | null>(null)
  const [adjustingPending, setAdjustingPending] = useState(false)
  const [equivalences, setEquivalences] = useState<{
    ingredient: Ingredient
    items: Equivalence[]
  } | null>(null)
  const [loadingEquivalencesId, setLoadingEquivalencesId] = useState<
    string | null
  >(null)
  const [equivalencesError, setEquivalencesError] = useState<string | null>(
    null
  )
  const [categories, setCategories] = useState<IngredientCategory[]>([])
  const [locations, setLocations] = useState<IngredientLocation[]>([])
  const rowForm = useActionForm(() => router.refresh())

  // Cargar categorías y ubicaciones al montar
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
        // Silencioso - si falla, los selects simplemente estarán vacíos
      }
    }
    loadCategoriesAndLocations()
  }, [])

  async function openEquivalences(ingredient: Ingredient) {
    setEquivalencesError(null)
    setLoadingEquivalencesId(ingredient.id)

    const result = await getEquivalences(ingredient.id)

    setLoadingEquivalencesId(null)

    if (!result.ok) {
      setEquivalencesError(
        result.message ?? "No se pudieron cargar las equivalencias"
      )
      return
    }

    setEquivalences({ ingredient, items: result.data ?? [] })
  }

  async function handleAdjustSubmit(quantity: string, reason: string, unit?: UnitCode) {
    if (!adjusting?.ingredient || !quantity || !reason) return

    setAdjustingPending(true)
    try {
      const result = await adjustStock({
        ingredientId: adjusting.ingredient.id,
        quantity,
        unit,
        reason,
      })

      if (result?.ok) {
        toast.success("Stock ajustado correctamente")
        setAdjusting(null)
      } else {
        toast.error(result?.message ?? "No se pudo ajustar el stock")
      }
    } catch {
      toast.error("No se pudo ajustar el stock")
    } finally {
      setAdjustingPending(false)
    }
  }

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()

    return ingredients.filter((ingredient) => {
      if (needle && !ingredient.name.toLowerCase().includes(needle)) {
        return false
      }
      if (status === STATUS_LOW) return ingredient.isLowStock
      if (status === STATUS_INACTIVE) return !ingredient.isActive
      return true
    })
  }, [ingredients, search, status])

  const movementIngredients = useMemo(
    () =>
      [...ingredients].sort((a, b) => a.name.localeCompare(b.name, "es")),
    [ingredients]
  )

  const [movementIngredientId, setMovementIngredientId] = useState("")
  const [movementType, setMovementType] = useState("")

  const filteredMovements = useMemo(
    () =>
      movements.filter((movement) => {
        if (
          movementIngredientId &&
          movement.ingredient?.id !== movementIngredientId
        ) {
          return false
        }
        if (movementType && movement.type !== movementType) return false
        return true
      }),
    [movements, movementIngredientId, movementType]
  )

  return (
    <div className="@container/main flex flex-1 flex-col gap-4 px-4 py-6 lg:px-6">
      <PageHeader
        title="Inventario"
        description={
          <>
            {ingredients.length} producto(s) · {alerts.length} bajo mínimo
            {branch
              ? ` · Stock de ${branch.name}`
              : " · Stock consolidado de la organización"}
          </>
        }
        branch={branch}
        actions={
          canManage ? (
            <ButtonGroup>
              <Button onClick={() => setCreating(true)}>
                <PlusIcon className="mr-2 h-4 w-4" />
                Nuevo producto
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button className="pl-2 pr-2">
                      <ChevronDownIcon className="h-4 w-4" />
                    </Button>
                  }
                >
                  <ChevronDownIcon className="h-4 w-4" />
                  <span className="sr-only">Más opciones</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => setBulkCreating(true)}
                    className="flex items-center gap-2"
                  >
                    <ListPlusIcon className="h-4 w-4" />
                    Añadir varios
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setImportingCsv(true)}
                    className="flex items-center gap-2"
                  >
                    <FileTextIcon className="h-4 w-4" />
                    Importar CSV
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </ButtonGroup>
          ) : null
        }
      />

      {alerts.length > 0 ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <TriangleAlertIcon className="size-4" />
              Stock bajo mínimo
            </CardTitle>
            <CardDescription>
              {branch
                ? `Estos ingredientes pueden agotarse en ${branch.name} antes del siguiente pedido.`
                : "Estos ingredientes pueden agotarse antes del siguiente pedido."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-1 text-sm">
              {alerts.map((alert) => (
                <li
                  key={alert.id}
                  className="flex flex-wrap items-center justify-between gap-2"
                >
                  <span className="font-medium">{alert.name}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {formatQuantity(alert.currentStock)} /{" "}
                    {formatQuantity(alert.minStock)}{" "}
                    {unitLabel(alert.displayUnit)} · faltan{" "}
                    <span className="font-medium text-destructive">
                      {formatQuantity(alert.deficit)} {unitLabel(alert.displayUnit)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <IngredientsTable
        idPrefix="ingredients"
        ingredients={ingredients}
        branch={branch}
        canManage={canManage}
        onCreate={() => setCreating(true)}
        onBulkCreate={() => setBulkCreating(true)}
        onImportCsv={() => setImportingCsv(true)}
        onEdit={(ingredient) => setEditing(ingredient)}
        categories={categories}
        locations={locations}
      />

      <Card>
        <CardHeader>
          <CardTitle>Kardex de movimientos</CardTitle>
          <CardDescription>
            Últimos 50 movimientos. Cada ajuste guarda cantidad, saldo
            resultante, motivo y usuario.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <Select
              value={movementIngredientId || "all"}
              onValueChange={(value) =>
                setMovementIngredientId(value === "all" ? "" : (value ?? ""))
              }
              items={[
                { value: "all", label: "Todos los ingredientes" },
                ...movementIngredients.map((ingredient) => ({
                  value: ingredient.id,
                  label: ingredient.name,
                })),
              ]}
            >
              <SelectTrigger
                className="w-60"
                aria-label="Filtrar movimientos por ingrediente"
              >
                <SelectValue placeholder="Todos los ingredientes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los ingredientes</SelectItem>
                {movementIngredients.map((ingredient) => (
                  <SelectItem key={ingredient.id} value={ingredient.id}>
                    {ingredient.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={movementType || "all"}
              onValueChange={(value) =>
                setMovementType(value === "all" ? "" : (value ?? ""))
              }
              items={[
                { value: "all", label: "Todos los tipos" },
                { value: "ADJUSTMENT", label: MOVEMENT_LABELS.ADJUSTMENT },
                { value: "CONSUMPTION", label: MOVEMENT_LABELS.CONSUMPTION },
                { value: "RETURN", label: MOVEMENT_LABELS.RETURN },
              ]}
            >
              <SelectTrigger
                className="w-48"
                aria-label="Filtrar movimientos por tipo"
              >
                <SelectValue placeholder="Todos los tipos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                <SelectItem value="ADJUSTMENT">
                  {MOVEMENT_LABELS.ADJUSTMENT}
                </SelectItem>
                <SelectItem value="CONSUMPTION">
                  {MOVEMENT_LABELS.CONSUMPTION}
                </SelectItem>
                <SelectItem value="RETURN">{MOVEMENT_LABELS.RETURN}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filteredMovements.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No hay movimientos que coincidan con el filtro.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Ingrediente</TableHead>
                  {branch ? null : <TableHead>Sucursal</TableHead>}
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Usuario</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMovements.map((movement) => {
                  const amount = Number(movement.quantity)

                  return (
                    <TableRow key={movement.id}>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {formatDateTime(movement.createdAt)}
                      </TableCell>
                      <TableCell>{movement.ingredientName}</TableCell>
                      {branch ? null : (
                        <TableCell className="text-muted-foreground">
                          {movement.branch?.name ?? "—"}
                        </TableCell>
                      )}
                      <TableCell>
                        <Badge
                          variant={
                            movement.type === "ADJUSTMENT"
                              ? "outline"
                              : "secondary"
                          }
                        >
                          {MOVEMENT_LABELS[movement.type]}
                        </Badge>
                      </TableCell>
                      <TableCell
                        className={`text-right tabular-nums ${
                          amount < 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"
                        }`}
                      >
                        {amount > 0 ? "+" : ""}
                        {formatQuantity(movement.quantity)}{" "}
                        {unitLabel(movement.displayUnit)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {movement.stockAfter === null
                          ? "—"
                          : formatQuantity(movement.stockAfter)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {movement.reason ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {movement.user
                          ? (movement.user.name ?? movement.user.email ?? "—")
                          : "Usuario eliminado"}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {canManage ? (
        <>
          {importingCsv ? (
            <ImportIngredientsDialog
              open
              onOpenChange={(open) => {
                if (!open) setImportingCsv(false)
              }}
              branchName={branch?.name ?? null}
              existingNames={ingredients.map((ingredient) => ingredient.name)}
            />
          ) : null}

          {bulkCreating ? (
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

          {creating ? (
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

          {editing ? (
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

          {adjusting ? (
            <AdjustStockDialog
              open
              onOpenChange={(open) => {
                if (!open) setAdjusting(null)
              }}
              ingredient={adjusting.ingredient}
              onSubmit={handleAdjustSubmit}
              pending={adjustingPending}
              type={adjusting.type}
            />
          ) : null}
        </>
      ) : null}

      {equivalences ? (
        <EquivalencesDialog
          open
          onOpenChange={(open) => {
            if (!open) setEquivalences(null)
          }}
          ingredient={equivalences.ingredient}
          initialItems={equivalences.items}
          canManage={canManage}
        />
      ) : null}
    </div>
  )
}
