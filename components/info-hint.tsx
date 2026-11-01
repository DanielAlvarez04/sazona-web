"use client"

import { CircleHelpIcon } from "lucide-react"
import { cn } from "cn"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

/**
 * Icono de pregunta con tooltip, para explicar un campo o el contenido de una
 * columna sin ocupar espacio en el formulario.
 *
 * Se renderiza como `<span>` (no como botón) para poder anidarse dentro de
 * botones y etiquetas sin HTML inválido ni menús de anidamiento de React. El
 * texto queda asociado por `aria-describedby`, así que también se anuncia al
 * enfocar con el teclado.
 */
export function InfoHint({
  text,
  className,
}: {
  /** Texto que se muestra dentro del tooltip. */
  text: string
  className?: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<span />}
        tabIndex={0}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
        className={cn(
          "inline-flex size-5 shrink-0 cursor-help items-center justify-center rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
          className
        )}
      >
        <CircleHelpIcon className="size-3.5" aria-hidden="true" />
      </TooltipTrigger>
      <TooltipContent>{text}</TooltipContent>
    </Tooltip>
  )
}
