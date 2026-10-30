"use client"

import { usePathname } from "next/navigation"

import { OfflineStatus } from "@/components/offline/offline-status"
import { ModeToggle } from "@/components/mode-toggle"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/pos": "Punto de venta",
  "/kitchen": "Cocina",
  "/catalog": "Catálogo",
  "/inventory": "Inventario",
  "/reports": "Reportes",
  "/settings": "Configuración",
}

export function SiteHeader({ branchName }: { branchName?: string | null }) {
  const pathname = usePathname()

  const pageTitle =
    pageTitles[pathname] ??
    pageTitles[
      Object.keys(pageTitles).find((path) => pathname.startsWith(`${path}/`)) ??
        ""
    ] ??
    "Naranja Pimienta"

  // El alcance de la vista siempre está a la vista: si hay sucursal activa el
  // título lo dice explícitamente ("Inventario de Centro").
  const title = branchName ? `${pageTitle} de ${branchName}` : pageTitle

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 h-4 data-vertical:self-auto"
        />
        <h1 className="text-base font-medium">{title}</h1>
        <div className="ml-auto flex items-center gap-2">
          <ModeToggle />
          <OfflineStatus />
        </div>
      </div>
    </header>
  )
}
