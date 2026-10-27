const OAUTH_ERRORS: Record<string, string> = {
  google_cancelled: "Cancelaste el inicio de sesión con Google.",
  google_state:
    "La sesión de Google caducó o no es válida. Intenta iniciar sesión de nuevo.",
  google_failed: "No pudimos validar tu cuenta de Google. Intenta de nuevo.",
  google_inactive: "Tu cuenta está desactivada. Habla con un administrador.",
  google_no_membership:
    "Tu cuenta no tiene acceso a ninguna organización activa.",
  google_mismatch:
    "Esa cuenta de Google no coincide con la cuenta vinculada. Usa la cuenta correcta.",
  google_unverified_email:
    "Google no ha verificado ese correo, así que no podemos iniciar sesión.",
}

/** Mensaje legible para los códigos que devuelve el callback de Google. */
export function oauthErrorMessage(code: string | undefined): string | null {
  if (!code) return null
  return OAUTH_ERRORS[code] ?? "No pudimos iniciar sesión con Google."
}

const GOOGLE_LINK_MESSAGES: Record<
  string,
  { tone: "success" | "error"; message: string }
> = {
  linked: {
    tone: "success",
    message:
      "Tu cuenta de Google quedó vinculada. Desde ahora puedes iniciar sesión con Google.",
  },
  google_cancelled: {
    tone: "error",
    message: "Cancelaste la vinculación con Google.",
  },
  google_state: {
    tone: "error",
    message:
      "La sesión de Google caducó o no es válida. Inténtalo de nuevo.",
  },
  google_failed: {
    tone: "error",
    message: "No pudimos validar tu cuenta de Google. Inténtalo de nuevo.",
  },
  google_link_session: {
    tone: "error",
    message:
      "Tu sesión caducó antes de terminar la vinculación. Inicia sesión de nuevo e inténtalo otra vez.",
  },
  error_already_linked: {
    tone: "error",
    message:
      "Esta cuenta ya tiene otra identidad de Google vinculada. Contacta a un administrador si necesitas cambiarla.",
  },
  error_mismatch: {
    tone: "error",
    message: "Esa cuenta de Google ya está vinculada a otro usuario.",
  },
  error_inactive: {
    tone: "error",
    message: "Tu cuenta está desactivada. Habla con un administrador.",
  },
  error_unverified_email: {
    tone: "error",
    message:
      "Google no ha verificado ese correo, así que no podemos vincularlo.",
  },
}

/** Resultado de volver de Google al flujo de vinculación (Ajustes). */
export function googleLinkNotice(
  code: string | undefined
): { tone: "success" | "error"; message: string } | null {
  if (!code) return null

  return (
    GOOGLE_LINK_MESSAGES[code] ?? {
      tone: "error",
      message: "No pudimos vincular tu cuenta de Google. Inténtalo de nuevo.",
    }
  )
}
