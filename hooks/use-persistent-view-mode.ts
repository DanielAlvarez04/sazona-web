"use client"

import { useCallback, useSyncExternalStore } from "react"

import type { DataTableViewMode } from "@/components/data-table/data-table"

const STORAGE_KEY = "catalog-view-mode"
const DEFAULT_VIEW_MODE: DataTableViewMode = "cards"

function isViewMode(value: string | null): value is DataTableViewMode {
  return value === "cards" || value === "table"
}

let current: DataTableViewMode | null = null
const listeners = new Set<() => void>()

function read(): DataTableViewMode {
  if (typeof window === "undefined") return DEFAULT_VIEW_MODE

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (isViewMode(stored)) return stored
  } catch {
    // Sin `localStorage` (modo privado) se usa el valor por defecto.
  }

  return DEFAULT_VIEW_MODE
}

function emit() {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)

  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== STORAGE_KEY) return
    current = read()
    emit()
  }

  window.addEventListener("storage", onStorage)

  return () => {
    listeners.delete(listener)
    window.removeEventListener("storage", onStorage)
  }
}

function getSnapshot(): DataTableViewMode {
  if (current === null) current = read()
  return current
}

function getServerSnapshot(): DataTableViewMode {
  return DEFAULT_VIEW_MODE
}

/**
 * Vista de tabla/tarjetas compartida en `/catalog`, persistida en
 * `localStorage` para conservarla entre recargas y pestañas.
 */
export function usePersistentViewMode() {
  const viewMode = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  )

  const setViewMode = useCallback((next: DataTableViewMode) => {
    current = next

    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Sin persistencia disponible: el modo solo dura esta sesión.
    }

    emit()
  }, [])

  return [viewMode, setViewMode] as const
}
