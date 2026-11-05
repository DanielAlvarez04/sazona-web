"use client"

import { useCallback, useSyncExternalStore } from "react"

interface TabStore {
  value: string | null
  listeners: Set<() => void>
}

const stores = new Map<string, TabStore>()

function getStore(storageKey: string): TabStore {
  const existing = stores.get(storageKey)
  if (existing) return existing

  const store: TabStore = { value: null, listeners: new Set() }
  stores.set(storageKey, store)
  return store
}

function readTab(
  storageKey: string,
  tabs: readonly string[],
  fallback: string
): string {
  if (typeof window === "undefined") return fallback

  try {
    const stored = window.localStorage.getItem(storageKey)
    if (stored && tabs.includes(stored)) return stored
  } catch {
    // Sin `localStorage` (modo privado) se usa la pestaña por defecto.
  }

  return fallback
}

/**
 * Pestaña activa persistida en `localStorage`.
 *
 * Sirve para las tabs de página (Catálogo, Inventario, Reportes, Configuración):
 * al salir y volver, se restaura la última pestaña en lugar de la primera. Si
 * la pestaña guardada ya no existe para el usuario actual (permisos o datos),
 * cae en `defaultTab`.
 */
export function usePersistentTab<T extends string>(
  storageKey: string,
  tabs: readonly T[],
  defaultTab: T
) {
  const getSnapshot = useCallback(() => {
    const store = getStore(storageKey)
    const current = store.value ?? readTab(storageKey, tabs, defaultTab)

    if (store.value === null) store.value = current
    return current
  }, [storageKey, tabs, defaultTab])

  const getServerSnapshot = useCallback(() => defaultTab, [defaultTab])

  const subscribe = useCallback(
    (listener: () => void) => {
      const store = getStore(storageKey)
      store.listeners.add(listener)

      const onStorage = (event: StorageEvent) => {
        if (event.key !== null && event.key !== storageKey) return

        store.value = readTab(storageKey, tabs, defaultTab)
        for (const notify of store.listeners) notify()
      }

      window.addEventListener("storage", onStorage)

      return () => {
        store.listeners.delete(listener)
        window.removeEventListener("storage", onStorage)
      }
    },
    [storageKey, tabs, defaultTab]
  )

  const current = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  )

  const setTab = useCallback(
    (next: string) => {
      if (!(tabs as readonly string[]).includes(next)) return

      const store = getStore(storageKey)
      store.value = next

      try {
        window.localStorage.setItem(storageKey, next)
      } catch {
        // Sin persistencia disponible: la pestaña solo dura esta sesión.
      }

      for (const notify of store.listeners) notify()
    },
    [storageKey, tabs]
  )

  return [
    tabs.includes(current as T) ? (current as T) : defaultTab,
    setTab,
  ] as const
}
