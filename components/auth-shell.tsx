import Link from "next/link"
import { GalleryVerticalEndIcon } from "lucide-react"

/**
 * Marco visual compartido por las pantallas de autenticación:
 * panel de formulario + panel con el degradado del tema.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <Link
          href="/login"
          className="flex justify-center gap-2 font-medium md:justify-start"
        >
          <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <GalleryVerticalEndIcon className="size-4" />
          </div>
          Naranja Pimienta
        </Link>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </div>
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-primary via-primary/85 to-secondary lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_15%,var(--primary-foreground),transparent_45%)] opacity-25" />
        <div className="absolute -top-40 -right-32 size-[30rem] rounded-full bg-primary-foreground/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-24 size-[26rem] rounded-full bg-background/20 blur-3xl" />
      </div>
    </div>
  )
}
