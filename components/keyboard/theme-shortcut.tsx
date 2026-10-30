"use client"

import { useTheme } from "next-themes"

import { useShortcut } from "@/components/keyboard/keyboard-shortcuts-provider"

/**
 * Conecta el comando `theme.toggle` (ver `lib/keyboard/shortcuts.ts`) con
 * `next-themes`. Se monta una sola vez en el layout raíz.
 */
export function ThemeShortcut() {
  const { resolvedTheme, setTheme } = useTheme()

  useShortcut("theme.toggle", () => {
    // Antes de montar `resolvedTheme` es `undefined`: en ese caso se elige el
    // modo oscuro, que es el que el usuario no está viendo si arrancó en claro.
    setTheme(resolvedTheme === "dark" ? "light" : "dark")
  })

  return null
}
