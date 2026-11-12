"use client"

import { usePersistentNumber } from "@/hooks/use-persistent-number"

/**
 * Número de columnas de la vista de tarjetas, persistido en `localStorage`.
 *
 * Se guarda por página (`catalog-card-columns`, `menus-card-columns`) para que
 * el tamaño elegido sobreviva a recargas y cambios de ruta. El valor leído se
 * acota al rango vigente del control para no quedar fuera de los límites si el
 * rango cambia entre páginas.
 */
export function usePersistentCardColumns(
  storageKey: string | null,
  fallback: number,
  min: number,
  max: number
) {
  return usePersistentNumber(storageKey, fallback, min, max)
}
