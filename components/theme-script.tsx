import { themeInitScript, type Theme } from "@/lib/theme"

/**
 * Aplica el tema guardado antes del primer pintado (evita el destello claro).
 *
 * Es un Server Component a propósito: el `<script>` viaja en el HTML inicial y
 * React nunca lo crea al hidratar. El estado y los cambios posteriores los
 * gestiona `ThemeProvider` (`components/theme-provider.tsx`).
 */
export function ThemeScript({
  defaultTheme = "system",
}: {
  defaultTheme?: Theme
}) {
  return (
    <script
      // El contenido es estático: no se interpola nada del usuario.
      dangerouslySetInnerHTML={{ __html: themeInitScript(defaultTheme) }}
    />
  )
}
