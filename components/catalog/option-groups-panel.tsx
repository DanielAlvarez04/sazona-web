"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  ListChecksIcon,
  Loader2Icon,
  PencilIcon,
  PlusIcon,
  PowerIcon,
  SaveIcon,
  Trash2Icon,
} from "lucide-react"
import { toast } from "sonner"

import {
  createOptionGroup,
  createOptionValue,
  deactivateOptionGroup,
  deactivateOptionValue,
  updateOptionGroup,
  updateOptionValue,
  type OptionValueUpdateInput,
} from "@/app/(app)/catalog/actions"
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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useActionForm } from "@/hooks/use-action-form"
import type { OptionGroup, OptionGroupPreset } from "@/lib/catalog"

interface ValueRow {
  key: string
  /** Ausente en valores nuevos que todavía no existen en la biblioteca. */
  id?: string
  name: string
  kitchenLabel: string
  isActive: boolean
}

let valueCounter = 0

function nextValueKey() {
  valueCounter += 1
  return `option-value-${valueCounter}`
}

function valueRows(group: OptionGroup | null): ValueRow[] {
  const rows = (group?.values ?? []).map((value) => ({
    key: nextValueKey(),
    id: value.id,
    name: value.name,
    kitchenLabel: value.kitchenLabel ?? "",
    isActive: value.isActive,
  }))

  return rows.length > 0
    ? rows
    : [{ key: nextValueKey(), name: "", kitchenLabel: "", isActive: true }]
}

export function OptionGroupsPanel({
  groups,
  presets,
  canManage,
}: {
  groups: OptionGroup[]
  presets: OptionGroupPreset[]
  canManage: boolean
}) {
  const router = useRouter()
  const rowForm = useActionForm(() => router.refresh())

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<OptionGroup | null>(null)
  const [confirmDeactivate, setConfirmDeactivate] =
    useState<OptionGroup | null>(null)

  function openNew() {
    setEditing(null)
    setDialogOpen(true)
  }

  function openEdit(group: OptionGroup) {
    setEditing(group)
    setDialogOpen(true)
  }

  function handleActivate(group: OptionGroup) {
    rowForm.run(() =>
      updateOptionGroup(group.id, { isActive: true }).then((result) => {
        if (result.ok) toast.success("Grupo activado")
        return result
      })
    )
  }

  function confirmDeactivateAction() {
    const group = confirmDeactivate
    if (!group) return

    rowForm.run(() =>
      deactivateOptionGroup(group.id).then((result) => {
        if (result.ok) toast.success("Grupo desactivado")
        return result
      })
    )
    setConfirmDeactivate(null)
  }

  function createFromPreset(preset: OptionGroupPreset) {
    rowForm.run(() =>
      createOptionGroup({
        name: preset.name,
        description: preset.description,
        values: preset.values,
      }).then((result) => {
        if (result.ok) toast.success(`Grupo «${preset.name}» creado`)
        return result
      })
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="gap-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle>Grupos de opciones</CardTitle>
              <CardDescription>
                Biblioteca de grupos reutilizables: salsas, proteínas, leches,
                extras, “sin…”. El precio y la opción predeterminada se
                configuran en cada artículo.
              </CardDescription>
            </div>
            {canManage ? (
              <Button type="button" onClick={openNew}>
                <PlusIcon />
                Nuevo grupo
              </Button>
            ) : null}
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          {canManage && presets.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted-foreground">
                Crear desde plantilla:
              </span>
              {presets.map((preset) => (
                <Button
                  key={preset.name}
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={
                    rowForm.pending ||
                    groups.some((group) => group.name === preset.name)
                  }
                  onClick={() => createFromPreset(preset)}
                >
                  {preset.name}
                </Button>
              ))}
            </div>
          ) : null}

          {rowForm.error ? (
            <p role="alert" className="text-sm text-destructive">
              {rowForm.error}
            </p>
          ) : null}

          {groups.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-10 text-center">
              <ListChecksIcon className="size-8 text-muted-foreground" />
              <div>
                <p className="font-medium">Todavía no hay grupos</p>
                <p className="text-sm text-muted-foreground">
                  Crea el primer grupo o usa una plantilla para empezar.
                </p>
              </div>
              {canManage ? (
                <Button type="button" onClick={openNew}>
                  <PlusIcon />
                  Crear grupo
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {groups.map((group) => {
                const activeValues = group.values.filter(
                  (value) => value.isActive
                )

                return (
                  <div
                    key={group.id}
                    className="flex flex-col gap-2 rounded-xl border p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{group.name}</p>
                        <p className="line-clamp-2 text-xs text-muted-foreground">
                          {group.description ?? "Sin descripción"}
                        </p>
                      </div>
                      <Badge variant={group.isActive ? "secondary" : "outline"}>
                        {group.isActive ? "Activo" : "Inactivo"}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {activeValues.slice(0, 6).map((value) => (
                        <span
                          key={value.id}
                          className="rounded-md bg-muted px-1.5 py-0.5 text-xs"
                        >
                          {value.name}
                        </span>
                      ))}
                      {activeValues.length === 0 ? (
                        <span className="text-xs text-muted-foreground">
                          Sin opciones activas
                        </span>
                      ) : null}
                      {activeValues.length > 6 ? (
                        <span className="px-1 text-xs text-muted-foreground">
                          +{activeValues.length - 6}
                        </span>
                      ) : null}
                    </div>

                    <p className="text-xs text-muted-foreground">
                      {group._count?.itemGroups ?? 0} artículo
                      {(group._count?.itemGroups ?? 0) === 1 ? "" : "s"} ·{" "}
                      {group.values.length} opción
                      {group.values.length === 1 ? "" : "es"}
                    </p>

                    {canManage ? (
                      <div className="mt-auto flex flex-wrap gap-2 pt-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openEdit(group)}
                        >
                          <PencilIcon />
                          Editar
                        </Button>
                        {group.isActive ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfirmDeactivate(group)}
                          >
                            <PowerIcon />
                            Desactivar
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleActivate(group)}
                          >
                            <PowerIcon />
                            Activar
                          </Button>
                        )}
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {dialogOpen && canManage ? (
        <OptionGroupDialog
          group={editing}
          onClose={() => setDialogOpen(false)}
        />
      ) : null}

      <AlertDialog
        open={confirmDeactivate !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDeactivate(null)
        }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogMedia>
              <PowerIcon />
            </AlertDialogMedia>
            <AlertDialogTitle>Desactivar grupo</AlertDialogTitle>
            <AlertDialogDescription>
              El grupo «{confirmDeactivate?.name ?? ""}» dejará de estar
              disponible para asignarlo a artículos. Los artículos que ya lo
              usan conservan su configuración.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeactivateAction}>
              Desactivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function OptionGroupDialog({
  group,
  onClose,
}: {
  group: OptionGroup | null
  onClose: () => void
}) {
  const router = useRouter()
  const form = useActionForm(() => {
    toast.success(group ? "Grupo actualizado" : "Grupo creado")
    router.refresh()
    onClose()
  })

  const [name, setName] = useState(group?.name ?? "")
  const [description, setDescription] = useState(group?.description ?? "")
  const [isActive, setIsActive] = useState(group?.isActive ?? true)
  const [values, setValues] = useState<ValueRow[]>(() => valueRows(group))

  function updateValue(key: string, changes: Partial<ValueRow>) {
    setValues((current) =>
      current.map((row) => (row.key === key ? { ...row, ...changes } : row))
    )
  }

  function addValue() {
    setValues((current) => [
      ...current,
      { key: nextValueKey(), name: "", kitchenLabel: "", isActive: true },
    ])
  }

  function removeValue(key: string) {
    setValues((current) => current.filter((row) => row.key !== key))
  }

  function save() {
    const trimmedName = name.trim()

    if (!trimmedName) {
      form.setError("El nombre del grupo es obligatorio")
      return
    }

    const prepared = values
      .map((row) => ({
        ...row,
        name: row.name.trim(),
        kitchenLabel: row.kitchenLabel.trim(),
      }))
      .filter((row) => row.id || row.name)

    if (prepared.some((row) => !row.name)) {
      form.setError("Cada opción necesita un nombre")
      return
    }

    const activeRows = prepared.filter((row) => row.isActive && row.name)

    const names = activeRows.map((row) => row.name.toLowerCase())
    if (new Set(names).size !== names.length) {
      form.setError("No puede haber dos opciones con el mismo nombre")
      return
    }

    if (!group) {
      form.run(() =>
        createOptionGroup({
          name: trimmedName,
          description: description.trim() || undefined,
          values: activeRows.map((row) => ({
            name: row.name,
            ...(row.kitchenLabel
              ? { kitchenLabel: row.kitchenLabel }
              : {}),
          })),
        })
      )
      return
    }

    const changes = {
      ...(group.name === trimmedName ? {} : { name: trimmedName }),
      ...((group.description ?? "") === description.trim()
        ? {}
        : { description: description.trim() || null }),
      ...(group.isActive === isActive ? {} : { isActive }),
    }

    const existing = group.values
    const incomingIds = new Set(
      prepared.filter((row) => row.id).map((row) => row.id as string)
    )
    const removed = existing.filter((value) => !incomingIds.has(value.id))

    const updates: Array<{
      valueId: string
      input: OptionValueUpdateInput
    }> = []
    const creates: Array<{
      name: string
      kitchenLabel?: string
      sortOrder?: number
    }> = []

    prepared.forEach((row, index) => {
      if (!row.id) {
        if (row.isActive && row.name) {
          creates.push({
            name: row.name,
            ...(row.kitchenLabel
              ? { kitchenLabel: row.kitchenLabel }
              : {}),
            sortOrder: index,
          })
        }
        return
      }

      const current = existing.find((value) => value.id === row.id)
      if (!current) return

      const input: OptionValueUpdateInput = {}

      if (current.name !== row.name) input.name = row.name
      if ((current.kitchenLabel ?? "") !== row.kitchenLabel) {
        input.kitchenLabel = row.kitchenLabel || null
      }
      if (current.isActive !== row.isActive) input.isActive = row.isActive
      if (current.sortOrder !== index) input.sortOrder = index

      if (Object.keys(input).length > 0) {
        updates.push({ valueId: row.id, input })
      }
    })

    if (
      Object.keys(changes).length === 0 &&
      updates.length === 0 &&
      creates.length === 0 &&
      removed.length === 0
    ) {
      toast.info("Sin cambios")
      onClose()
      return
    }

    form.run(async () => {
      if (Object.keys(changes).length > 0) {
        const updated = await updateOptionGroup(group.id, changes)
        if (!updated.ok) return updated
      }

      for (const update of updates) {
        const result = await updateOptionValue(
          group.id,
          update.valueId,
          update.input
        )
        if (!result.ok) return result
      }

      for (const create of creates) {
        const result = await createOptionValue(group.id, create)
        if (!result.ok) return result
      }

      for (const value of removed) {
        const result = await deactivateOptionValue(group.id, value.id)
        if (!result.ok) return result
      }

      return { ok: true }
    })
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="no-scrollbar max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {group ? "Editar grupo de opciones" : "Nuevo grupo de opciones"}
          </DialogTitle>
          <DialogDescription>
            Define las opciones reutilizables. El cargo y la opción
            predeterminada se asignan por artículo.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
            <Field>
              <FieldLabel htmlFor="group-name">
                Nombre <span className="text-destructive">*</span>
              </FieldLabel>
              <Input
                id="group-name"
                value={name}
                maxLength={80}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ej. Nivel de picante"
              />
            </Field>

            <div className="flex items-end justify-between gap-3 rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Activo</p>
                <p className="text-xs text-muted-foreground">
                  Disponible al editar artículos
                </p>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          </div>

          <Field>
            <FieldLabel htmlFor="group-description">Descripción</FieldLabel>
            <Textarea
              id="group-description"
              value={description}
              maxLength={300}
              rows={2}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Para qué se usa este grupo"
            />
          </Field>

          <Separator />

          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <Label className="text-sm font-medium">
                  Opciones <span className="text-destructive">*</span>
                </Label>
                <p className="text-xs text-muted-foreground">
                  La etiqueta de cocina es opcional; si falta se usa el nombre.
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addValue}>
                <PlusIcon />
                Añadir opción
              </Button>
            </div>

            <div className="flex flex-col gap-2">
              {values.map((row) => (
                <div
                  key={row.key}
                  className="grid gap-2 rounded-md border p-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto]"
                >
                  <Input
                    value={row.name}
                    placeholder="Nombre de la opción"
                    aria-label="Nombre de la opción"
                    onChange={(event) =>
                      updateValue(row.key, { name: event.target.value })
                    }
                  />
                  <Input
                    value={row.kitchenLabel}
                    placeholder="Etiqueta de cocina (opcional)"
                    aria-label="Etiqueta de cocina"
                    onChange={(event) =>
                      updateValue(row.key, {
                        kitchenLabel: event.target.value,
                      })
                    }
                  />
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    Activa
                    <Switch
                      checked={row.isActive}
                      onCheckedChange={(checked) =>
                        updateValue(row.key, { isActive: checked })
                      }
                    />
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={Boolean(row.id)}
                    title={
                      row.id
                        ? "Usa el interruptor Activa para ocultarla"
                        : "Quitar opción"
                    }
                    aria-label="Quitar opción"
                    onClick={() => removeValue(row.key)}
                  >
                    <Trash2Icon />
                  </Button>
                </div>
              ))}
            </div>
          </section>

          {form.error ? <FieldError>{form.error}</FieldError> : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={form.pending}
          >
            Cancelar
          </Button>
          <Button type="button" onClick={save} disabled={form.pending}>
            {form.pending ? (
              <Loader2Icon className="animate-spin" />
            ) : (
              <SaveIcon />
            )}
            {group ? "Guardar grupo" : "Crear grupo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
