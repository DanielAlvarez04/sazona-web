import { Skeleton } from "@/components/ui/skeleton"

/**
 * Frontera de carga del panel.
 *
 * Todas las rutas de `(app)` son dinámicas (leen cookies y datos por usuario),
 * así que Next no puede prefetchearlas. Sin este archivo, cada navegación deja
 * la pantalla anterior congelada hasta que el servidor responde.
 *
 * Es deliberadamente genérico: un encabezado, una fila de indicadores y una
 * tarjeta grande, que es la forma común de dashboard, catálogo y reportes.
 */
export default function AppLoading() {
  return (
    <div
      className="flex flex-1 flex-col gap-6 p-4 md:p-6"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Cargando…</span>

      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="rounded-xl border p-4">
            <Skeleton className="mb-3 h-4 w-24" />
            <Skeleton className="h-8 w-32" />
          </div>
        ))}
      </div>

      <div className="rounded-xl border p-4">
        <Skeleton className="mb-4 h-5 w-40" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  )
}
