/**
 * Preferencias de columnas de la vista de tarjetas compartidas por servidor y
 * cliente.
 *
 * Este módulo **no** lleva `"use client"`: lo importan el script que se ejecuta
 * antes del primer pintado (`components/card-columns-script.tsx`) y los hooks
 * de cliente.
 */

export interface CardColumnsPreference {
  /** Clave de `localStorage` donde vive la preferencia. */
  storageKey: string
  /** Variable CSS que consume la grilla de tarjetas. */
  cssVar: string
  /** Columnas cuando no hay preferencia guardada. */
  fallback: number
  min: number
  max: number
}

/** Tamaño de las tarjetas del catálogo (artículos, recetas y combos). */
export const CATALOG_CARD_COLUMNS: CardColumnsPreference = {
  storageKey: "catalog-card-columns",
  cssVar: "--np-card-columns-catalog",
  fallback: 6,
  min: 4,
  max: 7,
}

/** Tamaño de las tarjetas de menús. */
export const MENUS_CARD_COLUMNS: CardColumnsPreference = {
  storageKey: "menus-card-columns",
  cssVar: "--np-card-columns-menus",
  fallback: 3,
  min: 2,
  max: 4,
}

/** Tamaño de las tarjetas del catálogo del POS. */
export const POS_CARD_COLUMNS: CardColumnsPreference = {
  storageKey: "pos-card-columns",
  cssVar: "--np-pos-card-columns",
  fallback: 4,
  min: 4,
  max: 7,
}

export const CARD_COLUMNS_PREFERENCES = [
  CATALOG_CARD_COLUMNS,
  MENUS_CARD_COLUMNS,
  POS_CARD_COLUMNS,
] as const

/**
 * Nombre de la variable CSS para una clave de `localStorage`.
 *
 * Si la clave no está registrada se deriva un nombre estable; así una tabla
 * nueva puede persistir su tamaño sin tocar el script anti-destello.
 */
export function cardColumnsCssVar(storageKey: string): string {
  return (
    CARD_COLUMNS_PREFERENCES.find(
      (preference) => preference.storageKey === storageKey
    )?.cssVar ?? `--np-card-columns-${storageKey}`
  )
}

/**
 * Script que aplica el tamaño guardado de las tarjetas antes del primer
 * pintado.
 *
 * Lo renderiza `CardColumnsScript` desde el árbol del servidor. Sin él, el HTML
 * inicial usa el tamaño por defecto y la grilla salta al tamaño configurado en
 * cuanto termina la hidratación.
 */
export function cardColumnsInitScript(): string {
  const preferences = CARD_COLUMNS_PREFERENCES.map((preference) => [
    preference.storageKey,
    preference.cssVar,
    preference.min,
    preference.max,
  ])

  return (
    `!function(){try{` +
    `var p=${JSON.stringify(preferences)},e=document.documentElement;` +
    `for(var i=0;i<p.length;i++){` +
    `var r=localStorage.getItem(p[i][0]);` +
    `if(r===null)continue;` +
    `var n=Number(r);` +
    `if(!isFinite(n)||Math.floor(n)!==n)continue;` +
    `n=Math.min(p[i][3],Math.max(p[i][2],n));` +
    `e.style.setProperty(p[i][1],String(n))` +
    `}` +
    `}catch(e){}}()`
  )
}
