"use client"

import { useEffect, useState } from "react"

import { checkDomainAvailability } from "@/app/onboarding/actions"
import type { AvailabilityStatus } from "@/components/availability-field"
import { isValidDomain, normalizeDomain } from "@/lib/domain"

const IDLE: AvailabilityStatus = { state: "idle", message: null }

const INVALID_MESSAGE = "Dominio no válido"

interface RemoteStatus {
  domain: string
  status: AvailabilityStatus
}

/**
 * Comprueba si el dominio del negocio está libre.
 *
 * Mismo patrón que `useUsernameStatus`: los estados locales se derivan del
 * valor y solo el resultado de la API vive en estado.
 */
export function useDomainStatus(
  value: string,
  {
    currentDomain,
    debounceMs = 400,
  }: { currentDomain?: string | null; debounceMs?: number } = {}
): AvailabilityStatus {
  const normalized = normalizeDomain(value)
  const isCurrent = Boolean(currentDomain) && normalized === normalizeDomain(currentDomain ?? "")
  const isInvalid = !isCurrent && !isValidDomain(normalized)

  const immediateKey = !normalized
    ? "empty"
    : isCurrent
      ? "current"
      : isInvalid
        ? "invalid"
        : "check"

  const [remote, setRemote] = useState<RemoteStatus | null>(null)

  useEffect(() => {
    if (immediateKey !== "check") return

    const target = normalizeDomain(value)
    let cancelled = false

    const timer = setTimeout(async () => {
      try {
        const result = await checkDomainAvailability(target)
        if (cancelled) return

        setRemote({
          domain: target,
          status: result.available
            ? { state: "ok", message: "Disponible" }
            : result.reason === "taken"
              ? { state: "taken", message: "Ya está en uso" }
              : { state: "invalid", message: INVALID_MESSAGE },
        })
      } catch {
        if (!cancelled) {
          setRemote({
            domain: target,
            status: { state: "error", message: "No pudimos verificarlo" },
          })
        }
      }
    }, debounceMs)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [value, immediateKey, debounceMs])

  if (immediateKey === "empty") return IDLE
  if (immediateKey === "current") {
    return { state: "ok", message: "Es el dominio actual" }
  }
  if (immediateKey === "invalid") {
    return { state: "invalid", message: INVALID_MESSAGE }
  }

  if (remote?.domain === normalized) return remote.status

  return { state: "checking", message: "Verificando..." }
}
