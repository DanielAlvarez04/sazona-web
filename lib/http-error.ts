/** Extrae el mensaje de error de una respuesta de NestJS. */
export function apiErrorMessage(data: unknown, fallback: string): string {
  if (data && typeof data === "object" && "message" in data) {
    const message = (data as { message?: unknown }).message

    if (Array.isArray(message)) {
      return message.join(". ")
    }

    if (typeof message === "string" && message.trim()) {
      return message
    }
  }

  return fallback
}
