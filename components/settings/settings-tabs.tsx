"use client"

import type { ReactNode } from "react"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

/**
 * Pestañas laterales de Configuración.
 *
 * Es un componente de cliente porque las tabs usan Base UI; el contenido se
 * renderiza en el servidor y llega como props.
 */
export function SettingsTabs({
  account,
  business,
  inventory,
  personalization,
}: {
  account: ReactNode
  business: ReactNode
  inventory: ReactNode
  personalization: ReactNode
}) {
  return (
    <Tabs
      defaultValue="account"
      orientation="vertical"
      className="gap-6 max-md:flex-col"
    >
      <TabsList
        aria-label="Secciones de configuración"
        className="w-max max-w-full"
      >
        <TabsTrigger value="account">Cuenta</TabsTrigger>
        <TabsTrigger value="business">Negocio</TabsTrigger>
        <TabsTrigger value="inventory">Inventario</TabsTrigger>
        <TabsTrigger value="personalization">Personalización</TabsTrigger>
      </TabsList>

      <TabsContent value="account" className="flex min-w-0 flex-col gap-6">
        {account}
      </TabsContent>
      <TabsContent value="business" className="flex min-w-0 flex-col gap-6">
        {business}
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
