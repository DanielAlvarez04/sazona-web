"use client"

import { EraserIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

/**
 * Acción secundaria de los pies de diálogo: devuelve los campos a su valor
 * inicial y descarta el borrador guardado.
 *
 * Es `ghost` y con el icono a la izquierda para no competir con los botones
 * principales. Quien lo usa decide la alineación con `className`.
 */
export function ClearFieldsButton({
  onClick,
  disabled,
  className,
}: {
  onClick: () => void
  disabled?: boolean
  className?: string
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onClick}
      disabled={disabled}
      className={className}
    >
      <EraserIcon />
      Limpiar campos
    </Button>
  )
}
