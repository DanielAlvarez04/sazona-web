"use client"

import { useRouter } from "next/navigation"
import { useState, type FormEvent } from "react"
import {
  Building2Icon,
  Loader2Icon,
  PencilIcon,
  PlusIcon,
  PowerIcon,
  RotateCcwIcon,
  XIcon,
} from "lucide-react"
import { toast } from "sonner"

import {
  createBranch,
  setBranchActive,
  updateBranch,
} from "@/app/(app)/settings/actions"
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
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useActionForm } from "@/hooks/use-action-form"
import {
  MAX_ACTIVE_BRANCHES,
  RECOMMENDED_USERS_PER_BRANCH,
  type Branch,
} from "@/lib/branches"

/**
 * Sucursales del negocio.
 *
 * Por ahora agrupan al personal; el inventario y los pedidos se vincularán por
 * sucursal en una fase posterior para no mezclar existencias entre locales.
 */
export function BranchesCard({
  branches,
  canManage,
}: {
  branches: Branch[]
  canManage: boolean
}) {
  const router = useRouter()
  const form = useActionForm(() => {
    resetForm()
    router.refresh()
  })

  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [address, setAddress] = useState("")
  const [phone, setPhone] = useState("")
  const [busyId, setBusyId] = useState<string | null>(null)

  const activeCount = branches.filter((branch) => branch.isActive).length
  const atLimit = activeCount >= MAX_ACTIVE_BRANCHES
  const editing = branches.find((branch) => branch.id === editingId) ?? null
  const showForm = canManage && (editing !== null || !atLimit)

  function resetForm() {
    setEditingId(null)
    setName("")
    setAddress("")
    setPhone("")
  }

  function startEditing(branch: Branch) {
    setEditingId(branch.id)
    setName(branch.name)
    setAddress(branch.address ?? "")
    setPhone(branch.phone ?? "")
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData()
    formData.append("name", name)
    formData.append("address", address)
    formData.append("phone", phone)

    if (editingId) {
      formData.append("id", editingId)
    }

    form.run(() =>
      editingId ? updateBranch(formData) : createBranch(formData)
    )
  }

  async function toggleActive(branch: Branch) {
    setBusyId(branch.id)
    try {
      const formData = new FormData()
      formData.append("id", branch.id)
      formData.append("isActive", String(!branch.isActive))
      const result = await setBranchActive(formData)

      if (result.ok) {
        toast.success(
          branch.isActive ? "Sucursal desactivada" : "Sucursal activada"
        )
        router.refresh()
      } else {
        toast.error(result.message ?? "No se pudo actualizar la sucursal")
      }
    } catch {
      toast.error("No se pudo actualizar la sucursal")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sucursales</CardTitle>
        <CardDescription>
          Crea tus locales y asigna a cada empleado su sucursal principal.
        </CardDescription>
        <Badge variant="outline" className="w-fit">
          {activeCount} de {MAX_ACTIVE_BRANCHES} activas
        </Badge>
      </CardHeader>

      <CardContent className="gap-4">
        {branches.length === 0 ? (
          <div className="flex items-start gap-3 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            <Building2Icon className="mt-0.5 size-4 shrink-0" />
            <p>
              Aún no hay sucursales. Crea la primera para separar al personal por
              local.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {branches.map((branch) => (
              <li
                key={branch.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium">
                      {branch.name}
                    </span>
                    <Badge variant={branch.isActive ? "secondary" : "outline"}>
                      {branch.isActive ? "Activa" : "Inactiva"}
                    </Badge>
                  </div>
                  {branch.address || branch.phone ? (
                    <span className="truncate text-xs text-muted-foreground">
                      {[branch.address, branch.phone].filter(Boolean).join(" · ")}
                    </span>
                  ) : null}
                  <span className="text-xs text-muted-foreground">
                    {branch.userCount ?? 0} usuario(s) asignado(s)
                  </span>
                </div>

                {canManage ? (
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => startEditing(branch)}
                      aria-label={`Editar ${branch.name}`}
                    >
                      <PencilIcon />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => toggleActive(branch)}
                      disabled={busyId === branch.id}
                      aria-label={
                        branch.isActive
                          ? `Desactivar ${branch.name}`
                          : `Activar ${branch.name}`
                      }
                    >
                      {busyId === branch.id ? (
                        <Loader2Icon className="animate-spin" />
                      ) : branch.isActive ? (
                        <PowerIcon />
                      ) : (
                        <RotateCcwIcon />
                      )}
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {!canManage ? (
          <p className="text-xs text-muted-foreground">
            Solo administración puede crear o cambiar sucursales.
          </p>
        ) : null}

        {atLimit && !editing ? (
          <p className="text-xs text-muted-foreground">
            Llegaste al límite de {MAX_ACTIVE_BRANCHES} sucursales activas.
            Desactiva una para crear otra.
          </p>
        ) : null}

        {showForm ? (
          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">
                {editing ? `Editar ${editing.name}` : "Nueva sucursal"}
              </span>
              {editing ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={resetForm}
                  aria-label="Cancelar edición"
                >
                  <XIcon />
                </Button>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field className="sm:col-span-2">
                <FieldLabel htmlFor="branch-name">Nombre</FieldLabel>
                <Input
                  id="branch-name"
                  name="name"
                  maxLength={80}
                  placeholder="Sucursal Centro"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="branch-address">Dirección (opcional)</FieldLabel>
                <Input
                  id="branch-address"
                  name="address"
                  maxLength={160}
                  placeholder="Av. Juárez 123"
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="branch-phone">Teléfono (opcional)</FieldLabel>
                <Input
                  id="branch-phone"
                  name="phone"
                  maxLength={40}
                  placeholder="555 123 4567"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                />
              </Field>
            </div>

            <FieldDescription>
              Uso justo: hasta {MAX_ACTIVE_BRANCHES} sucursales activas y{" "}
              {RECOMMENDED_USERS_PER_BRANCH} usuarios sugeridos por sucursal.
            </FieldDescription>

            <div className="flex justify-end gap-2">
              {editing ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetForm}
                  disabled={form.pending}
                >
                  Cancelar
                </Button>
              ) : null}
              <Button type="submit" disabled={form.pending}>
                {form.pending ? (
                  <Loader2Icon className="animate-spin" />
                ) : editing ? (
                  <PencilIcon />
                ) : (
                  <PlusIcon />
                )}
                {editing ? "Guardar cambios" : "Crear sucursal"}
              </Button>
            </div>

            {form.error ? <FieldError>{form.error}</FieldError> : null}
          </form>
        ) : null}
      </CardContent>
    </Card>
  )
}
