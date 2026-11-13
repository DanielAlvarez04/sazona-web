"use client"

import { useEffect, type ReactNode } from "react"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { usePersistentTab } from "@/hooks/use-persistent-tab"

const SETTINGS_TABS = [
  "account",
  "business",
  "payments",
  "catalog",
  "kitchen",
  "inventory",
  "personalization",
] as const

/**
 * Pestañas laterales de Configuración.
 *
 * Es un componente de cliente porque las tabs usan Base UI; el contenido se
 * renderiza en el servidor y llega como props.
 */
export function SettingsTabs({
  account,
  business,
  payments,
  catalog,
  kitchen,
  inventory,
  personalization,
  initialTab,
}: {
  account: ReactNode
  business: ReactNode
  payments: ReactNode
  catalog: ReactNode
  kitchen: ReactNode
  inventory: ReactNode
  personalization: ReactNode
  /** Pestaña que debe abrirse al entrar (p. ej. al volver de Mercado Pago). */
  initialTab?: (typeof SETTINGS_TABS)[number]
}) {
  const [tab, setTab] = usePersistentTab(
    "settings-tab",
    SETTINGS_TABS,
    "account"
  )

  useEffect(() => {
    if (initialTab) setTab(initialTab)
  }, [initialTab, setTab])

  return (
    <Tabs
      value={tab}
      onValueChange={setTab}
      orientation="vertical"
      className="gap-6 max-md:flex-col"
    >
      <TabsList
        aria-label="Secciones de configuración"
        className="w-max max-w-full"
      >
        <TabsTrigger value="account">Cuenta</TabsTrigger>
        <TabsTrigger value="business">Negocio</TabsTrigger>
        <TabsTrigger value="payments">Pagos</TabsTrigger>
        <TabsTrigger value="catalog">Catálogo</TabsTrigger>
        <TabsTrigger value="kitchen">Cocina</TabsTrigger>
        <TabsTrigger value="inventory">Inventario</TabsTrigger>
        <TabsTrigger value="personalization">Personalización</TabsTrigger>
      </TabsList>

      <TabsContent value="account" className="flex min-w-0 flex-col gap-6">
        {account}
      </TabsContent>
      <TabsContent value="business" className="flex min-w-0 flex-col gap-6">
        {business}
      </TabsContent>
      <TabsContent value="payments" className="flex min-w-0 flex-col gap-6">
        {payments}
      </TabsContent>
      <TabsContent
        value="catalog"
        keepMounted
        className="flex min-w-0 flex-col gap-6"
      >
        {catalog}
      </TabsContent>
      <TabsContent
        value="kitchen"
        className="flex min-w-0 flex-col gap-6"
      >
        {kitchen}
      </TabsContent>
      <TabsContent
        value="inventory"
        // Mantiene la selección de insumos al cambiar de pestaña.
        keepMounted
        className="flex min-w-0 flex-col gap-6"
      >
        {inventory}
      </TabsContent>
      <TabsContent
        value="personalization"
        className="flex min-w-0 flex-col gap-6"
      >
        {personalization}
      </TabsContent>
    </Tabs>
  )
}
