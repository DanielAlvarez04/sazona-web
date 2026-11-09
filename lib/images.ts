/**
 * Variantes optimizadas de una imagen.
 *
 * La API genera AVIF (preferido) y JPEG (respaldo) en dos anchos a partir de
 * la imagen que sube el usuario; el original no se conserva en R2. El JSON se
 * guarda en `imageVariants` y lo pinta `EntityImage` con `<picture>`.
 */
export interface ImageAssetVariant {
  /** Ancho real del archivo (px). */
  width: number
  /** Alto real del archivo (px). */
  height: number
  /** URL pública del archivo AVIF. */
  avif: string
  /** URL pública del JPEG de respaldo. */
  jpg: string
}

export interface ImageAssets {
  /** Medidas de origen, después de aplicar la orientación EXIF. */
  width: number
  height: number
  /** Variantes ordenadas de menor a mayor ancho. */
  variants: ImageAssetVariant[]
}

/**
 * `sizes` de las tarjetas del catálogo (4 por fila en escritorio).
 *
 * Se estima la tarjeta, no el viewport: con 300 px a 2x el navegador elige la
 * variante de 640 en lugar de bajar la de 1280 sin necesidad.
 */
export const CARD_IMAGE_SIZES = "(min-width: 640px) 300px, 50vw"
