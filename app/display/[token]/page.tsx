import { CustomerDisplay } from "@/components/pos/customer-display"
import { API_BASE_URL } from "@/lib/api-base"
import type { PosDisplayPublic } from "@/lib/pos-display"

/**
 * Pantalla pública frente al cliente (monitor o tablet).
 *
 * Los datos iniciales se piden desde el servidor con la URL interna para que el
 * primer pintado no dependa de una vuelta extra desde el navegador. El cliente
 * sigue sondeando por si la pantalla cambia.
 */
export default async function DisplayPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const initialData = await loadDisplay(token)

  return <CustomerDisplay token={token} initialData={initialData} />
}

async function loadDisplay(token: string): Promise<PosDisplayPublic | null> {
  if (!token) return null

  const base = process.env.API_URL ?? API_BASE_URL

  try {
    const response = await fetch(
      `${base}/pos/display/${encodeURIComponent(token)}`,
      { cache: "no-store" }
    )

    if (!response.ok) return null

    return (await response.json()) as PosDisplayPublic
  } catch {
    // Si la API no responde, el componente cliente reintenta por su cuenta.
    return null
  }
}
