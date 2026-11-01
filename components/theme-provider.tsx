"use client"

import * as React from "react"

import {
  DARK_CLASS,
  SYSTEM_THEME_QUERY,
  THEMES,
  THEME_STORAGE_KEY,
  type ResolvedTheme,
  type Theme,
} from "@/lib/theme"

type ThemeContextValue = {
  /** Preferencia elegida: `light`, `dark` o `system`. */
  theme: Theme
  /** Tema aplicado al documento. */
  resolvedTheme: ResolvedTheme
  /** Preferencia actual del sistema operativo. */
  systemTheme: ResolvedTheme
  setTheme: (theme: Theme) => void
  themes: readonly Theme[]
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null)

/** Valor usado fuera del provider, para no romper componentes aislados. */
const FALLBACK: ThemeContextValue = {
  theme: "system",
  resolvedTheme: "light",
  systemTheme: "light",
  setTheme: () => {},
  themes: THEMES,
}

/**
 * Almacén mínimo del tema para `useSyncExternalStore`.
 *
 * `getServerSnapshot` devuelve el tema por defecto (lo que ya pintó el
 * servidor) y `getSnapshot` lee `localStorage`; así la hidratación no se
 * desajusta y no hace falta `setState` dentro de un efecto.
 */
function createThemeStore(defaultTheme: Theme) {
  let current: Theme | null = null
  const listeners = new Set<() => void>()

  const read = (): Theme => {
    if (typeof window === "undefined") return defaultTheme
    try {
      const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
      if (stored && (THEMES as readonly string[]).includes(stored)) {
        return stored as Theme
      }
    } catch {
      // `localStorage` bloqueado (modo privado): se usa el tema por defecto.
    }
    return defaultTheme
  }

  const emit = () => {
    for (const listener of listeners) listener()
  }

  return {
    subscribe(listener: () => void) {
      listeners.add(listener)

      // Otras pestañas: se relee el valor guardado y se notifica al árbol.
      const onStorage = (event: StorageEvent) => {
        if (event.key !== null && event.key !== THEME_STORAGE_KEY) return
        current = read()
        emit()
      }
      window.addEventListener("storage", onStorage)

      return () => {
        listeners.delete(listener)
        window.removeEventListener("storage", onStorage)
      }
    },
    getSnapshot(): Theme {
      if (current === null) current = read()
      return current
    },
    getServerSnapshot(): Theme {
      return defaultTheme
    },
    setTheme(next: Theme) {
      current = next
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, next)
      } catch {
        // Sin persistencia disponible: el tema solo dura esta sesión.
      }
      emit()
    },
  }
}

function systemTheme(): ResolvedTheme {
  return window.matchMedia(SYSTEM_THEME_QUERY).matches ? "dark" : "light"
}

/** Evita animar los colores mientras se cambia de tema. */
function disableTransitions(): () => void {
  const style = document.createElement("style")
  style.appendChild(
    document.createTextNode(
      "*,*::before,*::after{transition:none!important}"
    )
  )
  document.head.appendChild(style)

  return () => {
    // Forzar un recálculo para que el cambio de tema se pinte sin animación.
    window.getComputedStyle(document.body)
    window.setTimeout(() => style.remove(), 1)
  }
}

/**
 * Estado del tema (Claro / Oscuro / Sistema).
 *
 * No renderiza ningún `<script>`: el tema inicial lo aplica `ThemeScript`
 * desde el servidor y aquí solo se sincroniza el estado con `localStorage` y
 * la preferencia del sistema.
 */
export function ThemeProvider({
  children,
  defaultTheme = "system",
  disableTransitionOnChange = false,
}: {
  children: React.ReactNode
  defaultTheme?: Theme
  disableTransitionOnChange?: boolean
}) {
  const store = React.useMemo(() => createThemeStore(defaultTheme), [defaultTheme])

  const theme = React.useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot
  )

  const system = React.useSyncExternalStore(
    subscribeSystemTheme,
    systemTheme,
    getServerSystemTheme
  )

  const resolvedTheme: ResolvedTheme = theme === "system" ? system : theme

  // Aplica el tema al `<html>`; las variantes `dark:` dependen de `.dark`.
  React.useEffect(() => {
    const restore = disableTransitionOnChange ? disableTransitions() : null
    const root = document.documentElement
    root.classList.toggle(DARK_CLASS, resolvedTheme === "dark")
    root.style.colorScheme = resolvedTheme
    restore?.()
  }, [resolvedTheme, disableTransitionOnChange])

  const value = React.useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme: store.setTheme,
      resolvedTheme,
      systemTheme: system,
      themes: THEMES,
    }),
    [theme, store, resolvedTheme, system]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

function subscribeSystemTheme(listener: () => void): () => void {
  const media = window.matchMedia(SYSTEM_THEME_QUERY)
  media.addEventListener("change", listener)
  return () => media.removeEventListener("change", listener)
}

function getServerSystemTheme(): ResolvedTheme {
  return "light"
}

/** Preferencias del tema. Debe usarse dentro de `<ThemeProvider>`. */
export function useTheme(): ThemeContextValue {
  return React.useContext(ThemeContext) ?? FALLBACK
}
