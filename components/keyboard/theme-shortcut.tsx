"use client"

import { useShortcut } from "@/components/keyboard/keyboard-shortcuts-provider"
import { useTheme } from "@/components/theme-provider"

/**
 * Conecta el comando `theme.toggle` (ver `lib/keyboard/shortcuts.ts`) con el
 * `ThemeProvider`. Se monta una sola vez en el layout raíz.
 */
export function ThemeShortcut() {
  const { resolvedTheme, setTheme } = useTheme()

  useShortcut("theme.toggle", () => {
    // Alterna siempre hacia el tema contrario al que se está viendo.
    setTheme(resolvedTheme === "dark" ? "light" : "dark")
  })

  return null
}
