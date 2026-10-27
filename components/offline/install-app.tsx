"use client"

import * as React from "react"
import { DownloadIcon, SmartphoneIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

/** Valores del navegador que no cambian durante la vida de la página. */
function subscribeToNothing() {
  return () => {}
}

function readStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // Safari iOS
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function readIos(): boolean {
  return /iPad|iPhone|iPod/.test(window.navigator.userAgent)
}

const readFalse = () => false

/**
 * Instalación de la PWA (plan.md §7).
 *
 * Chrome/Edge exponen `beforeinstallprompt`; en iOS solo se puede guiar al
 * usuario por el menú Compartir → Añadir a pantalla de inicio.
 */
export function InstallApp() {
  const isStandalone = React.useSyncExternalStore(
    subscribeToNothing,
    readStandalone,
    readFalse
  )
  const isIos = React.useSyncExternalStore(subscribeToNothing, readIos, readFalse)

  const [promptEvent, setPromptEvent] =
    React.useState<InstallPromptEvent | null>(null)
  const [installed, setInstalled] = React.useState(false)

  React.useEffect(() => {
    const handlePrompt = (event: Event) => {
      event.preventDefault()
      setPromptEvent(event as InstallPromptEvent)
    }
    const handleInstalled = () => {
      setInstalled(true)
      setPromptEvent(null)
    }

    window.addEventListener("beforeinstallprompt", handlePrompt)
    window.addEventListener("appinstalled", handleInstalled)

    return () => {
      window.removeEventListener("beforeinstallprompt", handlePrompt)
      window.removeEventListener("appinstalled", handleInstalled)
    }
  }, [])

  async function handleInstall() {
    if (!promptEvent) return

    await promptEvent.prompt()
    const choice = await promptEvent.userChoice
    if (choice.outcome === "accepted") {
      setInstalled(true)
    }
    setPromptEvent(null)
  }

  if (isStandalone || installed) {
    return (
      <p className="text-sm text-muted-foreground">
        La aplicación ya está instalada en este dispositivo. Ábrela desde su
        icono para tener acceso directo al punto de venta.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Instala Naranja Pimienta para abrirla como una app y conservar las
        comandas pendientes en el dispositivo si se corta la conexión.
      </p>

      {promptEvent ? (
        <Button
          type="button"
          variant="outline"
          className="w-fit"
          onClick={() => void handleInstall()}
        >
          <DownloadIcon />
          Instalar aplicación
        </Button>
      ) : (
        <div className="flex items-start gap-2 rounded-lg border border-border/60 p-3 text-sm text-muted-foreground">
          <SmartphoneIcon className="mt-0.5 size-4 shrink-0" />
          {isIos ? (
            <span>
              En iPhone o iPad: toca <strong>Compartir</strong> y luego{" "}
              <strong>Añadir a pantalla de inicio</strong>.
            </span>
          ) : (
            <span>
              Usa el menú del navegador y elige{" "}
              <strong>Instalar aplicación</strong> (o{" "}
              <strong>Añadir a la pantalla de inicio</strong>).
            </span>
          )}
        </div>
      )}
    </div>
  )
}
