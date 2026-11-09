"use client"

import * as React from "react"
import { Settings2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "cn"

/**
 * Modo del panel de detalles.
 *
 * `collapsible` es el diseño nuevo (resumen + formulario plegable).
 * `always` deja el formulario siempre visible, como la estructura anterior.
 */
export type MenuDetailsMode = "collapsible" | "always"

export function MenuDetailsPanel({
  mode,
  open,
  onOpenChange,
  name,
  schedule,
  children,
}: {
  mode: MenuDetailsMode
  open: boolean
  onOpenChange: (open: boolean) => void
  name: string
  schedule: string
  children: React.ReactNode
}) {
  if (mode === "always") {
    return <div className="px-6 pt-4">{children}</div>
  }

  return (
    <div className="px-6 pt-4">
      <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2">
        <div className="min-w-0">
          <p
            className={cn(
              "truncate text-sm font-medium",
              !name.trim() && "text-muted-foreground"
            )}
          >
            {name.trim() || "Sin nombre"}
          </p>
          <p className="truncate text-xs text-muted-foreground">{schedule}</p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-expanded={open}
          onClick={() => onOpenChange(!open)}
        >
          <Settings2Icon className="size-4" />
          {open ? "Ocultar detalles" : "Editar detalles"}
        </Button>
      </div>

      {open ? (
        <div className="pt-4 lg:max-h-[42dvh] lg:overflow-y-auto">
          {children}
        </div>
      ) : null}
    </div>
  )
}
