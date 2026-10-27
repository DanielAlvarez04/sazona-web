/**
 * URL base de la API.
 *
 * Vive en su propio módulo (sin imports de servidor) para que también pueda
 * usarse desde componentes cliente.
 */
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/v1"
