"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { cn } from "cn"
import { Loader2Icon, SaveIcon, UserPlusIcon, EyeIcon, EyeOffIcon } from "lucide-react"

import {
  createInternalUser,
  updateInternalUser,
} from "@/app/(app)/users/actions"
import { Button } from "@/components/ui/button"
import { ClearFieldsButton } from "@/components/ui/clear-fields-button"
import { Checkbox } from "@/components/ui/checkbox"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useActionForm } from "@/hooks/use-action-form"
import type { Branch } from "@/lib/branches"
import { clearDraft, readDraft, writeDraft } from "@/lib/drafts"
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

/** Borrador de un formulario de usuario (se recupera si se cierra por error). */
interface UserDraft {
  name: string
  surname: string
  password: string
  username: string
  branchId: string
  roles: RoleCode[]
}


function RolePicker({
  value,
  onChange,
  columns = 2,
}: {
  value: RoleCode[]
  onChange: (roles: RoleCode[]) => void
  /** Roles por fila en pantallas grandes. */
  columns?: 2 | 3
}) {
  return (
    <div
      className={cn(
        "grid gap-2",
        columns === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"
      )}
    >
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
  disabled,
}: {
  id: string
  domain: string
  displayValue: string
  placeholder: string
  onChange?: (localPart: string) => void
  required?: boolean
  disabled?: boolean
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
        onChange={(event) => onChange?.(event.target.value)}
        required={required}
        disabled={disabled}
        className="pr-12"
      />
      <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground group-data-[disabled=true]/field:opacity-50">
        @{domain}
      </span>
      {disabled ? null : (
        <input
          type="hidden"
          name="username"
          value={displayValue ? `${displayValue}@${domain}` : ""}
        />
      )}
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

/** Selector de sucursal. Vacío = acceso a todas (solo cuando no es obligatorio). */
function BranchPicker({
  id,
  branches,
  value,
  onChange,
  required = false,
}: {
  id: string
  branches: Branch[]
  value: string
  onChange: (value: string) => void
  /** Exige elegir una sucursal concreta (alta de usuarios). */
  required?: boolean
}) {
  const activeBranches = branches.filter((branch) => branch.isActive)

  if (activeBranches.length === 0) {
    return null
  }

  const branchItems = activeBranches.map((branch) => ({
    label: branch.name,
    value: branch.id,
  }))

  return (
    <Field>
      <FieldLabel htmlFor={id} required={required}>
        Sucursal
      </FieldLabel>
      <Select
        required={required}
        value={required ? value || null : value || "all"}
        onValueChange={(next) =>
          onChange(!next || next === "all" ? "" : next)
        }
        items={
          required
            ? branchItems
            : [{ label: "Todas las sucursales", value: "all" }, ...branchItems]
        }
      >
        <SelectTrigger id={id}>
          <SelectValue
            placeholder={
              required ? "Selecciona una sucursal" : "Todas las sucursales"
            }
          />
        </SelectTrigger>
        <SelectContent>
          {required ? null : (
            <SelectItem value="all">Todas las sucursales</SelectItem>
          )}
          {activeBranches.map((branch) => (
            <SelectItem key={branch.id} value={branch.id}>
              {branch.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <input type="hidden" name="branchId" value={value} />
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
  const draftKey = "user:new"
  const [draft] = useState(() => readDraft<UserDraft>(draftKey))
  const [roles, setRoles] = useState<RoleCode[]>(draft?.roles ?? ["WAITER"])
  const [branchId, setBranchId] = useState(draft?.branchId ?? "")
  const [name, setName] = useState(draft?.name ?? "")
  const [surname, setSurname] = useState(draft?.surname ?? "")
  const [manualUsernameLocalPart, setManualUsernameLocalPart] = useState(
    draft?.username ?? ""
  )
  const [password, setPassword] = useState(draft?.password ?? "")
  const domain = organizationDomain
  const hasBranches = branches.some((branch) => branch.isActive)
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
    clearDraft(draftKey)
    onClose()
    router.refresh()
  })

  /** Guarda el borrador antes de cerrar, para recuperarlo al reabrir. */
  function handleClose() {
    writeDraft<UserDraft>(draftKey, {
      name,
      surname,
      password,
      username: manualUsernameLocalPart,
      branchId,
      roles,
    })
    onClose()
  }

  /** Devuelve el formulario a su estado inicial y descarta el borrador. */
  function handleClear() {
    clearDraft(draftKey)
    setName("")
    setSurname("")
    setPassword("")
    setManualUsernameLocalPart("")
    setBranchId("")
    setRoles(["WAITER"])
  }

  return (
    <Dialog open onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-3xl">
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
            {/* Fila 1: Nombre, Apellido e ID de usuario. */}
            <div className="grid gap-3 sm:grid-cols-[2fr_2fr_3fr]">
              <Field>
                <FieldLabel htmlFor="new-name" required>
                  Nombre
                </FieldLabel>
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
                <FieldLabel htmlFor="new-surname" required>
                  Apellido
                </FieldLabel>
                <Input
                  id="new-surname"
                  name="surname"
                  autoComplete="family-name"
                  maxLength={80}
                  placeholder="Ramírez"
                  value={surname}
                  onChange={(event) => setSurname(event.target.value)}
                  required
                />
              </Field>
              <Field>
                <AvailabilityLabel
                  htmlFor="new-username"
                  label="ID de usuario"
                  status={usernameStatus}
                  required
                />
                <UsernameWithDomainInput
                  id="new-username"
                  domain={domain}
                  displayValue={displayUsername}
                  placeholder="elizabeth"
                  onChange={setManualUsernameLocalPart}
                  required
                />
              </Field>
            </div>

            {/* Fila 2: Contraseña y Sucursal. */}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="new-password" required>
                  Contraseña inicial
                </FieldLabel>
                <PasswordInput
                  id="new-password"
                  name="password"
                  placeholder="Letras y números, mínimo 8"
                  value={password}
                  onChange={setPassword}
                  required
                />
              </Field>

              <BranchPicker
                id="new-branch"
                branches={branches}
                value={branchId}
                onChange={setBranchId}
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">
                Roles
                <span aria-hidden="true" className="ml-0.5 text-destructive">
                  *
                </span>
              </span>
              <RolePicker value={roles} onChange={setRoles} columns={3} />
              {roles.length === 0 ? (
                <p className="text-sm text-destructive">
                  Elige al menos un rol.
                </p>
              ) : null}
            </div>

            {error ? <FieldError>{error}</FieldError> : null}

            <DialogFooter>
              <ClearFieldsButton
                onClick={handleClear}
                disabled={pending}
                className="sm:mr-auto"
              />
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={
                  pending ||
                  roles.length === 0 ||
                  usernameStatus.state !== "ok" ||
                  (hasBranches && !branchId)
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
  onClose,
  branches,
  organizationDomain,
}: {
  user: InternalUser
  onClose: () => void
  branches: Branch[]
  organizationDomain: string
}) {
  const router = useRouter()
  const initialName = splitDisplayName(user.name ?? "")

  // Borrador: lo editado se guarda al cerrar y se recupera al reabrir. Se
  // descarta solo cuando el formulario se guarda con éxito.
  const draftKey = `user:${user.id}`
  const [draft] = useState(() => readDraft<UserDraft>(draftKey))
  const [name, setName] = useState(draft?.name ?? initialName.first)
  const [surname, setSurname] = useState(draft?.surname ?? initialName.surname)
  const [roles, setRoles] = useState<RoleCode[]>(draft?.roles ?? user.roles)
  const [branchId, setBranchId] = useState(
    draft?.branchId ?? user.branchId ?? ""
  )
  const [password, setPassword] = useState(draft?.password ?? "")

  // El ID de usuario no se puede cambiar: se muestra tal cual está guardado.
  const storedUsername = user.username ?? ""
  const [usernameLocalPart, usernameDomain] = storedUsername.includes("@")
    ? [
        storedUsername.slice(0, storedUsername.lastIndexOf("@")),
        storedUsername.slice(storedUsername.lastIndexOf("@") + 1),
      ]
    : [storedUsername, organizationDomain]

  const { pending, error, run } = useActionForm(() => {
    clearDraft(draftKey)
    onClose()
    router.refresh()
  })

  /** Guarda el borrador antes de cerrar, para recuperarlo al reabrir. */
  function handleClose() {
    writeDraft<UserDraft>(draftKey, {
      name,
      surname,
      password,
      username: "",
      branchId,
      roles,
    })
    onClose()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            Editar {user.name ?? user.username ?? "usuario"}
          </DialogTitle>
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
            {/* Fila 1: Nombre, Apellido e ID de usuario (solo lectura). */}
            <div className="grid gap-3 sm:grid-cols-[2fr_2fr_3fr]">
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
              <Field data-disabled>
                <FieldLabel htmlFor="edit-username">ID de usuario</FieldLabel>
                <UsernameWithDomainInput
                  id="edit-username"
                  domain={usernameDomain}
                  displayValue={usernameLocalPart}
                  placeholder="Sin usuario"
                  disabled
                />
              </Field>
            </div>

            {/* Fila 2: Nueva contraseña y Sucursal. */}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="edit-password">
                  Nueva contraseña
                </FieldLabel>
                <PasswordInput
                  id="edit-password"
                  name="password"
                  placeholder="Déjalo vacío para conservarla"
                  value={password}
                  onChange={setPassword}
                />
              </Field>

              <BranchPicker
                id="edit-branch"
                branches={branches}
                value={branchId}
                onChange={setBranchId}
              />
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">
                Roles
                <span aria-hidden="true" className="ml-0.5 text-destructive">
                  *
                </span>
              </span>
              <RolePicker value={roles} onChange={setRoles} columns={3} />
              {roles.length === 0 ? (
                <p className="text-sm text-destructive">
                  Elige al menos un rol.
                </p>
              ) : null}
            </div>

            {error ? <FieldError>{error}</FieldError> : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pending || roles.length === 0}>
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