"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { Loader2Icon, SaveIcon, FileTextIcon, AlertCircleIcon } from "lucide-react"
import { toast } from "sonner"

import { importIngredientsFromCsv } from "@/app/(app)/inventory/actions"
import { Button } from "@/components/ui/button"
import { FieldError } from "@/components/ui/field"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"

const CSV_EXAMPLE = `nombre,unidad,categoria,ubicacion,costoUnitario,stockMaximo,stockInicial,stockMinimo
Tomate,KG,Frutas y verduras,Refrigerador,25,50,10,2
Cebolla,KG,Frutas y verduras,Almacén seco,15,30,5,1
Lechuga,UNIT,Frutas y verduras,Refrigerador,8,20,20,5
Aceite de oliva,ML,"Aceites, salsas y condimentos",Almacén seco,45,200,1000,200
Sal,G,"Aceites, salsas y condimentos",Almacén seco,5,100,500,100`

/**
 * Sheet para importar ingredientes desde CSV.
 *
 * Formato esperado:
 * nombre,unidad,categoria,ubicacion,costoUnitario,stockMaximo,stockInicial,stockMinimo
 *
 * - unidad: código de unidad (G, KG, ML, L, UNIT, etc.)
 * - categoria: obligatoria; debe existir en el sistema (el SKU se genera solo)
 * - ubicacion: nombre de la ubicación (opcional)
 * - costoUnitario/stockMaximo/stockInicial/stockMinimo: números (0 por defecto)
 * - La primera línea puede ser cabecera (se ignora si contiene "nombre" o "unidad")
 */
export function ImportCsvSheet({
  open,
  onOpenChange,
  branchName = null,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Sucursal donde se registra el stock inicial; `null` = organización. */
  branchName?: string | null
}) {
  const router = useRouter()
  const [csv, setCsv] = useState(CSV_EXAMPLE)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<string[][]>([])
  const [showPreview, setShowPreview] = useState(false)

  /** Divide una línea respetando comillas (categorías con comas). */
  function parseCsvLine(line: string): string[] {
    const values: string[] = []
    let current = ""
    let quoted = false

    for (let i = 0; i < line.length; i += 1) {
      const char = line[i]

      if (char === '"') {
        if (quoted && line[i + 1] === '"') {
          current += '"'
          i += 1
        } else {
          quoted = !quoted
        }
        continue
      }

      if (char === "," && !quoted) {
        values.push(current.trim())
        current = ""
        continue
      }

      current += char
    }

    values.push(current.trim())
    return values
  }

  function parseCsv(text: string): string[][] {
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)

    if (lines.length === 0) return []

    // Misma heurística que la API: si la primera fila es cabecera, no se muestra.
    const hasHeader = /nombre|name|unidad|baseunit|stock|min|category|categoria|location|ubicacion|cost|costo/i.test(
      lines[0]
    )

    return lines.slice(hasHeader ? 1 : 0).map(parseCsvLine)
  }

  function updatePreview() {
    try {
      const rows = parseCsv(csv)
      setPreview(rows)
    } catch {
      setPreview([])
    }
  }

  function handleSubmit() {
    setError(null)

    if (!csv.trim()) {
      setError("El CSV está vacío")
      return
    }

    setPending(true)

    importIngredientsFromCsv(csv)
      .then((result) => {
        if (!result.ok) {
          setError(result.message ?? "No se pudieron importar los ingredientes")
          return
        }

        toast.success(
          result.data && Array.isArray(result.data)
            ? `${result.data.length} insumos importados`
            : "Insumos importados"
        )
        setCsv(CSV_EXAMPLE)
        updatePreview()
        onOpenChange(false)
        router.refresh()
      })
      .catch(() => {
        setError("Error de conexión. Inténtalo de nuevo.")
      })
      .finally(() => {
        setPending(false)
      })
  }

  function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      setCsv(text)
      updatePreview()
    }
    reader.readAsText(file)
    event.target.value = ""
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setCsv(CSV_EXAMPLE)
          setError(null)
          setPreview([])
        }
        onOpenChange(next)
      }}
    >
      <SheetContent side="right" className="data-[side=right]:sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>Importar insumos (CSV)</SheetTitle>
          <SheetDescription>
            Pega o sube un CSV con los insumos. La primera fila puede ser
            cabecera (se ignora automáticamente). La categoría es obligatoria y
            el SKU se genera automáticamente.
            {branchName
              ? ` El stock inicial se registra en ${branchName}.`
              : ""}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4">
          <div className="flex flex-wrap gap-2">
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground hover:bg-accent hover:border-accent transition-colors">
              <FileTextIcon className="size-4" />
              <input
                type="file"
                accept=".csv,.txt"
                onChange={handleFileUpload}
                className="sr-only"
              />
              Subir archivo .csv
            </label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowPreview(!showPreview)}
            >
              {showPreview ? "Ocultar" : "Ver"} previsualización
            </Button>
          </div>

          <Textarea
            value={csv}
            onChange={(event) => {
              setCsv(event.target.value)
              updatePreview()
            }}
            placeholder={CSV_EXAMPLE}
            className="font-mono text-xs min-h-[200px] resize-y"
            aria-label="Contenido CSV"
            disabled={pending}
          />

          <p className="text-xs text-muted-foreground">
            Columnas: <code className="font-mono">nombre</code>,
            <code className="font-mono">unidad</code>,
            <code className="font-mono">categoria</code> (obligatoria),
            <code className="font-mono">ubicacion</code>,
            <code className="font-mono">costoUnitario</code>,
            <code className="font-mono">stockMaximo</code>,
            <code className="font-mono">stockInicial</code>,
            <code className="font-mono">stockMinimo</code>. Unidades válidas:
            G, KG, ML, L, UNIT, TSP, TBSP, CUP, etc. Si el nombre de la
            categoría lleva comas, escríbelo entre comillas (ej.{" "}
            <code className="font-mono">
              &quot;Aceites, salsas y condimentos&quot;
            </code>
            ).
          </p>

          {showPreview && preview.length > 0 && (
            <div className="rounded-lg border bg-muted/50 p-3 max-h-60 overflow-auto">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Previsualización ({preview.length} fila{preview.length === 1 ? "" : "s"}):
              </p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="pb-1">#</th>
                    <th className="pb-1">Insumo</th>
                    <th className="pb-1">Unidad</th>
                    <th className="pb-1">Categoría</th>
                    <th className="pb-1">Ubicación</th>
                    <th className="pb-1">Costo Unit.</th>
                    <th className="pb-1">Máx.</th>
                    <th className="pb-1">Stock Inicial</th>
                    <th className="pb-1">Stock Mínimo</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(0, 20).map((row, i) => (
                    <tr key={i} className="border-t">
                      <td className="py-1 text-muted-foreground">{i + 1}</td>
                      <td className="py-1 font-medium">{row[0] ?? ""}</td>
                      <td className="py-1">{row[1] ?? "UNIT"}</td>
                      <td className="py-1">{row[2] ?? ""}</td>
                      <td className="py-1">{row[3] ?? ""}</td>
                      <td className="py-1 tabular-nums">{row[4] ?? "0"}</td>
                      <td className="py-1 tabular-nums">{row[5] ?? "0"}</td>
                      <td className="py-1 tabular-nums">{row[6] ?? "0"}</td>
                      <td className="py-1 tabular-nums">{row[7] ?? "0"}</td>
                    </tr>
                  ))}
                  {preview.length > 20 && (
                    <tr>
                      <td colSpan={9} className="py-1 text-center text-muted-foreground">
                        … y {preview.length - 20} más
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {error ? (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircleIcon className="size-4" />
              <FieldError>{error}</FieldError>
            </div>
          ) : null}
        </div>

        <SheetFooter className="flex-row justify-end gap-2 border-t">
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button type="button" disabled={pending} onClick={handleSubmit}>
            {pending ? (
              <Loader2Icon className="animate-spin" />
            ) : (
              <>
                <SaveIcon className="mr-2 h-4 w-4" />
                Importar
              </>
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}