"use client"

import * as React from "react"
import Link from "next/link"

import { BranchSelect } from "@/components/branch-select"
import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser, type NavUserData } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import type { Branch } from "@/lib/branches"
import {
  ChartBarIcon,
  ChefHatIcon,
  CoffeeIcon,
  GalleryVerticalEndIcon,
  LayoutDashboardIcon,
  PackageIcon,
  Settings2Icon,
  ShoppingCartIcon,
  UsersIcon,
} from "lucide-react"

const data = {
  navMain: [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: <LayoutDashboardIcon />,
    },
    {
      title: "Punto de venta",
      url: "/pos",
      icon: <ShoppingCartIcon />,
    },
    {
      title: "Cocina",
      url: "/kitchen",
      icon: <ChefHatIcon />,
    },
    {
      title: "Catálogo",
      url: "/catalog",
      icon: <CoffeeIcon />,
    },
    {
      title: "Inventario",
      url: "/inventory",
      icon: <PackageIcon />,
    },
    {
      title: "Reportes",
      url: "/reports",
      icon: <ChartBarIcon />,
    },
  ],
  navSecondary: [
    {
      title: "Configuración",
      url: "/settings",
      icon: <Settings2Icon />,
    },
  ],
}

export function AppSidebar({
  user,
  organizationName,
  isAdmin = false,
  branches = [],
  activeBranchId = null,
  lockedBranch = false,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user: NavUserData
  organizationName?: string | null
  isAdmin?: boolean
  branches?: Branch[]
  activeBranchId?: string | null
  lockedBranch?: boolean
}) {
  const navSecondary = React.useMemo(
    () => [
      ...(isAdmin
        ? [
            {
              title: "Usuarios",
              url: "/users",
              icon: <UsersIcon />,
            },
          ]
        : []),
      ...data.navSecondary,
    ],
    [isAdmin]
  )

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="data-[slot=sidebar-menu-button]:p-1.5!"
              render={<Link href="/dashboard" />}
            >
              <GalleryVerticalEndIcon className="size-5!" />
              <span className="truncate text-base font-semibold">
                {organizationName ?? "Naranja Pimienta"}
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Sucursales</SidebarGroupLabel>
          <SidebarGroupContent>
            <BranchSelect
              branches={branches}
              activeBranchId={activeBranchId}
              locked={lockedBranch}
            />
          </SidebarGroupContent>
        </SidebarGroup>
        <NavMain items={data.navMain} label="Aplicación" />
        <NavSecondary items={navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}
