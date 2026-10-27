"use client"

import { CheckIcon, Loader2Icon, XIcon } from "lucide-react"

import { FieldLabel } from "@/components/ui/field"

export type AvailabilityState =
  | "idle"
  | "checking"
  | "ok"
  | "taken"
  | "invalid"
  | "error"

export interface AvailabilityStatus {
  state: AvailabilityState
  message: string | null
}

const STATUS_STYLES: Record<AvailabilityState, string> = {
  idle: "",
  checking: "text-muted-foreground",
  ok: "text-emerald-600 dark:text-emerald-400",
  taken: "text-destructive",
  invalid: "text-destructive",
  error: "text-amber-600 dark:text-amber-400",
}

/** Confirmación de disponibilidad con icono y color según el estado. */
export function AvailabilityBadge({ status }: { status: AvailabilityStatus }) {
  return (
    <span
      aria-live="polite"
      className={`inline-flex items-center gap-1 text-xs font-medium ${STATUS_STYLES[status.state]}`}
    >
      {status.state === "idle" ? null : (
        <>
          {status.state === "checking" ? (
            <Loader2Icon className="size-3.5 animate-spin" aria-hidden="true" />
          ) : null}
          {status.state === "ok" ? (
            <CheckIcon className="size-3.5" aria-hidden="true" />
          ) : null}
          {status.state === "taken" ||
          status.state === "invalid" ||
          status.state === "error" ? (
            <XIcon className="size-3.5" aria-hidden="true" />
          ) : null}
          {status.message}
        </>
      )}
    </span>
  )
}

/** Fila de label con la disponibilidad alineada a la derecha. */
export function AvailabilityLabel({
  htmlFor,
  label,
  status,
}: {
  htmlFor: string
  label: string
  status: AvailabilityStatus
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <FieldLabel htmlFor={htmlFor}>{label}</FieldLabel>
      <AvailabilityBadge status={status} />
    </div>
  )
}
