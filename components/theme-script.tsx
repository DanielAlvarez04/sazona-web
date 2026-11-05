"use client"

import { themeInitScript, type Theme } from "@/lib/theme"

/**
 * Aplica el tema guardado antes del primer pintado (evita el destello claro).
 *
 * El script viaja en el HTML inicial y se ejecuta durante el parseo. En el
 * cliente se renderiza como `text/plain` y con `suppressHydrationWarning`: así
 * React no intenta ejecutarlo ni avisa de un `<script>` dentro del árbol. El
 * estado y los cambios posteriores los gestiona `ThemeProvider`.
 */
export function ThemeScript({
  defaultTheme = "system",
}: {
  defaultTheme?: Theme
}) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      // El contenido es estático: no se interpola nada del usuario.
      dangerouslySetInnerHTML={{ __html: themeInitScript(defaultTheme) }}
    />
  )
}
