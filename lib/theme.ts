/**
 * Preferencias de tema compartidas por servidor y cliente.
 *
 * Este módulo **no** lleva `"use client"`: lo importan tanto el Server
 * Component que inyecta el script anti-destello (`components/theme-script.tsx`)
 * como el provider de cliente (`components/theme-provider.tsx`).
 */

/** Preferencia elegida por el usuario. */
export type Theme = "light" | "dark" | "system"

/** Tema aplicado realmente al documento. */
export type ResolvedTheme = "light" | "dark"

/** Clave de `localStorage` donde se guarda la preferencia. */
export const THEME_STORAGE_KEY = "theme"

/** Opciones del selector de tema (Claro / Oscuro / Sistema). */
export const THEMES: readonly Theme[] = ["light", "dark", "system"]

/** Consulta de medios con la preferencia del sistema operativo. */
export const SYSTEM_THEME_QUERY = "(prefers-color-scheme: dark)"

/** Clase que activa las variantes `dark:` de Tailwind (`app/globals.css`). */
export const DARK_CLASS = "dark"

/**
 * Script que aplica el tema guardado antes del primer pintado.
 *
 * Lo renderiza `ThemeScript` desde el árbol del servidor. React 19 solo emite
 * el aviso «Encountered a script tag while rendering React component» cuando
 * un `<script>` se crea en el cliente, que era justo lo que hacía
 * `next-themes` al inyectarlo dentro de un componente cliente.
 */
export function themeInitScript(defaultTheme: Theme = "system"): string {
  return (
    `!function(){try{` +
    `var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)})||${JSON.stringify(defaultTheme)};` +
    `var d=t==='dark'||(t==='system'&&window.matchMedia(${JSON.stringify(SYSTEM_THEME_QUERY)}).matches);` +
    `var e=document.documentElement;` +
    `e.classList.toggle(${JSON.stringify(DARK_CLASS)},d);` +
    `e.style.colorScheme=d?'dark':'light'` +
    `}catch(t){}}()`
  )
}
