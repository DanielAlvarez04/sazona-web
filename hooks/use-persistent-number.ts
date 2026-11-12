"use client"

import { useCallback, useSyncExternalStore } from "react"

interface NumberStore {
  value: number | null
  listeners: Set<() => void>
}

const stores = new Map<string, NumberStore>()

function getStore(storageKey: string): NumberStore {
  const existing = stores.get(storageKey)
  if (existing) return existing

  const store: NumberStore = { value: null, listeners: new Set() }
  stores.set(storageKey, store)
  return store
}

function readNumber(storageKey: string, fallback: number): number {
  if (typeof window === "undefined") return fallback

  try {
    const stored = window.localStorage.getItem(storageKey)
    if (stored === null) return fallback

    const parsed = Number(stored)
    if (Number.isInteger(parsed) && parsed > 0) return parsed
  } catch {
    // Sin `localStorage` (modo privado) se usa el valor por defecto.
  }

  return fallback
}

/**
 * Valor numérico persistido en `localStorage` y acotado a un rango.
 *
 * Se usa para preferencias de presentación que deben sobrevivir a recargas y
 * cambios de ruta (columnas de tarjetas, tamaño de texto, etc.).
 */
export function usePersistentNumber(
  storageKey: string | null,
  fallback: number,
  min: number,
  max: number
) {
  const clamp = useCallback(
    (value: number) => Math.min(max, Math.max(min, value)),
    [min, max]
  )

  const getSnapshot = useCallback(() => {
    if (!storageKey) return fallback

    const store = getStore(storageKey)
    const current = store.value ?? readNumber(storageKey, fallback)
    if (store.value === null) store.value = current

    return current
  }, [storageKey, fallback])

  const getServerSnapshot = useCallback(() => fallback, [fallback])

  const subscribe = useCallback(
    (listener: () => void) => {
      if (!storageKey) return () => {}

      const store = getStore(storageKey)
      store.listeners.add(listener)

      const onStorage = (event: StorageEvent) => {
        if (event.key !== null && event.key !== storageKey) return

        store.value = readNumber(storageKey, fallback)
        for (const notify of store.listeners) notify()
      }

      window.addEventListener("storage", onStorage)

      return () => {
        store.listeners.delete(listener)
        window.removeEventListener("storage", onStorage)
      }
    },
    [storageKey, fallback]
  )

  const stored = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  )

  const setValue = useCallback(
    (next: number | ((current: number) => number)) => {
      if (!storageKey) return

      const store = getStore(storageKey)
      const current = clamp(store.value ?? readNumber(storageKey, fallback))
      const resolved = clamp(
        typeof next === "function" ? next(current) : next
      )

      if (resolved === current && store.value !== null) return

      store.value = resolved

      try {
        window.localStorage.setItem(storageKey, String(resolved))
      } catch {
        // Sin persistencia disponible: el valor solo dura esta sesión.
      }

      for (const notify of store.listeners) notify()
    },
    [storageKey, fallback, clamp]
  )

  return [clamp(stored), setValue] as const
}
