"use client"

import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import {
  ArrowLeftRightIcon,
  ListPlusIcon,
  Loader2Icon,
  PackageIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  TriangleAlertIcon,
} from "lucide-react"

import { deactivateIngredient, getEquivalences } from "@/app/(app)/inventory/actions"
import { AdjustStockDialog } from "@/components/inventory/adjust-stock-dialog"
import { BulkIngredientsSheet } from "@/components/inventory/bulk-ingredients-sheet"
import { EquivalencesDialog } from "@/components/inventory/equivalences-dialog"
import { IngredientDialog } from "@/components/inventory/ingredient-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import {
  formatDateTime,
  formatQuantity,
  MOVEMENT_LABELS,
  unitLabel,
  type Equivalence,
  type Ingredient,
  type InventoryMovement,
  type StockAlert,
} from "@/lib/catalog"

const STATUS_ALL = "all"
const STATUS_LOW = "low"
const STATUS_INACTIVE = "inactive"

export function InventoryView({
  ingredients,
  alerts,
  movements,
  canManage,
}: {
  ingredients: Ingredient[]
  alerts: StockAlert[]
  movements: InventoryMovement[]
  canManage: boolean
}) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState(STATUS_ALL)
  const [creating, setCreating] = useState(false)
  const [bulkCreating, setBulkCreating] = useState(false)
  const [editing, setEditing] = useState<Ingredient | null>(null)
  const [adjusting, setAdjusting] = useState<Ingredient | null>(null)
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
  const rowForm = useActionForm(() => router.refresh())

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
          movement.ingredient.id !== movementIngredientId
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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Inventario</h2>
          <p className="text-sm text-muted-foreground">
            {ingredients.length} ingrediente(s) ·{" "}
            {alerts.length} bajo mínimo
          </p>
        </div>

        {canManage ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setBulkCreating(true)}>
              <ListPlusIcon />
              Añadir varios
            </Button>
            <Button onClick={() => setCreating(true)}>
              <PlusIcon />
              Nuevo ingrediente
            </Button>
          </div>
        ) : null}
      </div>

      {alerts.length > 0 ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <TriangleAlertIcon className="size-4" />
              Stock bajo mínimo
            </CardTitle>
            <CardDescription>
              Estos ingredientes pueden agotarse antes del siguiente pedido.
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
                    {unitLabel(alert.baseUnit)} · faltan{" "}
                    <span className="font-medium text-destructive">
                      {formatQuantity(alert.deficit)} {unitLabel(alert.baseUnit)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar ingrediente"
            className="pl-8"
            aria-label="Buscar ingredientes"
          />
        </div>
        <Select
          value={status}
          onValueChange={(value) => setStatus(value ?? STATUS_ALL)}
          items={[
            { value: STATUS_ALL, label: "Todos" },
            { value: STATUS_LOW, label: "Solo bajo mínimo" },
            { value: STATUS_INACTIVE, label: "Solo inactivos" },
          ]}
        >
          <SelectTrigger className="w-52" aria-label="Filtrar por estado">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={STATUS_ALL}>Todos</SelectItem>
            <SelectItem value={STATUS_LOW}>Solo bajo mínimo</SelectItem>
            <SelectItem value={STATUS_INACTIVE}>Solo inactivos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {rowForm.error ? (
        <p role="alert" className="text-sm text-destructive">
          {rowForm.error}
        </p>
      ) : null}

      {equivalencesError ? (
        <p role="alert" className="text-sm text-destructive">
          {equivalencesError}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Ingredientes</CardTitle>
          <CardDescription>
            El stock se modifica solo con ajustes auditables desde el kardex.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
              <PackageIcon className="size-8" />
              No hay ingredientes que coincidan con el filtro.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ingrediente</TableHead>
                  <TableHead>Unidad</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right">Mínimo</TableHead>
                  <TableHead className="text-center">Recetas</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((ingredient) => (
                  <TableRow key={ingredient.id}>
                    <TableCell>
                      <span className="font-medium">{ingredient.name}</span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {unitLabel(ingredient.baseUnit)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatQuantity(ingredient.currentStock)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatQuantity(ingredient.minStock)}
                    </TableCell>
                    <TableCell className="text-center tabular-nums">
                      {ingredient._count?.recipeIngredients ?? 0}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {ingredient.isLowStock ? (
                          <Badge variant="destructive">Bajo stock</Badge>
                        ) : (
                          <Badge variant="secondary">Suficiente</Badge>
                        )}
                        {ingredient.isActive ? null : (
                          <Badge variant="outline">Inactivo</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={loadingEquivalencesId === ingredient.id}
                          onClick={() => void openEquivalences(ingredient)}
                        >
                          {loadingEquivalencesId === ingredient.id ? (
                            <Loader2Icon className="animate-spin" />
                          ) : (
                            <ArrowLeftRightIcon />
                          )}
                          Equivalencias
                        </Button>

                        {canManage ? (
                          <>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setAdjusting(ingredient)}
                            >
                              Ajustar
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Editar ${ingredient.name}`}
                              onClick={() => setEditing(ingredient)}
                            >
                              <PencilIcon />
                            </Button>
                          </>
                        ) : null}

                        {canManage && ingredient.isActive ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={rowForm.pending}
                            onClick={() => {
                              if (
                                !window.confirm(
                                  `¿Desactivar "${ingredient.name}"? Dejará de estar disponible para recetas y ajustes.`
                                )
                              ) {
                                return
                              }
                              rowForm.run(() =>
                                deactivateIngredient(ingredient.id)
                              )
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
                      <TableCell>{movement.ingredient.name}</TableCell>
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
                        {unitLabel(movement.ingredient.baseUnit)}
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
          {bulkCreating ? (
            <BulkIngredientsSheet
              open
              onOpenChange={(open) => {
                if (!open) setBulkCreating(false)
              }}
            />
          ) : null}

          {creating ? (
            <IngredientDialog
              open
              onOpenChange={(open) => {
                if (!open) setCreating(false)
              }}
              ingredient={null}
            />
          ) : null}

          {editing ? (
            <IngredientDialog
              open
              onOpenChange={(open) => {
                if (!open) setEditing(null)
              }}
              ingredient={editing}
            />
          ) : null}

          {adjusting ? (
            <AdjustStockDialog
              open
              onOpenChange={(open) => {
                if (!open) setAdjusting(null)
              }}
              ingredient={adjusting}
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
