"use client"

import { useCallback, useSyncExternalStore } from "react"

import type { DataTableViewMode } from "@/components/data-table/data-table"

const STORAGE_KEY = "catalog-view-mode"
const DEFAULT_VIEW_MODE: DataTableViewMode = "cards"

interface ViewStore {
  value: DataTableViewMode | null
  listeners: Set<() => void>
}

const stores = new Map<string, ViewStore>()

function getStore(storageKey: string): ViewStore {
  const existing = stores.get(storageKey)
  if (existing) return existing

  const store: ViewStore = { value: null, listeners: new Set() }
  stores.set(storageKey, store)
  return store
}

function read(storageKey: string): DataTableViewMode {
  if (typeof window === "undefined") return DEFAULT_VIEW_MODE

  try {
    const stored = window.localStorage.getItem(storageKey)
    if (isViewMode(stored)) return stored
  } catch {
    // Sin `localStorage` (modo privado) se usa el valor por defecto.
  }

  return DEFAULT_VIEW_MODE
}

function isViewMode(value: string | null): value is DataTableViewMode {
  return value === "cards" || value === "table"
}

/**
 * Vista de tabla/tarjetas persistida en `localStorage`.
 *
 * Cada página puede usar su propia clave (`menus-view-mode`) para no mezclar
 * la preferencia de Catálogo con la de Menús. Sin clave se conserva el
 * comportamiento histórico de `/catalog`.
 */
export function usePersistentViewMode(storageKey = STORAGE_KEY) {
  const getSnapshot = useCallback(() => {
    const store = getStore(storageKey)
    const current = store.value ?? read(storageKey)

    if (store.value === null) store.value = current
    return current
  }, [storageKey])

  const getServerSnapshot = useCallback(() => DEFAULT_VIEW_MODE, [])

  const subscribe = useCallback(
    (listener: () => void) => {
      const store = getStore(storageKey)
      store.listeners.add(listener)

      const onStorage = (event: StorageEvent) => {
        if (event.key !== null && event.key !== storageKey) return

        store.value = read(storageKey)
        for (const notify of store.listeners) notify()
      }

      window.addEventListener("storage", onStorage)

      return () => {
        store.listeners.delete(listener)
        window.removeEventListener("storage", onStorage)
      }
    },
    [storageKey]
  )

  const viewMode = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  )

  const setViewMode = useCallback(
    (next: DataTableViewMode) => {
      const store = getStore(storageKey)
      store.value = next

      try {
        window.localStorage.setItem(storageKey, next)
      } catch {
        // Sin persistencia disponible: el modo solo dura esta sesión.
      }

      for (const notify of store.listeners) notify()
    },
    [storageKey]
  )

  return [viewMode, setViewMode] as const
}
