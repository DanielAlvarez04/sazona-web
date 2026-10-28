import type { ReactNode } from "react"
import { Building2Icon, Globe2Icon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import type { Branch } from "@/lib/branches"

/**
 * Cabecera común de las páginas de la aplicación.
 *
 * Además del título y la descripción, muestra el alcance de la vista actual
 * (una sucursal concreta o toda la organización) para que el usuario sepa
 * siempre sobre qué datos está trabajando.
 */
export function PageHeader({
  title,
  description,
  branch,
  actions,
}: {
  title: string
  description?: ReactNode
  /** Sucursal activa; `null` = vista consolidada de la organización. */
  branch?: Branch | null
  /** Botones o controles alineados a la derecha. */
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
          <BranchScopeBadge branch={branch} />
        </div>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  )
}

/**
 * Pastilla con el alcance de la vista: nombre de la sucursal activa o
 * "Toda la organización" cuando se muestran datos consolidados.
 */
export function BranchScopeBadge({ branch }: { branch?: Branch | null }) {
  if (!branch) {
    return (
      <Badge variant="outline" className="gap-1.5 font-normal">
        <Globe2Icon data-icon="inline-start" />
        Toda la organización
      </Badge>
    )
  }

  return (
    <Badge variant="secondary" className="gap-1.5 font-normal">
      <Building2Icon data-icon="inline-start" />
      {branch.name}
    </Badge>
  )
}
