"use client"

import { SoupIcon } from "lucide-react"

import { badgeVariants } from "@/components/ui/badge"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import { formatMoney, type ComboComponent } from "@/lib/catalog"
import { cn } from "cn"

import { comboComponentPrice } from "./combo-metrics"

/** Vista previa de los artículos que componen el combo. */
export function ComboComponentsPreview({
  components,
}: {
  components: ComboComponent[]
}) {
  const count = components.length

  if (count === 0) {
    return <span className="text-muted-foreground">—</span>
  }

  return (
    <HoverCard>
      <HoverCardTrigger
        render={<button type="button" />}
        className={cn(
          badgeVariants({ variant: "outline" }),
          "cursor-default tabular-nums"
        )}
        aria-label={`${count} ${count === 1 ? "artículo" : "artículos"}. Ver detalle`}
      >
        <SoupIcon />
        {count}
      </HoverCardTrigger>
      <HoverCardContent align="end" className="w-64 p-2">
        <p className="px-2 pb-1 text-xs font-medium text-muted-foreground">
          {count === 1 ? "Artículo" : "Artículos"}
        </p>
        <div className="flex flex-col gap-0.5">
          {components.map((component) => (
            <div
              key={component.id}
              className="flex items-center justify-between gap-3 rounded-md px-2 py-1 text-sm"
            >
              <span
                className="min-w-0 truncate"
                title={`${component.componentItem.name}${
                  component.variant ? ` · ${component.variant.name}` : ""
                }`}
              >
                {component.quantity}× {component.componentItem.name}
                {component.variant ? (
                  <span className="text-muted-foreground">
                    {" "}
                    · {component.variant.name}
                  </span>
                ) : null}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {formatMoney(comboComponentPrice(component))}
              </span>
            </div>
          ))}
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}
