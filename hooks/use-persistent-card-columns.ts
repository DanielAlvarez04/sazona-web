"use client"

import * as React from "react"

import {
  readPersistentNumber,
  usePersistentNumber,
} from "@/hooks/use-persistent-number"
import { cardColumnsCssVar } from "@/lib/card-columns"

/**
 * Número de columnas de la vista de tarjetas, persistido en `localStorage`.
 *
 * Se guarda por página (`catalog-card-columns`, `menus-card-columns`,
 * `pos-card-columns`) para que el tamaño elegido sobreviva a recargas y cambios
 * de ruta. El valor se acota al rango vigente del control para no quedar fuera
 * de los límites si el rango cambia entre páginas.
 *
 * El valor guardado se aplica antes del primer pintado desde
 * `CardColumnsScript`; este hook mantiene la variable CSS al día cuando el
 * usuario cambia el tamaño o cuando otra pestaña lo hace.
 */
export function usePersistentCardColumns(
  storageKey: string | null,
  fallback: number,
  min: number,
  max: number
) {
  const [value, setValue] = usePersistentNumber(storageKey, fallback, min, max)
  const cssVar = storageKey ? cardColumnsCssVar(storageKey) : null

  const setCardColumns = React.useCallback(
    (next: number | ((current: number) => number)) => {
      const resolved = typeof next === "function" ? next(value) : next
      const clamped = Math.min(max, Math.max(min, resolved))

      setValue(clamped)

      if (cssVar) {
        document.documentElement.style.setProperty(cssVar, String(clamped))
      }
    },
    [cssVar, max, min, setValue, value]
  )

  // Otra pestaña cambió el tamaño: `usePersistentNumber` ya actualiza su store;
  // aquí solo se refleja el valor en la variable CSS.
  React.useEffect(() => {
    if (!storageKey || !cssVar) return

    const onStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== storageKey) return

      const stored = readPersistentNumber(storageKey, fallback, min, max)
      document.documentElement.style.setProperty(cssVar, String(stored))
    }

    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [cssVar, fallback, max, min, storageKey])

  return [value, setCardColumns] as const
}
