/**
 * Utilidades de scroll para componentes que viven dentro de contenedores con
 * su propio overflow (por ejemplo, el `DialogContent` de un diálogo).
 */

/**
 * Baja hasta el final del contenedor con scroll más cercano al elemento.
 *
 * Se usa al añadir filas dentro de un diálogo con scroll propio: al alinear
 * con el fondo, la fila nueva y el pie del diálogo quedan siempre a la vista
 * sin que el usuario tenga que desplazarse a mano. Si no hay ningún contenedor
 * con scroll, no hace nada.
 */
export function scrollAncestorToBottom(element: HTMLElement | null): void {
  let node = element?.parentElement ?? null

  while (node) {
    const { overflowY } = window.getComputedStyle(node)

    if (
      (overflowY === "auto" || overflowY === "scroll") &&
      node.scrollHeight > node.clientHeight
    ) {
      node.scrollTo({ top: node.scrollHeight, behavior: "smooth" })
      return
    }

    node = node.parentElement
  }
}
