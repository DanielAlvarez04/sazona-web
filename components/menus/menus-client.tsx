"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  CalendarClockIcon,
  NotebookTextIcon,
  PowerIcon,
  Trash2Icon,
} from "lucide-react"
import { toast } from "sonner"

import {
  activateMenu,
  deactivateMenu,
  deleteMenu,
  duplicateMenu,
} from "@/app/(app)/menus/actions"
import { MenuScheduleBoard } from "@/components/menus/menu-schedule-board"
import { MenuDialog } from "@/components/menus/menu-dialog"
import { MenusSummary } from "@/components/menus/menus-summary"
import { MenusTable } from "@/components/menus/menus-table"
import { UnassignedItemsSheet } from "@/components/menus/unassigned-items-sheet"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useActionForm } from "@/hooks/use-action-form"
import { usePersistentTab } from "@/hooks/use-persistent-tab"
import { usePersistentViewMode } from "@/hooks/use-persistent-view-mode"
import type { ArticleListItem } from "@/lib/catalog"
import type { Menu } from "@/lib/menus"
import type { MenuRowActions } from "@/components/menus/menus-columns"

const MENUS_TABS = ["menus", "programacion"] as const

type ConfirmAction = {
  kind: "deactivate" | "delete"
  menu: Menu
}

export function MenusClient({
  menus,
  items,
  canManage,
}: {
  menus: Menu[]
  items: ArticleListItem[]
  canManage: boolean
}) {
  const router = useRouter()
  const rowForm = useActionForm(() => router.refresh())

  const [tab, setTab] = usePersistentTab(
    "menus-tab",
    MENUS_TABS,
    "menus"
  )
  const [viewMode, setViewMode] = usePersistentViewMode("menus-view-mode")
  const [now, setNow] = useState<Date | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Menu | null>(null)
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null)
  const [unassignedOpen, setUnassignedOpen] = useState(false)
  const [pendingMenuId, setPendingMenuId] = useState<string | null>(null)

  useEffect(() => {
    const tick = () => setNow(new Date())
    tick()

    const interval = window.setInterval(tick, 60_000)
    return () => window.clearInterval(interval)
  }, [])

  const imageById = useMemo(
    () => new Map(items.map((item) => [item.id, item.imageUrl])),
    [items]
  )

  const unassignedItems = useMemo(() => {
    const assigned = new Set(
      menus
        .filter((menu) => menu.isActive)
        .flatMap((menu) => menu.items.map((entry) => entry.itemId))
    )

    return items.filter(
      (item) => item.isActive && !item.isArchived && !assigned.has(item.id)
    )
  }, [menus, items])

  function openNew() {
    if (!canManage) return
    setEditing(null)
    setDialogOpen(true)
  }

  function openEdit(menu: Menu) {
    if (!canManage) return
    setEditing(menu)
    setDialogOpen(true)
  }

  function runFor(
    menu: Menu,
    action: () => Promise<{ ok: boolean; message?: string }>
  ) {
    setPendingMenuId(menu.id)

    return rowForm.run(action).finally(() => {
      setPendingMenuId(null)
    })
  }

  function handleActivate(menu: Menu) {
    void runFor(menu, () =>
      activateMenu(menu.id).then((result) => {
        if (result.ok) toast.success("Menú activado")
        return result
      })
    )
  }

  function handleDuplicate(menu: Menu) {
    void runFor(menu, () =>
      duplicateMenu(menu.id).then((result) => {
        if (result.ok) {
          toast.success("Menú duplicado como borrador inactivo")
          setTab("menus")
        }
        return result
      })
    )
  }

  function handleDeactivate(menu: Menu) {
    setConfirm({ kind: "deactivate", menu })
  }

  function handleDelete(menu: Menu) {
    setConfirm({ kind: "delete", menu })
  }

  function confirmAction() {
    const pending = confirm
    if (!pending) return

    setConfirm(null)

    void runFor(pending.menu, () =>
      (pending.kind === "delete"
        ? deleteMenu(pending.menu.id)
        : deactivateMenu(pending.menu.id)
      ).then((result) => {
        if (result.ok) {
          toast.success(
            pending.kind === "delete"
              ? "Menú eliminado"
              : "Menú desactivado"
          )
        }
        return result
      })
    )
  }

  const actions: MenuRowActions = {
    onEdit: openEdit,
    onDuplicate: handleDuplicate,
    onActivate: handleActivate,
    onDeactivate: handleDeactivate,
    onDelete: handleDelete,
    canManage,
    isPending: (menu) => rowForm.pending && pendingMenuId === menu.id,
  }

  return (
    <div className="@container/main flex flex-1 flex-col gap-4 px-4 py-6 lg:px-6">
      <Tabs value={tab} onValueChange={setTab} className="gap-4">
        <TabsList>
          <TabsTrigger type="button" value="menus">
            <NotebookTextIcon className="size-4" />
            Menús
          </TabsTrigger>
          <TabsTrigger type="button" value="programacion">
            <CalendarClockIcon className="size-4" />
            Programación
          </TabsTrigger>
        </TabsList>

        <TabsContent value="menus" keepMounted>
          <div className="flex flex-col gap-4">
            <MenusSummary
              menus={menus}
              items={items}
              now={now}
              onOpenUnassigned={() => setUnassignedOpen(true)}
            />

            {rowForm.error ? (
              <p role="alert" className="text-sm text-destructive">
                {rowForm.error}
              </p>
            ) : null}

            <MenusTable
              menus={menus}
              imageById={imageById}
              actions={actions}
              canManage={canManage}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              now={now}
              onCreate={openNew}
            />
          </div>
        </TabsContent>

        <TabsContent value="programacion" keepMounted>
          <MenuScheduleBoard
            menus={menus}
            now={now}
            canManage={canManage}
            onEdit={openEdit}
          />
        </TabsContent>
      </Tabs>

      {dialogOpen && canManage ? (
        <MenuDialog
          menu={editing}
          items={items}
          onClose={() => setDialogOpen(false)}
        />
      ) : null}

      <UnassignedItemsSheet
        open={unassignedOpen}
        onOpenChange={setUnassignedOpen}
        items={unassignedItems}
      />

      <AlertDialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) setConfirm(null)
        }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogMedia
              className={
                confirm?.kind === "delete" ? "text-destructive" : undefined
              }
            >
              {confirm?.kind === "delete" ? (
                <Trash2Icon />
              ) : (
                <PowerIcon />
              )}
            </AlertDialogMedia>
            <AlertDialogTitle>
              {confirm?.kind === "delete"
                ? "Eliminar menú"
                : "Desactivar menú"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.kind === "delete" ? (
                <>
                  Se eliminará «{confirm.menu.name}» y sus asignaciones de
                  artículos. Los artículos seguirán disponibles en el catálogo.
                  Esta acción no se puede deshacer.
                </>
              ) : (
                <>
                  El menú «{confirm?.menu.name ?? ""}» dejará de aparecer como
                  filtro en el punto de venta. Los artículos seguirán
                  disponibles en «Todos los menús».
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant={confirm?.kind === "delete" ? "destructive" : "default"}
              onClick={confirmAction}
              disabled={rowForm.pending}
            >
              {confirm?.kind === "delete" ? "Eliminar" : "Desactivar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
