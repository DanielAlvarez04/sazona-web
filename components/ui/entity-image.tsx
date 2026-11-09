import * as React from "react"

import type { ImageAssets } from "@/lib/images"

type Props = Omit<React.ComponentProps<"img">, "src" | "srcSet"> & {
  /** URL de respaldo (JPEG de mayor tamaño) que llega de la API. */
  src: string | null | undefined
  /** Variantes optimizadas; si faltan se pinta un `<img>` normal. */
  assets?: ImageAssets | null
  /** Ancho esperado en cada breakpoint (`sizes` de `srcset`). */
  sizes?: string
}

/**
 * Imagen del catálogo con AVIF y respaldo JPEG.
 *
 * La API ya entrega los archivos optimizados, así que no se usa el optimizador
 * de Next: un `<picture>` deja que el navegador elija formato y ancho con una
 * sola petición y sin JavaScript.
 *
 * Cuando la fila todavía tiene una URL antigua (`imageVariants` nulo) se pinta
 * el `<img>` de siempre para no romper datos históricos.
 */
export function EntityImage({
  src,
  assets,
  sizes = "100vw",
  alt,
  loading = "lazy",
  decoding = "async",
  ...props
}: Props) {
  if (!src) return null

  const variants = assets?.variants ?? []

  if (variants.length === 0) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={src}
        alt={alt}
        loading={loading}
        decoding={decoding}
        {...props}
      />
    )
  }

  const avifSrcSet = variants
    .map((variant) => `${variant.avif} ${variant.width}w`)
    .join(", ")
  const jpegSrcSet = variants
    .map((variant) => `${variant.jpg} ${variant.width}w`)
    .join(", ")

  return (
    <picture className="contents">
      <source type="image/avif" srcSet={avifSrcSet} sizes={sizes} />
      <source type="image/jpeg" srcSet={jpegSrcSet} sizes={sizes} />
      <img
        src={src}
        alt={alt}
        loading={loading}
        decoding={decoding}
        {...props}
      />
    </picture>
  )
}
