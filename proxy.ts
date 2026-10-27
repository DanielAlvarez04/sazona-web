import { NextResponse, type NextRequest } from "next/server"

const ACCESS_TOKEN_COOKIE = "np_at"
const REFRESH_TOKEN_COOKIE = "np_rt"
/** Evita que varias peticiones renueven la sesión a la vez. */
const REFRESH_LOCK_COOKIE = "np_rl"
/** Se renueva el access token cuando le quedan menos de 2 minutos. */
const REFRESH_LEEWAY_MS = 2 * 60 * 1000
const RETRY_PARAM = "_session_retry"

const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
]

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/v1"

const WEB_ORIGIN =
  process.env.WEB_ORIGIN ??
  process.env.NEXT_PUBLIC_WEB_ORIGIN ??
  "http://localhost:3000"

/** `exp` del JWT en milisegundos, o `null` si no se pudo analizar. */
function jwtExpiryMs(token: string): number | null {
  try {
    const parts = token.split(".")
    if (parts.length !== 3) return null
    // Convertir base64url a base64 estándar (compatible Edge + Node)
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/")
    const json =
      typeof atob === "function"
        ? atob(base64)
        : Buffer.from(base64, "base64").toString("utf8")
    const data = JSON.parse(json) as { exp?: number }
    return data.exp ? data.exp * 1000 : null
  } catch {
    return null
  }
}

function isJwtExpired(token: string): boolean {
  const expiry = jwtExpiryMs(token)
  return expiry === null || expiry <= Date.now()
}

/**
 * Cabeceras `Set-Cookie` de una respuesta.
 *
 * `getSetCookie` existe en Node 18+ y en los runtimes modernos; el fallback
 * separa por comas solo cuando empieza un nuevo `nombre=`.
 */
function readSetCookies(headers: Headers): string[] {
  const withGetter = headers as Headers & { getSetCookie?: () => string[] }
  if (typeof withGetter.getSetCookie === "function") {
    return withGetter.getSetCookie()
  }

  const raw = headers.get("set-cookie")
  if (!raw) return []

  return raw
    .split(/,(?=[^;,]+=)/)
    .map((cookie) => cookie.trim())
    .filter(Boolean)
}

function cookiePair(setCookie: string): { name: string; value: string } | null {
  const [pair] = setCookie.split(";")
  const index = pair.indexOf("=")
  if (index <= 0) return null

  return {
    name: pair.slice(0, index).trim(),
    value: pair.slice(index + 1).trim(),
  }
}

/**
 * Copia las cookies renovadas a la petición (para que este mismo render use el
 * token nuevo) y a la respuesta (para que el navegador las guarde).
 *
 * `request.cookies.set()` no reescribe la cabecera `cookie`, así que se
 * reconstruye a mano y se pasa a `NextResponse.next`.
 */
function withSessionCookies(
  request: NextRequest,
  setCookies: string[]
): NextResponse {
  const cookies = request.cookies.getAll()

  for (const raw of setCookies) {
    const cookie = cookiePair(raw)
    if (!cookie) continue

    const index = cookies.findIndex((item) => item.name === cookie.name)
    if (index >= 0) {
      cookies[index] = { name: cookie.name, value: cookie.value }
    } else {
      cookies.push({ name: cookie.name, value: cookie.value })
    }
  }

  const headers = new Headers(request.headers)
  headers.set(
    "cookie",
    cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ")
  )

  const response = NextResponse.next({ request: { headers } })
  for (const raw of setCookies) {
    response.headers.append("set-cookie", raw)
  }

  return response
}

function lockRefresh(response: NextResponse): NextResponse {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : ""
  response.headers.append(
    "set-cookie",
    `${REFRESH_LOCK_COOKIE}=1; Path=/; Max-Age=15; HttpOnly; SameSite=Lax${secure}`
  )

  return response
}

function redirectToLogin(request: NextRequest): NextResponse {
  const response = NextResponse.redirect(new URL("/login", request.url))
  response.cookies.delete(ACCESS_TOKEN_COOKIE)
  response.cookies.delete(REFRESH_TOKEN_COOKIE)
  return response
}

interface RefreshResult {
  ok: boolean
  setCookies: string[]
  rotatedElsewhere: boolean
}

async function refreshSession(refreshToken: string): Promise<RefreshResult> {
  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      // La API exige un origen de confianza en toda mutación autenticada por
      // cookies (CSRF). Sin esta cabecera el refresh devuelve 403.
      origin: WEB_ORIGIN,
      cookie: `${REFRESH_TOKEN_COOKIE}=${refreshToken}`,
    },
    cache: "no-store",
  })

  const body = await response.text().catch(() => "")

  return {
    ok: response.ok,
    setCookies: readSetCookies(response.headers),
    rotatedElsewhere: body.includes("SESSION_ROTATED"),
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Ignorar assets estáticos y rutas internas de Next.js
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".")
  ) {
    return NextResponse.next()
  }

  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value

  // Si estamos en una ruta pública y ya hay sesión válida, ir al dashboard
  if (
    PUBLIC_PATHS.includes(pathname) &&
    accessToken &&
    !isJwtExpired(accessToken)
  ) {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  // Rutas públicas sin sesión: dejar pasar (formulario de login/registro)
  if (PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next()
  }

  if (!accessToken && !refreshToken) {
    return redirectToLogin(request)
  }

  const expiry = accessToken ? jwtExpiryMs(accessToken) : null
  const expiresSoon =
    expiry === null || expiry - Date.now() <= REFRESH_LEEWAY_MS
  const refreshLocked = request.cookies.get(REFRESH_LOCK_COOKIE)?.value === "1"

  // Token todavía válido y fuera de la ventana de renovación: nada que hacer.
  if (accessToken && !expiresSoon) {
    return NextResponse.next()
  }

  // Otra petición está renovando y el token actual aún sirve: se deja pasar
  // para no competir por la rotación del refresh token.
  if (
    refreshToken &&
    refreshLocked &&
    accessToken &&
    !isJwtExpired(accessToken)
  ) {
    return NextResponse.next()
  }

  if (!refreshToken) {
    return redirectToLogin(request)
  }

  try {
    const result = await refreshSession(refreshToken)

    if (result.ok) {
      return lockRefresh(withSessionCookies(request, result.setCookies))
    }

    // Otra pestaña ganó la rotación hace un instante. En una navegación se
    // reintenta con las cookies que el navegador ya recibió; en una mutación se
    // deja pasar para no repetir la acción (el servidor devolverá el error).
    if (
      result.rotatedElsewhere &&
      request.method === "GET" &&
      !request.nextUrl.searchParams.has(RETRY_PARAM)
    ) {
      const retry = request.nextUrl.clone()
      retry.searchParams.set(RETRY_PARAM, "1")
      return NextResponse.redirect(retry)
    }
  } catch {
    // Sin conexión con la API: si el access token aún es válido seguimos; si no,
    // el usuario tendrá que volver a entrar.
    if (accessToken && !isJwtExpired(accessToken)) {
      return NextResponse.next()
    }
  }

  return redirectToLogin(request)
}

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"],
}
