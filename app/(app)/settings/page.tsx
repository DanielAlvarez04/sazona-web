import Link from "next/link"
import {
  CheckCircle2Icon,
  CircleAlertIcon,
  KeyRoundIcon,
  LinkIcon,
  ShieldCheckIcon,
  UsersIcon,
} from "lucide-react"

import { OrganizationCard } from "@/components/settings/organization-card"
import { BranchesCard } from "@/components/settings/branches-card"
import { PosDevicesCard } from "@/components/settings/pos-devices-card"
import { PosDisplaysCard } from "@/components/settings/pos-displays-card"
import { PosPinCard } from "@/components/settings/pos-pin-card"
import { MercadoPagoCard } from "@/components/settings/mercadopago-card"
import { CatalogCategoriesCard } from "@/components/settings/catalog-categories-card"
import { CoreOptionGroupsCard } from "@/components/settings/core-option-groups-card"
import { CoreProductsCard } from "@/components/settings/core-products-card"
import { InventoryPreferencesCard } from "@/components/settings/inventory-preferences-card"
import { SettingsTabs } from "@/components/settings/settings-tabs"
import { TaxSettingsCard } from "@/components/settings/tax-settings-card"
import { UnitsCard } from "@/components/settings/units-card"
import { InstallApp } from "@/components/offline/install-app"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { API_BASE_URL } from "@/lib/api-base"
import { apiFetch } from "@/lib/api"
import { googleLinkNotice } from "@/lib/auth-errors"
import { getActiveBranch } from "@/lib/branch-server"
import type { Branch } from "@/lib/branches"
import {
  canManageCatalog,
  canManageInventory,
  type Category,
  type Ingredient,
  type IngredientCategory,
  type IngredientLocation,
  type OptionGroupPreset,
} from "@/lib/catalog"
import { roleLabel } from "@/lib/roles"
import { isAdmin, requireUser } from "@/lib/session"
import type { MercadoPagoStatus } from "@/lib/mercadopago"
import type { PosPairedDevice } from "@/lib/pos-device"
import type { PosDisplayInfo } from "@/lib/pos-display"
import { cn } from "cn"

type SearchParams = Promise<Record<string, string | string[] | undefined>>

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

function DefinitionRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1 border-b border-border/60 pb-3 last:border-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium sm:text-right">{children}</dd>
    </div>
  )
}

function Notice({
  tone,
  message,
}: {
  tone: "success" | "error"
  message: string
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-3 rounded-xl border px-4 py-3 text-sm",
        tone === "success"
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : "border-destructive/40 bg-destructive/10 text-destructive"
      )}
    >
      {tone === "success" ? (
        <CheckCircle2Icon className="mt-0.5 size-4 shrink-0" />
      ) : (
        <CircleAlertIcon className="mt-0.5 size-4 shrink-0" />
      )}
      <p>{message}</p>
    </div>
  )
}

/** Mensajes del callback OAuth de Mercado Pago (`/settings?mp=...`). */
function mercadoPagoNotice(
  code: string | undefined
): { tone: "success" | "error"; message: string } | null {
  if (!code) return null

  switch (code) {
    case "connected":
      return {
        tone: "success",
        message:
          "Mercado Pago conectado. Sincronizamos las terminales de la cuenta.",
      }
    case "cancelled":
      return {
        tone: "error",
        message: "Cancelaste la conexión con Mercado Pago.",
      }
    case "state":
      return {
        tone: "error",
        message:
          "La solicitud de conexión expiró o no es válida. Inténtalo de nuevo.",
      }
    case "error_session":
      return {
        tone: "error",
        message:
          "Tu sesión cambió durante la conexión. Vuelve a intentarlo desde Configuración.",
      }
    case "error_exchange":
      return {
        tone: "error",
        message:
          "Mercado Pago rechazó la autorización. Revisa las credenciales de la aplicación.",
      }
    case "error_account":
      return {
        tone: "error",
        message:
          "No se pudo leer la cuenta de Mercado Pago. Inténtalo de nuevo.",
      }
    case "error_unexpected":
      return {
        tone: "error",
        message: "No se pudo completar la conexión con Mercado Pago.",
      }
    default:
      return {
        tone: "error",
        message: "No se pudo conectar Mercado Pago. Inténtalo de nuevo.",
      }
  }
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const user = await requireUser()
  const params = await searchParams
  const notice = googleLinkNotice(first(params.google))
  const mp = first(params.mp)
  const mpNotice = mercadoPagoNotice(mp)
  const admin = isAdmin(user)

  const branchesResponse = admin ? await apiFetch("/branches") : null
  const branches: Branch[] = branchesResponse?.ok
    ? ((await branchesResponse.json()) as Branch[])
    : []

  const posDevicesResponse = admin ? await apiFetch("/pos/devices") : null
  const posDevices: PosPairedDevice[] = posDevicesResponse?.ok
    ? ((await posDevicesResponse.json()) as PosPairedDevice[])
    : []

  const posDisplaysResponse = admin ? await apiFetch("/pos/displays") : null
  const posDisplays: PosDisplayInfo[] = posDisplaysResponse?.ok
    ? ((await posDisplaysResponse.json()) as PosDisplayInfo[])
    : []

  const mpStatusResponse = admin
    ? await apiFetch("/mercadopago/status")
    : null
  const mpStatus: MercadoPagoStatus | null = mpStatusResponse?.ok
    ? ((await mpStatusResponse.json()) as MercadoPagoStatus)
    : null

  // Inventario actual: sirve para marcar los insumos core que ya existen y
  // bloquear los que están en recetas.
  const [
    ingredientsResponse,
    categoriesResponse,
    locationsResponse,
    activeBranch,
    articleCategoriesResponse,
    recipeCategoriesResponse,
    optionPresetsResponse,
  ] = await Promise.all([
    apiFetch("/inventory/ingredients?includeInactive=true"),
    apiFetch("/inventory/ingredient-categories?includeInactive=true"),
    apiFetch("/inventory/ingredient-locations"),
    getActiveBranch(),
    apiFetch("/catalog/categories?includeInactive=true&kind=article"),
    apiFetch("/catalog/categories?includeInactive=true&kind=recipe"),
    apiFetch("/catalog/option-groups/presets"),
  ])
  const ingredients: Ingredient[] = ingredientsResponse.ok
    ? ((await ingredientsResponse.json()) as Ingredient[])
    : []
  const categories: IngredientCategory[] = categoriesResponse.ok
    ? ((await categoriesResponse.json()) as IngredientCategory[])
    : []
  const locations: IngredientLocation[] = locationsResponse.ok
    ? ((await locationsResponse.json()) as IngredientLocation[])
    : []
  const articleCategories: Category[] = articleCategoriesResponse.ok
    ? ((await articleCategoriesResponse.json()) as Category[])
    : []
  const recipeCategories: Category[] = recipeCategoriesResponse.ok
    ? ((await recipeCategoriesResponse.json()) as Category[])
    : []
  const optionPresets: OptionGroupPreset[] = optionPresetsResponse.ok
    ? ((await optionPresetsResponse.json()) as OptionGroupPreset[])
    : []
  const inventoryLoaded = ingredientsResponse.ok
  const catalogLoaded =
    inventoryLoaded && categoriesResponse.ok && locationsResponse.ok
  const catalogCategoriesLoaded =
    articleCategoriesResponse.ok && recipeCategoriesResponse.ok

  return (
    <div className="@container/main flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Configuración
        </h1>
        <p className="text-sm text-muted-foreground">
          Tu cuenta, seguridad y preferencias del negocio.
        </p>
      </div>

      {notice ? <Notice {...notice} /> : null}
      {mpNotice ? <Notice {...mpNotice} /> : null}

      <SettingsTabs
        initialTab={mp ? "payments" : undefined}
        account={
          <>
            <Card>
              <CardHeader>
                <CardTitle>Cuenta</CardTitle>
                <CardDescription>
                  Datos de tu acceso a{" "}
                  {user.organizationName ?? "Naranja Pimienta"}.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <dl className="flex flex-col gap-3 text-sm">
                  <DefinitionRow label="Nombre">
                    {user.name ?? "Sin nombre"}
                  </DefinitionRow>
                  {user.username ? (
                    <DefinitionRow label="Usuario">
                      <span className="font-mono">{user.username}</span>
                    </DefinitionRow>
                  ) : null}
                  <DefinitionRow label="Correo">
                    {user.email ? (
                      <span className="inline-flex flex-wrap items-center justify-end gap-2">
                        <span className="break-all">{user.email}</span>
                        {user.emailVerified ? (
                          <Badge variant="secondary">
                            <ShieldCheckIcon data-icon="inline-start" />
                            Verificado
                          </Badge>
                        ) : (
                          <Badge variant="outline">Sin verificar</Badge>
                        )}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        Sin correo (cuenta interna)
                      </span>
                    )}
                  </DefinitionRow>
                  <DefinitionRow label="Roles">
                    <span className="inline-flex flex-wrap justify-end gap-1">
                      {user.roles.length > 0 ? (
                        user.roles.map((role) => (
                          <Badge key={role} variant="outline">
                            {roleLabel(role) ?? role}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-muted-foreground">Sin roles</span>
                      )}
                    </span>
                  </DefinitionRow>
                  <DefinitionRow label="Organización">
                    {user.organizationName ?? "Sin organización activa"}
                  </DefinitionRow>
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Acceso con Google</CardTitle>
                <CardDescription>
                  Inicia sesión con Google aunque su correo sea distinto al de tu
                  cuenta.
                </CardDescription>
                <CardAction>
                  {user.googleLinked ? (
                    <Badge variant="secondary">
                      <CheckCircle2Icon data-icon="inline-start" />
                      Vinculado
                    </Badge>
                  ) : (
                    <Badge variant="outline">Sin vincular</Badge>
                  )}
                </CardAction>
              </CardHeader>
              <CardContent className="gap-4">
                {user.googleLinked ? (
                  <p className="text-sm text-muted-foreground">
                    Ya puedes entrar con el botón de Google. Si quieres usar otra
                    identidad de Google, pide a un administrador que restablezca
                    el vínculo.
                  </p>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Vincula la cuenta de Google que prefieras. Se guardará su
                      identificador, no su contraseña, y podrás seguir entrando
                      con tu correo y contraseña.
                    </p>
                    <a
                      href={`${API_BASE_URL}/auth/google/link`}
                      className={cn(
                        buttonVariants({ variant: "outline" }),
                        "w-fit"
                      )}
                    >
                      <LinkIcon data-icon="inline-start" />
                      Vincular Google
                    </a>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Seguridad</CardTitle>
                <CardDescription>
                  Cómo proteges el acceso a tu cuenta.
                </CardDescription>
                <CardAction>
                  {user.twoFactorEnabled ? (
                    <Badge variant="secondary">
                      <ShieldCheckIcon data-icon="inline-start" />
                      Activa
                    </Badge>
                  ) : (
                    <Badge variant="outline">Inactiva</Badge>
                  )}
                </CardAction>
              </CardHeader>
              <CardContent className="gap-3">
                <div className="flex items-start gap-3 rounded-lg border border-border/60 p-3">
                  <KeyRoundIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div className="flex flex-col gap-1 text-sm">
                    <span className="font-medium">
                      Verificación en dos pasos
                      {user.twoFactorEnabled ? " activa" : " desactivada"}
                    </span>
                    <span className="text-muted-foreground">
                      {user.twoFactorEnabled
                        ? "Cada inicio de sesión pide un código enviado a tu correo."
                        : "Cuando la actives, cada inicio de sesión pedirá un código enviado a tu correo."}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {user.email
                    ? "La gestión de la verificación en dos pasos estará disponible en esta sección próximamente."
                    : "Tu cuenta no tiene correo, así que no puede usar la verificación en dos pasos. Pide a un administrador que añada uno."}
                </p>
              </CardContent>
            </Card>

            <PosPinCard />

            <Card>
              <CardHeader>
                <CardTitle>Aplicación instalable</CardTitle>
                <CardDescription>
                  Instala la PWA en el móvil o la tablet del local.
                </CardDescription>
              </CardHeader>
              <CardContent className="gap-3">
                <InstallApp />
                <p className="text-xs text-muted-foreground">
                  Sin conexión solo se guardan comandas en el dispositivo.
                  Registrar pagos y cerrar cuentas siempre requiere conexión.
                </p>
              </CardContent>
            </Card>
          </>
        }
        business={
          <>
            <Card>
              <CardHeader>
                <CardTitle>Negocio</CardTitle>
                <CardDescription>
                  Nombre de la organización y cuentas del equipo.
                </CardDescription>
                {admin ? (
                  <CardAction>
                    <Link
                      href="/users"
                      className={cn(
                        buttonVariants({ variant: "outline", size: "sm" }),
                        "w-fit"
                      )}
                    >
                      <UsersIcon data-icon="inline-start" />
                      Usuarios
                    </Link>
                  </CardAction>
                ) : null}
              </CardHeader>
              <CardContent className="gap-4">
                <OrganizationCard
                  name={user.organizationName ?? "Sin organización activa"}
                  domain={user.organizationDomain ?? null}
                  canManage={admin}
                />
                <div className="flex flex-col gap-1 text-sm">
                  <span className="font-medium">Equipo</span>
                  <span className="text-muted-foreground">
                    {admin
                      ? "Crea cuentas internas con usuario y contraseña, sin que cada empleado registre su correo."
                      : "Un administrador gestiona las cuentas y roles del equipo."}
                  </span>
                </div>
              </CardContent>
            </Card>

            <BranchesCard branches={branches} canManage={admin} />
            <PosDevicesCard
              devices={posDevices}
              branches={branches}
              canManage={admin}
            />
            <PosDisplaysCard
              displays={posDisplays}
              branches={branches}
              canManage={admin}
            />
          </>
        }
        payments={
          <>
            {admin && !mpStatus ? (
              <Card>
                <CardHeader>
                  <CardTitle>Mercado Pago Point</CardTitle>
                  <CardDescription>
                    Cobros en terminal desde el punto de venta.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    No se pudo leer el estado de la integración. Recarga la
                    página o revisa que la API esté disponible.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <MercadoPagoCard
                status={
                  mpStatus ?? {
                    configured: true,
                    connected: false,
                    connection: null,
                    terminals: [],
                  }
                }
                branches={branches}
                connectUrl={`${API_BASE_URL}/mercadopago/connect`}
                canManage={admin}
              />
            )}

            <Card>
              <CardHeader>
                <CardTitle>Cómo funciona</CardTitle>
                <CardDescription>
                  Lo que debes saber antes de cobrar en terminal.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                  <li>
                    El dinero y la comisión de Mercado Pago van directo a la
                    cuenta del negocio; la app solo registra el cobro.
                  </li>
                  <li>
                    La terminal debe estar en modo punto de venta (PDV). La
                    Point Air 2 solo funciona en modo autoservicio.
                  </li>
                  <li>
                    El cobro se envía desde el POS y, cuando el cliente paga,
                    el pago se confirma solo y el saldo de la cuenta baja.
                  </li>
                  <li>
                    Si la terminal queda en “revisar terminal”, confirma el
                    cobro en el dispositivo y vuelve a sincronizar.
                  </li>
                </ul>
              </CardContent>
            </Card>
          </>
        }
        catalog={
          <>
            <CatalogCategoriesCard
              articleCategories={articleCategories}
              recipeCategories={recipeCategories}
              canManage={
                catalogCategoriesLoaded && canManageCatalog(user.roles)
              }
            />
            <CoreOptionGroupsCard
              presets={optionPresets}
              active={user.organizationUseCoreOptionGroups}
              canManage={canManageCatalog(user.roles)}
            />
          </>
        }
        inventory={
          <>
            <InventoryPreferencesCard
              categories={categories}
              useCoreSuggestions={user.organizationUseCoreSuggestions}
              canManage={catalogLoaded && canManageInventory(user.roles)}
              canManageSuggestions={admin}
            />

            {user.organizationUseCoreSuggestions ? (
              <CoreProductsCard
                ingredients={ingredients}
                categories={categories.filter((category) => category.isActive)}
                locations={locations}
                branchName={activeBranch?.name ?? null}
                storageKey={`np-core-presets:${user.organizationId ?? "default"}`}
                canManage={catalogLoaded && canManageInventory(user.roles)}
              />
            ) : null}
          </>
        }
        personalization={
          <>
            <TaxSettingsCard
              taxRate={user.organizationTaxRate}
              canManage={admin}
            />

            <UnitsCard />
          </>
        }
      />
    </div>
  )
}
