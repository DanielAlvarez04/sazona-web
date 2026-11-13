"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ClockIcon } from "lucide-react"
import { toast } from "sonner"

import { endPracticeMode } from "@/app/(app)/practice-actions"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

/**
 * Avisa cuando la ventana de modo práctica de 48 horas termina.
 *
 * Si la app está abierta, el temporizador muestra el aviso al cumplirse el
 * plazo. Si estaba cerrada, el aviso aparece en la siguiente carga porque el
 * layout recibe `active` y `until` desde la sesión.
 */
export function PracticeModeWatcher({
  active,
  until,
}: {
  active: boolean
  until: string | null
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [pending, startTransition] = React.useTransition()

  React.useEffect(() => {
    if (!active || !until) return

    const end = new Date(until).getTime()

    if (Number.isNaN(end)) return

    const check = () => {
      if (Date.now() >= end) setOpen(true)
    }

    if (Date.now() >= end) {
      // Fuera del cuerpo síncrono del efecto para no encadenar renders.
      const immediate = window.setTimeout(check, 0)

      return () => window.clearTimeout(immediate)
    }

    const timer = window.setTimeout(check, end - Date.now())

    window.addEventListener("focus", check)
    document.addEventListener("visibilitychange", check)

    return () => {
      window.clearTimeout(timer)
      window.removeEventListener("focus", check)
      document.removeEventListener("visibilitychange", check)
    }
  }, [active, until])

  const acknowledge = React.useCallback(() => {
    startTransition(async () => {
      const result = await endPracticeMode()

      if (!result.ok) {
        toast.error(result.message ?? "No se pudo cerrar el modo práctica")
      }

      setOpen(false)
      router.refresh()
    })
  }, [router])

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !pending) acknowledge()
      }}
    >
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <ClockIcon />
          </AlertDialogMedia>
          <AlertDialogTitle>Terminó el modo práctica</AlertDialogTitle>
          <AlertDialogDescription>
            Pasaron las 48 horas de práctica. Desde ahora los pedidos se
            incluirán en los reportes de operación. Puedes volver a activarlo
            en Configuración → Negocio.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={acknowledge} disabled={pending}>
            Entendido
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
