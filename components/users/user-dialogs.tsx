"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { Loader2Icon, SaveIcon, UserPlusIcon, EyeIcon, EyeOffIcon } from "lucide-react"

import {
  createInternalUser,
  updateInternalUser,
} from "@/app/(app)/users/actions"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useActionForm } from "@/hooks/use-action-form"
import type { Branch } from "@/lib/branches"
import {
  ROLE_OPTIONS,
  type InternalUser,
  type RoleCode,
} from "@/lib/users"
import { AvailabilityLabel } from "@/components/availability-field"
import {
  useUsernameStatus,
  generateUsernameCandidates,
} from "./username-field"


function RolePicker({
  value,
  onChange,
}: {
  value: RoleCode[]
  onChange: (roles: RoleCode[]) => void
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {ROLE_OPTIONS.map((option) => {
        const checked = value.includes(option.value)

        return (
          <label
            key={option.value}
            className="flex cursor-pointer items-start gap-2 rounded-lg border border-border/60 p-3 text-sm transition-colors hover:bg-muted/50"
          >
            <Checkbox
              checked={checked}
              onCheckedChange={(next) =>
                onChange(
                  next
                    ? [...value, option.value]
                    : value.filter((role) => role !== option.value)
                )
              }
              aria-label={option.label}
            />
            <span className="flex flex-col gap-0.5">
              <span className="font-medium">{option.label}</span>
              <span className="text-xs text-muted-foreground">
                {option.description}
              </span>
            </span>
          </label>
        )
      })}
    </div>
  )
}

/**
 * Input de usuario del equipo con la parte del dominio fija.
 *
 * Solo la parte local (antes del `@`) es editable. El dominio del negocio se
 * muestra como texto no editable a la derecha, y el valor completo
 * (`local@dominio`) se envía en el formulario a través de un input oculto.
 *
 * `displayValue` es lo que se muestra (sugerencia o edición manual).
 * `onChange` recibe la parte local y marca como edición manual.
 */
function UsernameWithDomainInput({
  id,
  domain,
  displayValue,
  placeholder,
  onChange,
  required,
  readOnly,
}: {
  id: string
  domain: string
  displayValue: string
  placeholder: string
  onChange: (localPart: string) => void
  required?: boolean
  readOnly?: boolean
}) {
  return (
    <div className="relative flex items-center w-full">
      <Input
        id={id}
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        maxLength={120}
        placeholder={placeholder}
        value={displayValue}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        readOnly={readOnly}
        className="pr-12"
      />
      <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground">
        @{domain}
      </span>
      <input
        type="hidden"
        name="username"
        value={displayValue ? `${displayValue}@${domain}` : ""}
      />
    </div>
  )
}

/** Input de contraseña con botón para mostrar/ocultar. */
function PasswordInput({
  id,
  name,
  placeholder,
  value,
  onChange,
  required = false,
  disabled = false,
  autoComplete = "new-password",
}: {
  id: string
  name: string
  placeholder: string
  value: string
  onChange: (value: string) => void
  required?: boolean
  disabled?: boolean
  autoComplete?: string
}) {
  const [show, setShow] = useState(false)

  return (
    <div className="relative">
      <Input
        id={id}
        name={name}
        type={show ? "text" : "password"}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        disabled={disabled}
        className="pr-10"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="absolute right-0 top-0 h-full"
        onClick={() => setShow(!show)}
        aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
      >
        {show ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
      </Button>
    </div>
  )
}

/** Selector de sucursal principal. Vacío = acceso a todas. */
function BranchPicker({
  id,
  branches,
  value,
  onChange,
}: {
  id: string
  branches: Branch[]
  value: string
  onChange: (value: string) => void
}) {
  const activeBranches = branches.filter((branch) => branch.isActive)

  if (activeBranches.length === 0) {
    return null
  }

  return (
    <Field>
      <FieldLabel htmlFor={id}>Sucursal principal (opcional)</FieldLabel>
      <Select
        value={value || "all"}
        onValueChange={(next) =>
          onChange(!next || next === "all" ? "" : next)
        }
        items={[
          { label: "Todas las sucursales", value: "all" },
          ...activeBranches.map((branch) => ({
            label: branch.name,
            value: branch.id,
          })),
        ]}
      >
        <SelectTrigger id={id}>
          <SelectValue placeholder="Todas las sucursales" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas las sucursales</SelectItem>
          {activeBranches.map((branch) => (
            <SelectItem key={branch.id} value={branch.id}>
              {branch.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <input type="hidden" name="branchId" value={value} />
      <FieldDescription>
        Déjalo en «Todas» para que el usuario pueda atender cualquier local.
      </FieldDescription>
    </Field>
  )
}

/** Separa el nombre guardado en nombre de pila y apellido (conserva mayúsculas). */
function splitDisplayName(name: string): { first: string; surname: string } {
  const trimmed = name.trim()
  const index = trimmed.indexOf(" ")
  if (index === -1) return { first: trimmed, surname: "" }
  return { first: trimmed.slice(0, index), surname: trimmed.slice(index + 1).trim() }
}

export function CreateUserDialog({
  onClose,
  organizationDomain,
  branches,
}: {
  onClose: () => void
  organizationDomain: string
  branches: Branch[]
}) {
  const router = useRouter()
  const [roles, setRoles] = useState<RoleCode[]>(["WAITER"])
  const [branchId, setBranchId] = useState("")
  const [name, setName] = useState("")
  const [surname, setSurname] = useState("")
  const [manualUsernameLocalPart, setManualUsernameLocalPart] = useState("")
  const domain = organizationDomain
  const manualUsername = manualUsernameLocalPart
    ? `${manualUsernameLocalPart}@${domain}`
    : null

  // Nombre completo para la sugerencia de username (nombre + apellido)
  const fullName = [name.trim(), surname.trim()].filter(Boolean).join(" ")

  // Generamos los candidatos locales (incluye opción con solo el nombre y con inicial+último apellido)
  const localCandidates = generateUsernameCandidates(fullName, domain)

  // Índice del candidato del cual mostramos el username. Se reinicia cuando
  // cambia el nombre completo (ajuste durante el render, sin efectos).
  const [candidate, setCandidate] = useState({ name: fullName, index: 0 })

  if (candidate.name !== fullName) {
    setCandidate({ name: fullName, index: 0 })
  }

  const candidateIndex =
    candidate.name === fullName ? candidate.index : 0

  // Elegimos el candidato activo: prioridad edición manual > candidato local actual
  const activeCandidate = manualUsername ?? localCandidates[candidateIndex] ?? ""
  const displayUsername = activeCandidate ? activeCandidate.split("@")[0] : ""
  const username = activeCandidate
  const usernameStatus = useUsernameStatus(username)

  // Si el candidato está tomado, avanzamos al siguiente disponible.
  const [takenCandidate, setTakenCandidate] = useState<string | null>(null)

  if (
    usernameStatus.state === "taken" &&
    takenCandidate !== username &&
    candidateIndex < localCandidates.length - 1
  ) {
    setTakenCandidate(username)
    setCandidate({ name: fullName, index: candidateIndex + 1 })
  }
  const { pending, error, run } = useActionForm(() => {
    onClose()
    router.refresh()
  })

  const [password, setPassword] = useState("")

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuevo usuario del equipo</DialogTitle>
          <DialogDescription>
            La cuenta funciona con usuario y contraseña.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(event) => {
            event.preventDefault()
            const form = event.currentTarget
            const formData = new FormData(form)
            formData.delete("roles")

            for (const role of roles) {
              formData.append("roles", role)
            }

            run(() => createInternalUser(formData))
          }}
        >
          <div className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="new-name">Nombre</FieldLabel>
                <Input
                  id="new-name"
                  name="name"
                  autoComplete="given-name"
                  maxLength={80}
                  placeholder="Elizabeth"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="new-surname">Apellido</FieldLabel>
                <Input
                  id="new-surname"
                  name="surname"
                  autoComplete="family-name"
                  maxLength={80}
                  placeholder="Ramírez"
                  value={surname}
                  onChange={(event) => setSurname(event.target.value)}
                />
              </Field>
            </div>

            <Field>
              <AvailabilityLabel
                htmlFor="new-username"
                label="ID de usuario"
                status={usernameStatus}
              />
              <UsernameWithDomainInput
                id="new-username"
                domain={domain}
                displayValue={displayUsername}
                placeholder="elizabeth"
                onChange={setManualUsernameLocalPart}
                required
              />
              <FieldDescription>
                Se genera a partir del nombre; puedes editarlo.
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="new-password">Contraseña inicial</FieldLabel>
              <PasswordInput
                id="new-password"
                name="password"
                placeholder="Letras y números, mínimo 8"
                value={password}
                onChange={setPassword}
                required
              />
            </Field>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Roles</span>
              <RolePicker value={roles} onChange={setRoles} />
              {roles.length === 0 ? (
                <p className="text-sm text-destructive">
                  Elige al menos un rol.
                </p>
              ) : null}
            </div>

            <BranchPicker
              id="new-branch"
              branches={branches}
              value={branchId}
              onChange={setBranchId}
            />

            {error ? <FieldError>{error}</FieldError> : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={
                  pending || roles.length === 0 || usernameStatus.state !== "ok"
                }
              >
                {pending ? (
                  <Loader2Icon className="animate-spin" />
                ) : (
                  <UserPlusIcon />
                )}
                Crear usuario
              </Button>
            </DialogFooter>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function EditUserDialog({
  user,
  isSelf,
  onClose,
  branches,
}: {
  user: InternalUser
  isSelf: boolean
  onClose: () => void
  branches: Branch[]
}) {
  const router = useRouter()
  const initialName = splitDisplayName(user.name ?? "")
  const [name, setName] = useState(initialName.first)
  const [surname, setSurname] = useState(initialName.surname)
  const [roles, setRoles] = useState<RoleCode[]>(user.roles)
  const [branchId, setBranchId] = useState(user.branchId ?? "")
  const [active, setActive] = useState(user.isActive)
  const [password, setPassword] = useState("")
  const { pending, error, run } = useActionForm(() => {
    onClose()
    router.refresh()
  })

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar {user.name ?? user.username ?? "usuario"}</DialogTitle>
          <DialogDescription>
            Cambia el nombre, los roles o la contraseña. Guardar una nueva
            contraseña cierra todas sus sesiones activas.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(event) => {
            event.preventDefault()
            const form = event.currentTarget
            const formData = new FormData(form)
            formData.delete("roles")

            for (const role of roles) {
              formData.append("roles", role)
            }

            run(() => updateInternalUser(user.id, formData))
          }}
        >
          <div className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="edit-name">Nombre</FieldLabel>
                <Input
                  id="edit-name"
                  name="name"
                  autoComplete="given-name"
                  maxLength={80}
                  placeholder="Elizabeth"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="edit-surname">Apellido</FieldLabel>
                <Input
                  id="edit-surname"
                  name="surname"
                  autoComplete="family-name"
                  maxLength={80}
                  placeholder="Ramírez"
                  value={surname}
                  onChange={(event) => setSurname(event.target.value)}
                />
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="edit-password">
                Nueva contraseña (opcional)
              </FieldLabel>
              <PasswordInput
                id="edit-password"
                name="password"
                placeholder="Déjalo vacío para conservarla"
                value={password}
                onChange={setPassword}
              />
            </Field>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Roles</span>
              <RolePicker value={roles} onChange={setRoles} />
              {roles.length === 0 ? (
                <p className="text-sm text-destructive">
                  Elige al menos un rol.
                </p>
              ) : null}
            </div>

            <BranchPicker
              id="edit-branch"
              branches={branches}
              value={branchId}
              onChange={setBranchId}
            />

            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={active}
                onCheckedChange={(next) => setActive(Boolean(next))}
                disabled={isSelf}
              />
              Cuenta activa
              {isSelf ? (
                <span className="text-xs text-muted-foreground">
                  (no puedes desactivar tu propia cuenta)
                </span>
              ) : null}
            </label>
            <input
              type="hidden"
              name="isActive"
              value={active ? "on" : "off"}
            />

            {error ? <FieldError>{error}</FieldError> : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={pending || roles.length === 0}
              >
                {pending ? (
                  <Loader2Icon className="animate-spin" />
                ) : (
                  <SaveIcon />
                )}
                Guardar cambios
              </Button>
            </DialogFooter>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}