"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { Loader2Icon, UploadIcon } from "lucide-react"

import { importItems } from "@/app/(app)/catalog/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ClearFieldsButton } from "@/components/ui/clear-fields-button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import type { ImportResult } from "@/lib/catalog"

const EXAMPLE = `sku,name,category,description,price,taxRate,isActive
CAF-LAT,Latte,Bebidas calientes,Espresso con leche,55,0.16,true
PAN-CRO,Croissant,Panadería,Hojaldre de mantequilla,28,0.16,true`

export function ImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [csv, setCsv] = useState("")
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  /** Devuelve el formulario a su estado inicial (CSV vacío y sin resultados). */
  function handleClear() {
    setCsv("")
    setResult(null)
    setError(null)
  }

  function submit(dryRun: boolean) {
    setError(null)
    startTransition(async () => {
      const response = await importItems(csv, dryRun)

      if (!response.ok) {
        setResult(null)
        setError(response.message ?? "No se pudo importar el CSV")
        return
      }

      setResult(response.data ?? null)
      if (!dryRun) router.refresh()
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        // El CSV se conserva al cerrar (por si fue un cierre accidental);
        // los resultados de la última validación no.
        if (!next) {
          setResult(null)
          setError(null)
        }
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar artículos desde CSV</DialogTitle>
          <DialogDescription>
            Columnas admitidas: <code>sku, name, category, description, price,
            taxRate, isActive</code>. Se actualiza por SKU (o por nombre si no
            hay SKU) y las categorías se crean solas.
          </DialogDescription>
        </DialogHeader>

        <Field>
          <FieldLabel htmlFor="csv-content">Contenido del CSV</FieldLabel>
          <Textarea
            id="csv-content"
            value={csv}
            onChange={(event) => setCsv(event.target.value)}
            rows={10}
            spellCheck={false}
            className="font-mono text-xs"
            placeholder={EXAMPLE}
          />
        </Field>

        {error ? <FieldError>{error}</FieldError> : null}

        {result ? (
          <div className="flex flex-col gap-3 rounded-md border p-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant={result.dryRun ? "outline" : "secondary"}>
                {result.dryRun ? "Simulación" : "Importado"}
              </Badge>
              <span>{result.totalRows} fila(s)</span>
              <span className="text-emerald-600 dark:text-emerald-400">
                {result.created} creada(s)
              </span>
              <span className="text-sky-600 dark:text-sky-400">
                {result.updated} actualizada(s)
              </span>
              <span className="text-destructive">
                {result.skipped} con error
              </span>
            </div>

            {result.errors.length > 0 ? (
              <div className="no-scrollbar max-h-40 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-muted-foreground">
                    <tr>
                      <th className="py-1 pr-2 font-medium">Fila</th>
                      <th className="py-1 pr-2 font-medium">Columna</th>
                      <th className="py-1 font-medium">Problema</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.errors.map((rowError) => (
                      <tr key={`${rowError.row}-${rowError.column ?? ""}`}>
                        <td className="py-1 pr-2 tabular-nums">
                          {rowError.row}
                        </td>
                        <td className="py-1 pr-2">{rowError.column ?? "—"}</td>
                        <td className="py-1">{rowError.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        ) : null}

        <DialogFooter>
          <ClearFieldsButton
            onClick={handleClear}
            disabled={pending || csv.length === 0}
            className="sm:mr-auto"
          />
          <Button
            type="button"
            variant="outline"
            disabled={pending || csv.trim().length === 0}
            onClick={() => submit(true)}
          >
            {pending ? <Loader2Icon className="animate-spin" /> : null}
            Validar
          </Button>
          <Button
            type="button"
            disabled={pending || csv.trim().length === 0}
            onClick={() => submit(false)}
          >
            {pending ? <Loader2Icon className="animate-spin" /> : <UploadIcon />}
            Importar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
