"use client"

import * as React from "react"
import { GroupIcon, PencilIcon, PowerIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  PROMOTION_TYPE_LABELS,
  formatMoney,
  type ArticleListItem,
} from "@/lib/catalog"
import { cn } from "cn"

import { ComboActionsMenu, type ComboRowActions } from "./combos-columns"
import { comboPricing } from "./combo-metrics"

function useComboImage(combo: ArticleListItem) {
  const [failedSrc, setFailedSrc] = React.useState<string | null>(null)
  const src = combo.imageUrl ?? null

  return {
    src,
    showFallback: !src || failedSrc === src,
    handleError: () => setFailedSrc(src),
  }
}

function FullComboCard({
  combo,
  actions,
  canSelect,
  selected,
  onSelectedChange,
}: {
  combo: ArticleListItem
  actions: ComboRowActions
  canSelect: boolean
  selected: boolean
  onSelectedChange: (id: string, selected: boolean) => void
}) {
  const { src, showFallback, handleError } = useComboImage(combo)
  const { normal, effective, promotion } = comboPricing(combo)

  return (
    <div
      data-selected={selected || undefined}
      className={cn(
        "rounded-xl",
        "data-[selected=true]:ring-2 data-[selected=true]:ring-primary"
      )}
    >
      <Card size="sm" className="gap-0 overflow-hidden p-0 py-0">
        <div className="relative aspect-square w-full">
          <div className="absolute inset-0 bg-muted">
            {showFallback ? (
              <div className="flex size-full items-center justify-center text-muted-foreground">
                <GroupIcon className="size-12" aria-hidden />
                <span className="sr-only">Sin imagen</span>
              </div>
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={src ?? undefined}
                alt={combo.name}
                className={cn(
                  "size-full object-cover",
                  !combo.isActive && "grayscale"
                )}
                onError={handleError}
              />
            )}
          </div>

          <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/85 via-black/30 to-black/10" />

          <div className="relative flex size-full flex-col p-2 text-white">
            <div className="flex items-start justify-between gap-1">
              {canSelect ? (
                <Checkbox
                  checked={selected}
                  onCheckedChange={(value) =>
                    onSelectedChange(combo.id, !!value)
                  }
                  aria-label={`Seleccionar ${combo.name}`}
                  className="border-white/70 bg-black/30"
                />
              ) : (
                <span />
              )}

              <ComboActionsMenu
                combo={combo}
                actions={actions}
                triggerSize="icon-sm"
              />
            </div>

            <div className="mt-auto flex min-w-0 flex-col gap-1">
              <div className="flex flex-wrap gap-1">
                {promotion ? (
                  <Badge className="border border-white/30 bg-black/30 text-white backdrop-blur-sm">
                    {promotion.isActive
                      ? PROMOTION_TYPE_LABELS[promotion.type]
                      : "Promoción inactiva"}
                  </Badge>
                ) : null}
                {combo.isActive ? null : (
                  <Badge className="border border-amber-300/40 bg-amber-400/20 text-amber-200 backdrop-blur-sm">
                    Inactivo
                  </Badge>
                )}
              </div>

              <div className="flex min-w-0 items-baseline gap-1">
                <span className="text-[15px] leading-none font-normal tabular-nums text-white drop-shadow-sm">
                  {formatMoney(effective)}
                </span>
                {effective !== normal ? (
                  <span className="text-[11px] leading-none text-white/70 line-through">
                    {formatMoney(normal)}
                  </span>
                ) : null}
              </div>

              <p
                className="line-clamp-2 text-pretty text-base font-semibold leading-snug drop-shadow-sm"
                title={combo.name}
              >
                {combo.name}
              </p>
            </div>
          </div>
        </div>

        <div
          role="group"
          aria-label={`Acciones de ${combo.name}`}
          className="flex items-center justify-end gap-1 border-t bg-muted px-2 py-2"
        >
          {combo.isActive ? (
            <Button
              size="sm"
              className="w-max shadow-sm"
              onClick={() => actions.onEdit(combo)}
            >
              <PencilIcon className="size-4" />
              Editar
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => actions.onEdit(combo)}
                aria-label={`Editar ${combo.name}`}
              >
                <PencilIcon className="size-4" />
              </Button>
              <Button
                size="sm"
                className="w-max shadow-sm"
                onClick={() => actions.onActivate(combo)}
              >
                <PowerIcon className="size-4" />
                Activar
              </Button>
            </>
          )}
        </div>
      </Card>
    </div>
  )
}

export function ComboCards({
  combos,
  actions,
  canSelect = false,
  selectedIds,
  onSelectedChange,
}: {
  combos: ArticleListItem[]
  actions: ComboRowActions
  canSelect?: boolean
  selectedIds: Record<string, boolean>
  onSelectedChange: (id: string, selected: boolean) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-[repeat(var(--np-card-columns,6),minmax(0,1fr))]">
      {combos.map((combo) => (
        <FullComboCard
          key={combo.id}
          combo={combo}
          actions={actions}
          canSelect={canSelect}
          selected={selectedIds[combo.id] ?? false}
          onSelectedChange={onSelectedChange}
        />
      ))}
    </div>
  )
}
