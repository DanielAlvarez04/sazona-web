import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { UNIT_GROUPS } from "@/lib/catalog"

const factorFormatter = new Intl.NumberFormat("es-MX", {
  maximumFractionDigits: 10,
})

/**
 * Catálogo de unidades de consumo. Es informativo: las equivalencias dentro de
 * cada dimensión vienen del sistema y no se editan desde la aplicación.
 */
export function UnitsCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Unidades</CardTitle>
        <CardDescription>
          Catálogo fijo de unidades de consumo para recetas e inventario. No es
          editable: las equivalencias dentro de cada dimensión son estándar.
        </CardDescription>
      </CardHeader>
      <CardContent className="gap-4">
        <div className="grid gap-3 lg:grid-cols-3">
          {UNIT_GROUPS.map((group) => (
            <div
              key={group.dimension}
              className="flex flex-col rounded-lg border"
            >
              <div className="border-b bg-muted/40 px-3 py-2 text-sm font-medium">
                {group.label}
              </div>
              <dl className="flex flex-col gap-2 p-3 text-sm">
                {group.units.map((unit) => (
                  <div
                    key={unit.code}
                    className="flex items-baseline justify-between gap-3"
                  >
                    <dt className="min-w-0">
                      {unit.name}{" "}
                      <span className="font-mono text-xs text-muted-foreground">
                        {unit.symbol}
                      </span>
                    </dt>
                    <dd className="shrink-0 font-mono text-xs text-muted-foreground">
                      {factorFormatter.format(unit.factor)} {group.baseSymbol}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Estas equivalencias culinarias presuponen medidas estándar: cucharadita
          de 5 ml, cucharada de 15 ml, taza métrica de 250 ml, onza líquida
          estadounidense de 29.5735295625 ml y galón estadounidense de
          3,785.411784 ml. Una taza o cucharada puede variar según el país o la
          receta, así que el estándar de la app es el que se muestra aquí.
        </p>
      </CardContent>
    </Card>
  )
}
