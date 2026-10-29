"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  CopyIcon,
  FileUpIcon,
  Loader2Icon,
  TriangleAlertIcon,
  UploadIcon,
} from "lucide-react"
import { toast } from "sonner"

import { importIngredientsFromCsv } from "@/app/(app)/inventory/actions"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
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
import { FieldError } from "@/components/ui/field"
import { clearDraft, readDraft, writeDraft } from "@/lib/drafts"
import type { ImportIngredientsMode } from "@/lib/catalog"
import { cn } from "cn"

const DRAFT_KEY = "ingredient-import"

/** Motivo por el que una fila del CSV se considera duplicada. */
type DuplicateReason = "existing" | "file"

interface DuplicateRow {
  /** Índice de la fila dentro del CSV ya parseado (sin cabecera). */
  index: number
  name: string
  reason: DuplicateReason
}

const DUPLICATE_OPTIONS: Array<{
  value: ImportIngredientsMode
  label: string
  description: string
}> = [
  {
    value: "exclude",
    label: "Excluir todos",
    description: "No se importan; el inventario queda igual.",
  },
  {
    value: "duplicate",
    label: "Duplicar",
    description: 'Se crean con " [ DUPLICADO]" en el nombre.',
  },
  {
    value: "overwrite",
    label: "Sobreescribir",
    description: "Se reemplazan los datos de los insumos existentes.",
  },
]

/**
 * Diálogo para importar insumos desde CSV.
 *
 * Formato esperado:
 * nombre,unidad,categoria,ubicacion,costoUnitario,stockMaximo,stockInicial,stockMinimo
 *
 * - unidad: código de unidad (G, KG, ML, L, UNIT, etc.)
 * - categoria: obligatoria; debe existir en el sistema (el SKU se genera solo)
 * - ubicacion: nombre de la ubicación (opcional)
 * - costoUnitario/stockMaximo/stockInicial/stockMinimo: números (0 por defecto)
 * - La primera línea puede ser cabecera (se ignora si contiene "nombre" o "unidad")
 *
 * Antes de importar se detectan los nombres repetidos (en el propio archivo o
 * ya existentes en el inventario) y el usuario elige qué hacer con ellos:
 * excluirlos, duplicarlos con un sufijo o sobreescribir los existentes. El
 * cliente solo muestra el aviso; la decisión se aplica en la API.
 */
export function ImportIngredientsDialog({
  open,
  onOpenChange,
  branchName = null,
  existingNames = [],
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Sucursal donde se registra el stock inicial; `null` = organización. */
  branchName?: string | null
  /** Nombres de los insumos que ya existen (para detectar duplicados). */
  existingNames?: string[]
}) {
  const router = useRouter()

  // Borrador: si el diálogo se cierra por accidente, al reabrirlo sigue el CSV.
  const [draft] = useState(() => readDraft<string>(DRAFT_KEY))
  const [csv, setCsv] = useState(draft ?? "")
  const [fileName, setFileName] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<ImportIngredientsMode>("exclude")
  /** Modo destructivo pendiente de confirmar. */
  const [confirmMode, setConfirmMode] = useState<
    "duplicate" | "overwrite" | null
  >(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const rows = parseCsv(csv)
  const duplicates = findDuplicates(rows, existingNames)

  /** Guarda el CSV antes de cerrar para poder recuperarlo al reabrir. */
  function handleOpenChange(next: boolean) {
    if (!next) writeDraft(DRAFT_KEY, csv)

    onOpenChange(next)
  }

  function loadFile(file: File) {
    if (!/\.(csv|txt)$/i.test(file.name)) {
      setError("El archivo debe ser .csv o .txt")
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      setCsv(String(reader.result ?? ""))
      setFileName(file.name)
      setError(null)
      // Cada archivo nuevo empieza sin duplicados resueltos.
      setMode("exclude")
    }
    reader.onerror = () => setError("No se pudo leer el archivo")
    reader.readAsText(file)
  }

  function handleDrop(event: React.DragEvent) {
    // Deja pasar los arrastres de texto: solo interceptamos archivos.
    if (!event.dataTransfer.types.includes("Files")) return

    event.preventDefault()
    setDragActive(false)

    const file = event.dataTransfer.files?.[0]
    if (file) loadFile(file)
  }

  function handleClear() {
    clearDraft(DRAFT_KEY)
    setCsv("")
    setFileName(null)
    setMode("exclude")
    setError(null)
  }

  function handleSubmit() {
    setError(null)

    if (!csv.trim()) {
      setError("El CSV está vacío")
      return
    }

    setPending(true)

    importIngredientsFromCsv(csv, mode)
      .then((result) => {
        if (!result.ok) {
          setError(result.message ?? "No se pudieron importar los insumos")
          return
        }

        const count =
          result.data && Array.isArray(result.data)
            ? result.data.length
            : null

        toast.success(
          count === null
            ? "Insumos procesados"
            : mode === "overwrite"
              ? `${count} insumos actualizados`
              : `${count} insumos importados`
        )
        clearDraft(DRAFT_KEY)
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

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          className="flex max-h-[90dvh] flex-col sm:max-w-md"
          // Se puede soltar el archivo en cualquier parte del diálogo.
          onDragOver={(event) => {
            if (!event.dataTransfer.types.includes("Files")) return
            event.preventDefault()
            setDragActive(true)
          }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node)) {
              setDragActive(false)
            }
          }}
          onDrop={handleDrop}
        >
          <DialogHeader>
            <DialogTitle>Importar insumos</DialogTitle>
            <DialogDescription>
              Sube un archivo CSV. ¿No tienes uno?{" "}
              <a href="/plantilla-insumos.csv" download>
                Descarga la plantilla
              </a>
              .
              {branchName
                ? ` El stock inicial se registra en ${branchName}.`
                : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="flex min-h-0 flex-col gap-3 overflow-y-auto">
            <button
              type="button"
              disabled={pending}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed px-4 py-6 text-center transition-colors",
                dragActive
                  ? "border-primary bg-accent"
                  : "border-border hover:border-primary/60 hover:bg-muted/50",
                pending && "pointer-events-none opacity-60"
              )}
            >
              {fileName ? (
                <FileUpIcon className="size-6 text-muted-foreground" />
              ) : (
                <UploadIcon className="size-6 text-muted-foreground" />
              )}
              <span className="max-w-full truncate text-sm font-medium">
                {fileName ?? "Arrastra tu archivo CSV aquí"}
              </span>
              <span className="text-xs text-muted-foreground">
                {fileName
                  ? "Haz clic para elegir otro archivo"
                  : "o haz clic para buscarlo en tu dispositivo (.csv, .txt)"}
              </span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt,text/csv"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) loadFile(file)
                event.target.value = ""
              }}
            />

            {duplicates.length > 0 ? (
              <div className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-3">
                <div className="flex flex-col gap-0.5">
                  <p className="text-sm font-medium">
                    {duplicates.length === 1
                      ? "1 insumo duplicado"
                      : `${duplicates.length} insumos duplicados`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Elige qué hacer con ellos antes de importar.
                  </p>
                </div>

                <div
                  role="radiogroup"
                  aria-label="Acción para los insumos duplicados"
                  className="flex flex-col gap-1.5"
                >
                  {DUPLICATE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={mode === option.value}
                      onClick={() =>
                        option.value === "exclude"
                          ? setMode("exclude")
                          : setConfirmMode(option.value)
                      }
                      className={cn(
                        "flex items-start gap-2 rounded-md border px-2.5 py-2 text-left transition-colors",
                        mode === option.value
                          ? "border-primary bg-accent"
                          : "hover:bg-muted/60"
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "mt-0.5 size-3.5 shrink-0 rounded-full border",
                          mode === option.value
                            ? "border-primary bg-primary"
                            : "border-input"
                        )}
                      />
                      <span className="flex flex-col">
                        <span className="text-sm font-medium">
                          {option.label}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {option.description}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>

                <ul className="mt-1 flex max-h-32 flex-col gap-1 overflow-y-auto border-t pt-2">
                  {duplicates.map((duplicate) => (
                    <li
                      key={duplicate.index}
                      className="flex items-center gap-2 text-sm"
                    >
                      <span className="truncate">{duplicate.name}</span>
                      <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                        {duplicate.reason === "file"
                          ? "repetido en el archivo"
                          : "ya existe"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {error ? <FieldError>{error}</FieldError> : null}
          </div>

          <DialogFooter>
            <ClearFieldsButton
              onClick={handleClear}
              disabled={pending}
              className="sm:mr-auto"
            />
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={pending || csv.trim().length === 0}
              onClick={handleSubmit}
            >
              {pending ? <Loader2Icon className="animate-spin" /> : null}
              Importar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={confirmMode !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmMode(null)
        }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10 text-destructive">
              {confirmMode === "overwrite" ? (
                <TriangleAlertIcon />
              ) : (
                <CopyIcon />
              )}
            </AlertDialogMedia>
            <AlertDialogTitle>
              {confirmMode === "overwrite"
                ? "¿Sobreescribir los insumos existentes?"
                : "¿Duplicar los insumos repetidos?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmMode === "overwrite"
                ? `Se reemplazarán los datos de los ${duplicates.length} registros duplicados con los del archivo: unidad, categoría, ubicación, costo y stocks mínimo/máximo. El stock actual no cambia y esta acción no se puede deshacer.`
                : `Se crearán ${duplicates.length} insumos nuevos con " [ DUPLICADO]" añadido al nombre. Los insumos originales no cambian.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (confirmMode) setMode(confirmMode)
                setConfirmMode(null)
              }}
            >
              {confirmMode === "overwrite" ? "Sobreescribir" : "Duplicar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

/** Normaliza un nombre para comparar coincidencias exactas. */
function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase()
}

/**
 * Filas cuyo nombre ya existe en el inventario o se repite dentro del archivo.
 * La primera aparición de un nombre se considera válida.
 */
function findDuplicates(
  rows: string[][],
  existingNames: string[]
): DuplicateRow[] {
  const existing = new Set(existingNames.map(normalizeName))
  const seen = new Set<string>()
  const duplicates: DuplicateRow[] = []

  rows.forEach((cells, index) => {
    const name = (cells[0] ?? "").trim()
    if (!name) return

    const key = normalizeName(name)

    if (existing.has(key)) {
      duplicates.push({ index, name, reason: "existing" })
      return
    }

    if (seen.has(key)) {
      duplicates.push({ index, name, reason: "file" })
      return
    }

    seen.add(key)
  })

  return duplicates
}

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
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  if (lines.length === 0) return []

  // Misma heurística que la API: si la primera fila es cabecera, no se muestra.
  const hasHeader =
    /nombre|name|unidad|baseunit|stock|min|category|categoria|location|ubicacion|cost|costo/i.test(
      lines[0]
    )

  return lines.slice(hasHeader ? 1 : 0).map(parseCsvLine)
}
