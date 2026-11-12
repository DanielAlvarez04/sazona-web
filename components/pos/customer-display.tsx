"use client"

import * as React from "react"
import {
  CheckCircle2Icon,
  Loader2Icon,
  SparklesIcon,
  UtensilsCrossedIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { API_BASE_URL } from "@/lib/api-base"
import { formatMoney } from "@/lib/catalog"
import { apiErrorMessage } from "@/lib/http-error"
import type { PosDisplayPublic, PosDisplayState } from "@/lib/pos-display"
import { cn } from "@/lib/utils"

const TIP_OPTIONS = [0, 10, 15, 20]

/**
 * Pantalla pública frente al cliente.
 *
 * Se actualiza sola con el carrito del POS, permite elegir propina y confirmar
 * el pedido. Sin pedido muestra los menús activos como banners.
 */
export function CustomerDisplay({ token }: { token: string }) {
  const [data, setData] = React.useState<PosDisplayPublic | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [savingTip, setSavingTip] = React.useState<number | null>(null)
  const [confirming, setConfirming] = React.useState(false)

  React.useEffect(() => {
    if (!token) return

    let cancelled = false

    const load = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/pos/display/${encodeURIComponent(token)}`,
          { cache: "no-store" }
        )
        const body = await response.json().catch(() => null)

        if (cancelled) return

        if (!response.ok) {
          setError(apiErrorMessage(body, "Esta pantalla no está disponible."))
          return
        }

        setError(null)
        setData(body as PosDisplayPublic)
      } catch {
        if (!cancelled) {
          setError("No se pudo contactar con el servidor.")
        }
      }
    }

    void load()
    const timer = setInterval(() => void load(), 1500)

    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [token])

  const setTip = async (tipPercent: number) => {
    setSavingTip(tipPercent)

    try {
      const response = await fetch(
        `${API_BASE_URL}/pos/display/${encodeURIComponent(token)}/tip`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tipPercent }),
        }
      )

      if (!response.ok) return

      const state = (await response.json()) as PosDisplayState
      setData((current) => (current ? { ...current, state } : current))
    } finally {
      setSavingTip(null)
    }
  }

  const confirm = async () => {
    setConfirming(true)

    try {
      const response = await fetch(
        `${API_BASE_URL}/pos/display/${encodeURIComponent(token)}/confirm`,
        { method: "POST" }
      )

      if (!response.ok) return

      const state = (await response.json()) as PosDisplayState
      setData((current) => (current ? { ...current, state } : current))
    } finally {
      setConfirming(false)
    }
  }

  if (!token || error) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-muted/30 p-6 text-center">
        <div className="flex max-w-sm flex-col items-center gap-2">
          <UtensilsCrossedIcon className="size-8 text-muted-foreground" />
          <p className="text-lg font-medium">Pantalla no disponible</p>
          <p className="text-sm text-muted-foreground">
            {error ?? "Abre el enlace generado en Configuración."}
          </p>
        </div>
      </main>
    )
  }

  if (!data) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-muted/30 p-6">
        <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
      </main>
    )
  }

  const state = data.state
  const hasOrder = Boolean(state && state.items.length > 0)
  const total = state?.total ?? 0
  const tipPercent = state?.tipPercent ?? 0
  const tip = Math.round(((total * tipPercent) / 100) * 100) / 100
  const confirmed = Boolean(state?.confirmedAt)

  return (
    <main className="flex min-h-dvh flex-col bg-background">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b px-6 py-4">
        <div>
          <p className="text-lg font-semibold">{data.organizationName}</p>
          <p className="text-sm text-muted-foreground">
            {data.branchName ?? "Bienvenido"}
          </p>
        </div>
        <Badge variant="outline">{data.displayName}</Badge>
      </header>

      {hasOrder && state ? (
        <div className="grid flex-1 gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="flex min-h-0 flex-col gap-3 overflow-y-auto">
            <h1 className="text-2xl font-semibold">Tu pedido</h1>
            <ul className="flex flex-col gap-2">
              {state.items.map((item, index) => (
                <li
                  key={`${item.name}-${index}`}
                  className="flex items-baseline justify-between gap-3 rounded-xl border bg-card px-4 py-3"
                >
                  <span className="text-lg">
                    <span className="font-semibold tabular-nums">
                      {item.quantity}×
                    </span>{" "}
                    {item.name}
                  </span>
                  <span className="tabular-nums">
                    {formatMoney(item.price * item.quantity)}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <aside className="flex flex-col gap-4 rounded-xl border bg-card p-5">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="text-4xl font-semibold tabular-nums">
                {formatMoney(total)}
              </span>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">¿Deseas dejar propina?</span>
              <div className="grid grid-cols-4 gap-2">
                {TIP_OPTIONS.map((percent) => (
                  <Button
                    key={percent}
                    type="button"
                    variant={tipPercent === percent ? "default" : "outline"}
                    className="h-12 text-base"
                    disabled={confirmed || savingTip !== null}
                    onClick={() => setTip(percent)}
                  >
                    {percent === 0 ? "Sin" : `${percent}%`}
                  </Button>
                ))}
              </div>
              {tipPercent > 0 ? (
                <p className="text-sm text-muted-foreground">
                  Propina {formatMoney(tip)} · total{" "}
                  <span className="font-medium text-foreground tabular-nums">
                    {formatMoney(total + tip)}
                  </span>
                </p>
              ) : null}
            </div>

            {confirmed ? (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-600/40 bg-emerald-500/10 p-3 text-emerald-700 dark:text-emerald-400">
                <CheckCircle2Icon className="size-5" />
                <span className="font-medium">Pedido confirmado</span>
              </div>
            ) : (
              <Button
                type="button"
                size="lg"
                className="w-full"
                disabled={confirming}
                onClick={confirm}
              >
                {confirming ? (
                  <Loader2Icon className="animate-spin" />
                ) : (
                  <CheckCircle2Icon />
                )}
                Confirmar pedido
              </Button>
            )}
          </aside>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
          <div className="flex flex-col items-center gap-2">
            <SparklesIcon className="size-8 text-muted-foreground" />
            <h1 className="text-3xl font-semibold">Bienvenido</h1>
            <p className="text-muted-foreground">
              Tu pedido aparecerá aquí en cuanto empecemos a tomarlo.
            </p>
          </div>

          {data.menus.length > 0 ? (
            <div className="grid w-full max-w-4xl gap-3 sm:grid-cols-2">
              {data.menus.slice(0, 4).map((menu) => (
                <div
                  key={menu.id}
                  className={cn(
                    "flex flex-col gap-1 rounded-xl border bg-card p-4 text-left"
                  )}
                >
                  <span className="text-base font-medium">{menu.name}</span>
                  {menu.description ? (
                    <span className="line-clamp-2 text-sm text-muted-foreground">
                      {menu.description}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </main>
  )
}
