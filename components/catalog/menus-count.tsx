import { NotebookTextIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"

/** Número de menús donde se usa un artículo o una receta. */
export function MenusCountBadge({ count }: { count: number }) {
  return (
    <Badge
      variant="outline"
      title={`${count} ${count === 1 ? "menú" : "menús"}`}
      aria-label={`${count} ${count === 1 ? "menú" : "menús"}`}
    >
      <NotebookTextIcon data-icon="inline-start" />
      {count}
    </Badge>
  )
}
