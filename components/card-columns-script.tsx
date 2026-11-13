"use client"

import { cardColumnsInitScript } from "@/lib/card-columns"

/**
 * Aplica el tamaño guardado de las tarjetas antes del primer pintado.
 *
 * El script viaja en el HTML inicial y se ejecuta durante el parseo. En el
 * cliente se renderiza como `text/plain` y con `suppressHydrationWarning`: así
 * React no intenta ejecutarlo ni avisa de un `<script>` dentro del árbol. Los
 * cambios posteriores los gestiona `usePersistentCardColumns`.
 */
export function CardColumnsScript() {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      // El contenido es estático: no se interpola nada del usuario.
      dangerouslySetInnerHTML={{ __html: cardColumnsInitScript() }}
    />
  )
}
