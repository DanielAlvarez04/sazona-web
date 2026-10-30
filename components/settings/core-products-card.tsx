"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  EraserIcon,
  Loader2Icon,
  PackageIcon,
  SaveIcon,
} from "lucide-react"
import { toast } from "sonner"

import { saveCoreInventory } from "@/app/(app)/settings/actions"
import {
  BulkIngredientsDialog,
  type BulkIngredientInitialRow,
} from "@/components/inventory/bulk-ingredients-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  unitLabel,
  type Ingredient,
  type IngredientCategory,
  type IngredientLocation,
  type UnitCode,
} from "@/lib/catalog"
import {
  CORE_PRODUCT_GROUPS,
  CORE_PRODUCT_PRESETS,
  type CoreProductPreset,
} from "@/lib/core-products"
import { cn } from "cn"

function normalize(value: string): string {
  return value.trim().toLowerCase()
}

/**
 * Catálogo de insumos core.
 *
 * Los checkboxes marcan lo que debe existir en el inventario. Al guardar, los
 * insumos nuevos se precargan en el diálogo de alta masiva para editar
 * precios y stock; los desmarcados se retiran si no están en recetas.
 */
export function CoreProductsCard({
  ingredients,
  categories,
  locations,
  branchName,
  storageKey,
  canManage,
}: {
  /** Insumos que ya están en el inventario (activos o inactivos). */
  ingredients: Ingredient[]
  categories: IngredientCategory[]
  locations: IngredientLocation[]
  /** Sucursal activa para el stock inicial del alta masiva. */
  branchName: string | null
  /** Clave de `localStorage` para recordar los giros marcados. */
  storageKey: string
  /** Requiere permiso de inventario para guardar. */
  canManage: boolean
}) {
  const router = useRouter()

  const [selected, setSelected] = React.useState<Set<string>>(() => {
    const existing = new Map(
      ingredients.map((ingredient) => [normalize(ingredient.name), ingredient])
    )
    const initial = new Set<string>()

    for (const group of CORE_PRODUCT_GROUPS) {
      for (const product of group.products) {
        const ingredient = existing.get(normalize(product.name))
        if (ingredient?.isActive) initial.add(product.name)
      }
    }

    return initial
  })
  // Giros aplicados. Se llevan aparte de los insumos porque los paquetes se
  // solapan: un insumo seleccionado no debe marcar otros giros.
  const [activePresets, setActivePresets] = React.useState<Set<string>>(
    new Set()
  )
  const [bulkOpen, setBulkOpen] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const existing = React.useMemo(
    () => new Set(ingredients.map((ingredient) => normalize(ingredient.name))),
    [ingredients]
  )
  const ingredientByName = React.useMemo(
    () =>
      new Map(
        ingredients.map((ingredient) => [normalize(ingredient.name), ingredient])
      ),
    [ingredients]
  )
  const categoryIds = React.useMemo(
    () => new Map(categories.map((category) => [normalize(category.name), category.id])),
    [categories]
  )
  const locationIds = React.useMemo(
    () => new Map(locations.map((location) => [normalize(location.name), location.id])),
    [locations]
  )

  const catalog = React.useMemo(() => {
    const map = new Map<
      string,
      { name: string; unit: UnitCode; category: string; location: string }
    >()

    for (const group of CORE_PRODUCT_GROUPS) {
      for (const product of group.products) {
        if (map.has(product.name)) continue
        map.set(product.name, {
          name: product.name,
          unit: product.unit,
          category: group.category,
          location: product.location,
        })
      }
    }

    return map
  }, [])

  // Insumos core que ya fueron modificados (unidad, categoría, ubicación,
  // stock o costo): quedan bloqueados para no desactivarlos desde aquí.
  const locked = React.useMemo(() => {
    const result = new Set<string>()

    for (const [name, preset] of catalog) {
      const ingredient = ingredientByName.get(normalize(name))
      if (!ingredient) continue

      const modified =
        ingredient.displayUnit !== preset.unit ||
        (ingredient.category !== null &&
          (ingredient.category?.name ?? "") !== preset.category) ||
        (ingredient.location?.name ?? "") !== preset.location ||
        (ingredient.unitCost !== null && Number(ingredient.unitCost) !== 0) ||
        Number(ingredient.currentStock) !== 0 ||
        Number(ingredient.minStock) !== 0 ||
        (ingredient.maxStock !== null && Number(ingredient.maxStock) !== 0)

      if (modified) result.add(name)
    }

    return result
  }, [catalog, ingredientByName])

  /** Guarda los giros marcados para recordarlos en la próxima visita. */
  const persistPresets = React.useCallback(
    (presets: Set<string>) => {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify([...presets]))
      } catch {
        // Sin persistencia: la selección sigue funcionando en memoria.
      }
    },
    [storageKey]
  )

  // Recupera los giros guardados y vuelve a marcar sus insumos. El checkbox
  // del giro y sus insumos deben contar la misma historia al recargar; si solo
  // se restaurara el giro, quedaría marcado sin sus insumos.
  const restoredFor = React.useRef<string | null>(null)

  React.useEffect(() => {
    if (restoredFor.current === storageKey) return
    restoredFor.current = storageKey

    try {
      const raw = window.localStorage.getItem(storageKey)
      if (!raw) return

      const ids = JSON.parse(raw) as unknown
      if (!Array.isArray(ids)) return

      const restored = new Set(
        ids.filter(
          (id): id is string =>
            typeof id === "string" &&
            CORE_PRODUCT_PRESETS.some((preset) => preset.id === id)
        )
      )

      if (restored.size === 0) return

      // eslint-disable-next-line react-hooks/set-state-in-effect -- hidratar la preferencia guardada
      setActivePresets(restored)

      setSelected((current) => {
        const next = new Set(current)

        for (const preset of CORE_PRODUCT_PRESETS) {
          if (!restored.has(preset.id)) continue

          for (const name of preset.productNames) {
            // Solo se vuelven a marcar los que todavía no existen. Los que ya
            // están en el inventario muestran su estado real (activo/inactivo)
            // para no reactivar algo que el usuario quitó a propósito.
            if (existing.has(normalize(name))) continue

            next.add(name)
          }
        }

        return next
      })
    } catch {
      // localStorage puede no estar disponible; se ignora.
    }
  }, [storageKey, existing])

  // Insumos marcados que aún no están en el inventario: se precargan en el
  // alta masiva para editar precios y stock antes de crearlos.
  const newRows = React.useMemo<BulkIngredientInitialRow[]>(() => {
    const rows: BulkIngredientInitialRow[] = []

    for (const name of selected) {
      if (existing.has(normalize(name))) continue

      const product = catalog.get(name)
      if (!product) continue

      rows.push({
        name: product.name,
        displayUnit: product.unit,
        categoryId: categoryIds.get(normalize(product.category)) ?? "",
        locationId: locationIds.get(normalize(product.location)) ?? "",
      })
    }

    return rows
  }, [selected, existing, catalog, categoryIds, locationIds])

  const toggle = React.useCallback(
    (name: string, checked: boolean) => {
      if (!checked && locked.has(name)) return

      setSelected((current) => {
        const next = new Set(current)
        if (checked) next.add(name)
        else next.delete(name)
        return next
      })
    },
    [locked]
  )

  const applyPreset = React.useCallback(
    (preset: CoreProductPreset, checked: boolean) => {
      const nextPresets = new Set(activePresets)

      if (checked) nextPresets.add(preset.id)
      else nextPresets.delete(preset.id)

      setActivePresets(nextPresets)
      // Se guarda al instante: los insumos del giro se restauran con él.
      persistPresets(nextPresets)

      setSelected((current) => {
        const next = new Set(current)

        if (checked) {
          for (const name of preset.productNames) {
            if (!locked.has(name) || next.has(name)) next.add(name)
          }
          return next
        }

        // Al quitar un giro se conservan los insumos que también pertenecen
        // a otro giro activo, los bloqueados por cambios o los que están en
        // recetas.
        const keep = new Set(
          CORE_PRODUCT_PRESETS.filter(
            (other) => other.id !== preset.id && activePresets.has(other.id)
          ).flatMap((other) => other.productNames)
        )

        for (const name of preset.productNames) {
          if (!keep.has(name) && !locked.has(name)) next.delete(name)
        }

        return next
      })
    },
    [activePresets, locked, persistPresets]
  )

  /** Aplica los retiros y sincroniza lo seleccionado con el inventario. */
  async function persistSelection(names: string[], createMissing: boolean) {
    setError(null)
    setPending(true)

    try {
      const result = await saveCoreInventory(names, createMissing)

      if (!result.ok) {
        setError(result.message ?? "No se pudo actualizar el inventario.")
        return
      }

      const skipped = result.data?.skipped ?? []

      if (skipped.length > 0) {
        // Lo que no se pudo retirar (recetas/pedidos) sigue en el inventario:
        // se vuelve a marcar para que el estado refleje la realidad.
        setSelected((current) => {
          const next = new Set(current)
          for (const row of skipped) next.add(row.name)
          return next
        })

        const names = skipped
          .slice(0, 3)
          .map((row) => row.name)
          .join(", ")
        const extra = skipped.length > 3 ? ` y ${skipped.length - 3} más` : ""

        toast.warning(
          `No se pudieron procesar ${names}${extra}. Revisa si tienen cambios o aparecen en pedidos.`
        )
      } else {
        toast.success("Inventario actualizado")
      }

      router.refresh()
    } catch {
      setError("No se pudo actualizar el inventario.")
    } finally {
      setPending(false)
    }
  }

  function handleSave() {
    // Si hay insumos nuevos, se editan en el alta masiva antes de crearlos.
    if (newRows.length > 0) {
      setBulkOpen(true)
      return
    }

    void persistSelection([...selected], true)
  }

  /** Limpia insumos y giros seleccionados (conserva los bloqueados activos). */
  function handleClearSelection() {
    setSelected((current) => {
      const next = new Set<string>()
      for (const name of current) {
        if (locked.has(name)) next.add(name)
      }
      return next
    })
    setActivePresets(new Set())
    persistPresets(new Set())
    setError(null)
  }

  /** Tras el alta masiva: sincroniza retiros y descarta filas no creadas. */
  function handleBulkSaved(createdNames: string[]) {
    const created = new Set(createdNames.map(normalize))
    const kept = new Set(selected)

    for (const row of newRows) {
      if (!created.has(normalize(row.name))) kept.delete(row.name)
    }

    setSelected(kept)
    // Los insumos nuevos ya los creó el alta masiva; aquí solo se retiran
    // los desmarcados.
    void persistSelection([...kept], false)
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Insumos sugeridos</CardTitle>
          <CardDescription>
            Marca los insumos que quieras tener en el inventario. Los nuevos se
            abren en el alta masiva para ajustar precios y stock. Los que ya
            tienen cambios de unidad, categoría, ubicación, stock o costo
            quedan bloqueados; los demás se pueden desmarcar para desactivarlos.
          </CardDescription>
          <CardAction>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {locked.size > 0 ? (
                <Badge variant="outline">{locked.size} bloqueado(s)</Badge>
              ) : null}
              <Badge variant="secondary">
                <PackageIcon data-icon="inline-start" />
                {selected.size} seleccionado{selected.size === 1 ? "" : "s"}
              </Badge>
              {canManage ? (
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={pending || bulkOpen || selected.size === 0}
                >
                  {pending ? (
                    <Loader2Icon className="animate-spin" />
                  ) : (
                    <SaveIcon />
                  )}
                  Guardar
                </Button>
              ) : null}
            </div>
          </CardAction>
        </CardHeader>

        <CardContent className="gap-6">
          {/* Selección rápida por giro */}
          <div className="flex flex-col gap-3 rounded-lg border border-dashed bg-muted/30 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">Selección por giro</span>
                <span className="text-xs text-muted-foreground">
                  Marca un giro para seleccionar automáticamente un paquete de
                  insumos base.
                </span>
              </div>

              {canManage ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleClearSelection}
                  disabled={
                    selected.size === 0 && activePresets.size === 0
                  }
                >
                  <EraserIcon />
                  Limpiar selección
                </Button>
              ) : null}
            </div>

            <div className="grid gap-x-6 gap-y-2 sm:grid-cols-3">
              {CORE_PRODUCT_PRESETS.map((preset) => (
                <label
                  key={preset.id}
                  className="flex cursor-pointer items-center gap-2 text-sm"
                >
                  <Checkbox
                    checked={activePresets.has(preset.id)}
                    disabled={!canManage}
                    onCheckedChange={(checked) =>
                      applyPreset(preset, checked === true)
                    }
                    aria-label={preset.label}
                  />
                  {preset.label}
                  <span className="text-xs text-muted-foreground">
                    ({preset.productNames.length})
                  </span>
                </label>
              ))}
            </div>

            {!canManage ? (
              <p className="text-xs text-muted-foreground">
                Solo un administrador o encargado de inventario puede guardar
                cambios.
              </p>
            ) : null}

            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
          </div>

          {CORE_PRODUCT_GROUPS.map((group, index) => (
            <section
              key={group.category}
              className={cn(
                "flex flex-col gap-3",
                index > 0 && "border-t border-border/60 pt-6"
              )}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-heading text-sm font-medium">
                  {group.category}
                </h3>
                <span className="text-xs text-muted-foreground">
                  {group.products.length} insumo
                  {group.products.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="grid gap-1 sm:grid-cols-4">
                {group.products.map((product) => {
                  const isLocked = locked.has(product.name)

                  return (
                    <label
                      key={`${group.category}|${product.name}`}
                      className={cn(
                        "flex items-start gap-2 rounded-md px-1.5 py-1.5 text-sm transition-colors",
                        canManage && !isLocked
                          ? "cursor-pointer hover:bg-muted/50"
                          : "cursor-default",
                        isLocked && "opacity-75"
                      )}
                      title={
                        isLocked
                          ? "Insumo con cambios: no se puede desactivar desde Configuración"
                          : undefined
                      }
                    >
                      <Checkbox
                        checked={selected.has(product.name)}
                        disabled={!canManage || isLocked}
                        onCheckedChange={(checked) =>
                          toggle(product.name, checked === true)
                        }
                        aria-label={`Seleccionar ${product.name}`}
                      />
                      <span className="flex min-w-0 flex-col">
                        <span className="flex items-center gap-1.5 truncate font-medium">
                          {product.name}
                          {isLocked ? (
                            <Badge variant="outline" className="shrink-0">
                              Modificado
                            </Badge>
                          ) : null}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {unitLabel(product.unit)} · {product.location}
                        </span>
                      </span>
                    </label>
                  )
                })}
              </div>
            </section>
          ))}
        </CardContent>
      </Card>

      {bulkOpen ? (
        <BulkIngredientsDialog
          open
          onOpenChange={setBulkOpen}
          categories={categories}
          locations={locations}
          branchName={branchName}
          initialRows={newRows}
          onSaved={handleBulkSaved}
        />
      ) : null}
    </>
  )
}
