import { GroupIcon } from "lucide-react"

import { Badge, badgeVariants } from "@/components/ui/badge"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import { cn } from "cn"

export interface ComboUsage {
  id: string
  combo: { id: string; name: string; isActive: boolean }
}

/**
 * Badge de combos donde se usa el artículo. Al pasar el cursor muestra los
 * nombres; cada nombre abre el combo para editarlo.
 */
export function ComboBadge({
  combos,
  onEditCombo,
}: {
  combos: ComboUsage[]
  onEditCombo: (comboId: string) => void
}) {
  if (combos.length === 0) return null

  return (
    <HoverCard>
      <HoverCardTrigger
        render={<button type="button" />}
        className={cn(
          badgeVariants({ variant: "outline" }),
          "cursor-pointer border-sky-700 bg-sky-500/10 text-sky-700 dark:border-sky-400 dark:bg-sky-400/10 dark:text-sky-400"
        )}
        aria-label={`${combos.length} ${
          combos.length === 1 ? "combo" : "combos"
        }. Ver y editar`}
      >
        <GroupIcon />
        {combos.length}
      </HoverCardTrigger>
      <HoverCardContent align="end" className="w-60 p-2">
        <p className="px-2 pb-1 text-xs font-medium text-muted-foreground">
          {combos.length === 1 ? "Combo" : "Combos"}
        </p>
        <div className="flex flex-col gap-0.5">
          {combos.map(({ id, combo }) => (
            <button
              key={id}
              type="button"
              onClick={() => onEditCombo(combo.id)}
              className="flex items-center justify-between gap-2 rounded-md px-2 py-1 text-left text-sm hover:bg-muted"
              title={combo.name}
            >
              <span className="truncate">{combo.name}</span>
              {combo.isActive ? null : (
                <Badge variant="outline" className="shrink-0 text-[10px]">
                  Inactivo
                </Badge>
              )}
            </button>
          ))}
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}
