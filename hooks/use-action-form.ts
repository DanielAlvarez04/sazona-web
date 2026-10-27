"use client"

import { useState, useTransition } from "react"

export function useActionForm(onSuccess?: () => void) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function run(action: () => Promise<{ ok: boolean; message?: string }>) {
    setError(null)
    startTransition(async () => {
      const result = await action()
      if (!result.ok) {
        setError(result.message ?? "La operación falló")
        return
      }
      onSuccess?.()
    })
  }

  return { pending, error, run, setError }
}
