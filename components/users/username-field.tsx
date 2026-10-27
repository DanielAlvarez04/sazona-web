"use client"

import { useEffect, useRef, useState } from "react"

import {
  checkUsernameAvailability,
  suggestUsername,
} from "@/app/(app)/users/actions"
import type { AvailabilityStatus } from "@/components/availability-field"
import { isValidUsername, normalizeUsername } from "@/lib/username"

const IDLE: AvailabilityStatus = { state: "idle", message: null }

const INVALID_MESSAGE = "Formato no válido"

interface RemoteStatus {
  username: string
  status: AvailabilityStatus
}

/**
 * Comprueba en la API si el usuario está libre mientras se escribe.
 *
 * Los estados que no dependen de la red (vacío, inválido, usuario actual) se
 * derivan del valor; solo el resultado de la API vive en estado. Así el
 * formulario no lanza una petición por pulsación (retardo `debounceMs`) ni
 * provoca renders en cascada.
 *
 * `currentUsername` permite tratar el usuario que ya tiene la cuenta como
 * disponible sin preguntar a la API.
 */
export function useUsernameStatus(
  value: string,
  {
    currentUsername,
    debounceMs = 400,
  }: { currentUsername?: string | null; debounceMs?: number } = {}
): AvailabilityStatus {
  const normalized = normalizeUsername(value)
  const isCurrent =
    Boolean(currentUsername) &&
    normalized === normalizeUsername(currentUsername ?? "")
  const isInvalid = !isCurrent && !isValidUsername(normalized)

  // Clave primitiva: mantiene estable la dependencia del efecto.
  const immediateKey = !normalized
    ? "empty"
    : isCurrent
      ? "current"
      : isInvalid
        ? "invalid"
        : "check"

  const [remote, setRemote] = useState<RemoteStatus | null>(null)
  const firstCheck = useRef(true)

  useEffect(() => {
    // La primera comprobación es inmediata; las siguientes esperan el debounce.
    const delay = firstCheck.current ? 0 : debounceMs
    firstCheck.current = false

    const timer = setTimeout(async () => {
      if (immediateKey !== "check") return

      const target = normalizeUsername(value)

      try {
        const result = await checkUsernameAvailability(target)

        setRemote({
          username: target,
          status: result.available
            ? { state: "ok", message: "Disponible" }
            : result.reason === "taken"
              ? { state: "taken", message: "Ya está en uso" }
              : { state: "invalid", message: INVALID_MESSAGE },
        })
      } catch {
        setRemote({
          username: target,
          status: { state: "error", message: "No pudimos verificarlo" },
        })
      }
    }, delay)

    return () => {
      clearTimeout(timer)
    }
  }, [value, immediateKey, debounceMs])

  if (immediateKey === "empty") return IDLE
  if (immediateKey === "current") {
    return { state: "ok", message: "Es el usuario actual" }
  }
  if (immediateKey === "invalid") {
    return { state: "invalid", message: INVALID_MESSAGE }
  }

  if (remote?.username === normalized) return remote.status

  return { state: "checking", message: "Verificando..." }
}

/** Separa un nombre en nombre de pila y primer apellido (sin acentos). */
export function splitName(name: string): { first: string; surname: string } {
  const words = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  return { first: words[0] ?? "", surname: words[1] ?? "" }
}

/**
 * Genera candidatos de usuario localmente (sin llamar a la API).
 *
 * Patrones (en orden de preferencia):
 *   1. Sólo el nombre:                      chiqui@dominio
 *   2. Inicial del nombre + último apellido: cflores@dominio o cfrosas@dominio
 *   3. Números consecutivos para ambos patrones
 *
 * Los apellidos se separan por espacios; para la variante de inicial
 * sólo se usa el **último** apellido (en caso de varios).
 */
export function generateUsernameCandidates(
  name: string,
  domain: string | null
): string[] {
  const words = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  const first = words[0]
  if (!first) {
    return []
  }

  const surnames = words.slice(1)
  const lastSurname = surnames.length ? surnames[surnames.length - 1] : ""

  const suffix = domain ? `@${domain}` : ""

  const candidates: string[] = []

  // 1. Sólo el nombre
  candidates.push(`${first}${suffix}`)

  // 2. Inicial del nombre + último apellido (si existe)
  if (lastSurname) {
    candidates.push(`${first[0]}${lastSurname}${suffix}`)
  }

  // 3. Números consecutivos para ambos patrones
  for (let n = 2; n <= 9; n++) {
    candidates.push(`${first}${n}${suffix}`)
    if (lastSurname) {
      candidates.push(`${first[0]}${lastSurname}${n}${suffix}`)
    }
  }

  return candidates
}

/**
 * Usuario propuesto por la API para un nombre: `ana@dominio` y, si ya existe,
 * `a.perez@dominio`. Solo consulta mientras el campo no se edite a mano.
 *
 * `resetKey` (por ejemplo el dominio del negocio) descarta la propuesta cuando
 * cambia algo de lo que depende en el servidor. La clave incluye el nombre y
 * `resetKey`, así que una propuesta vieja nunca se muestra para un negocio
 * distinto.
 */
export function useSuggestedUsername(
  name: string,
  {
    enabled = true,
    debounceMs = 350,
    resetKey = "",
  }: { enabled?: boolean; debounceMs?: number; resetKey?: string } = {}
): string | null {
  const trimmed = name.trim()
  const key = `${trimmed}|${resetKey}`
  const [remote, setRemote] = useState<{ key: string; username: string } | null>(
    null
  )

  useEffect(() => {
    if (!enabled || !trimmed) return

    let cancelled = false

    const timer = setTimeout(async () => {
      try {
        const result = await suggestUsername(trimmed)
        if (!cancelled && result.username) {
          setRemote({ key, username: result.username })
        }
      } catch {
        // Sin sugerencia: el administrador puede escribir el usuario.
      }
    }, debounceMs)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [trimmed, key, enabled, debounceMs])

  if (!trimmed || remote?.key !== key) return null

  return remote.username
}