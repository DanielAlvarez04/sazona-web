import { redirect } from "next/navigation"

import { AppSidebar } from "@/components/app-sidebar"
import { OfflineProvider } from "@/components/offline/offline-provider"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { displayName, isAdmin, requireUser } from "@/lib/session"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireUser()

  // Las altas nuevas (registro público o Google) configuran su negocio y
  // usuario antes de entrar. Las cuentas internas de empleados no pasan por el
  // onboarding: las crea un ADMIN y el paso del negocio requiere ADMIN.
  if (!user.onboarded && isAdmin(user)) {
    redirect("/onboarding")
  }

  return (
    <OfflineProvider userId={user.id}>
      <SidebarProvider
        style={
          {
            "--sidebar-width": "calc(var(--spacing) * 72)",
            "--header-height": "calc(var(--spacing) * 12)",
          } as React.CSSProperties
        }
      >
        <AppSidebar
          variant="inset"
          organizationName={user.organizationName}
          isAdmin={isAdmin(user)}
          user={{
            name: displayName(user),
            email: user.email,
            username: user.username,
            role: user.roles[0],
          }}
        />
        <SidebarInset>
          <SiteHeader />
          <div className="flex flex-1 flex-col">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </OfflineProvider>
  )
}
