"use client"

import { useState, useTransition } from "react"

export function useActionForm(onSuccess?: () => void) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function run(
    action: () => Promise<{ ok: boolean; message?: string }>
  ): Promise<boolean> {
    setError(null)

    return new Promise<boolean>((resolve) => {
      startTransition(async () => {
        try {
          const result = await action()
          if (!result.ok) {
            setError(result.message ?? "La operación falló")
            resolve(false)
            return
          }
          onSuccess?.()
          resolve(true)
        } catch (cause) {
          setError(
            cause instanceof Error ? cause.message : "La operación falló"
          )
          resolve(false)
        }
      })
    })
  }

  return { pending, error, run, setError }
}
