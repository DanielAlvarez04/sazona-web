"use client"

import * as React from "react"
import { ImageIcon, Trash2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { IMAGE_ACCEPT, validateImageFile } from "@/lib/uploads"
import { cn } from "cn"

/**
 * Carga de la imagen del artículo.
 *
 * Acepta arrastrar y soltar o el selector del sistema y valida tipo y tamaño.
 * La vista previa es local: la imagen se sube a R2 al guardar el artículo,
 * cuando ya existe su carpeta. Se recomienda 1:1 porque el recuadro es
 * cuadrado y la imagen se recorta con `object-cover`.
 */
export function ImageDropzone({
  url,
  onSelect,
  onRemove,
  disabled = false,
}: {
  /** Vista previa: URL pública de la imagen guardada u objeto local. */
  url: string | null
  onSelect: (file: File) => void
  onRemove: () => void
  disabled?: boolean
}) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  function handleFile(file: File | null | undefined) {
    if (!file || disabled) return

    const problem = validateImageFile(file)
    if (problem) {
      setError(problem)
      return
    }

    setError(null)
    onSelect(file)
  }

  function openPicker() {
    if (disabled) return
    inputRef.current?.click()
  }

  return (
    <div className="flex h-full flex-col gap-1.5">
      <div
        onDragOver={(event) => {
          event.preventDefault()
          if (!disabled) setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          handleFile(event.dataTransfer.files?.[0])
        }}
        className={cn(
          "relative flex min-h-40 w-full flex-1 items-center justify-center overflow-hidden rounded-lg border border-dashed transition-colors",
          dragging && "border-primary bg-primary/5",
          disabled && "opacity-60"
        )}
      >
        {url ? (
          <>
            {/* Vista previa: el bucket puede no estar en remotePatterns. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt="Imagen del artículo"
              className="absolute inset-0 size-full object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-background/85 p-1.5 backdrop-blur">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={disabled}
                onClick={openPicker}
              >
                Reemplazar
              </Button>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label="Quitar imagen"
                disabled={disabled}
                onClick={() => {
                  setError(null)
                  onRemove()
                }}
              >
                <Trash2Icon />
              </Button>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={openPicker}
            disabled={disabled}
            className="flex size-full flex-col items-center justify-center gap-2 rounded-lg p-3 text-center transition-colors hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-not-allowed"
          >
            <span className="flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <ImageIcon className="size-4" />
            </span>
            <span className="text-xs font-medium">
              Arrastra una imagen o haz clic
            </span>
            <span className="text-[11px] leading-tight text-muted-foreground">
              JPG, PNG o WebP · máx. 5 MB
              <br />
              Se recomienda 1:1 (cuadrada)
            </span>
            <span className="mt-1 text-[11px] leading-tight text-muted-foreground">
              Opcional. Una imagen por artículo.
            </span>
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={IMAGE_ACCEPT}
        className="sr-only"
        disabled={disabled}
        onChange={(event) => {
          handleFile(event.target.files?.[0])
          event.target.value = ""
        }}
      />

      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}
