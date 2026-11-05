"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  CalendarClockIcon,
  NotebookTextIcon,
  PencilIcon,
  PlusIcon,
  PowerIcon,
} from "lucide-react"
import { toast } from "sonner"

import {
  activateMenu,
  deactivateMenu,
} from "@/app/(app)/menus/actions"
import { MenuDialog } from "@/components/menus/menu-dialog"
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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useActionForm } from "@/hooks/use-action-form"
import type { ArticleListItem, Category } from "@/lib/catalog"
import { formatMenuSchedule, type Menu } from "@/lib/menus"

export function MenusClient({
  menus,
  items,
  categories,
  canManage,
}: {
  menus: Menu[]
  items: ArticleListItem[]
  categories: Category[]
  canManage: boolean
}) {
  const router = useRouter()
  const rowForm = useActionForm(() => router.refresh())

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Menu | null>(null)
  const [confirmDeactivate, setConfirmDeactivate] = useState<Menu | null>(null)

  const active = menus.filter((menu) => menu.isActive)
  const availableNow = active.filter((menu) => menu.isAvailableNow)
  const assignedItems = new Set(
    active.flatMap((menu) => menu.items.map((item) => item.itemId))
  ).size

  function openNew() {
    setEditing(null)
    setDialogOpen(true)
  }

  function openEdit(menu: Menu) {
    setEditing(menu)
    setDialogOpen(true)
  }

  function handleActivate(menu: Menu) {
    rowForm.run(() =>
      activateMenu(menu.id).then((result) => {
        if (result.ok) toast.success("Menú activado")
        return result
      })
    )
  }

  function confirmDeactivateAction() {
    const menu = confirmDeactivate
    if (!menu) return

    rowForm.run(() =>
      deactivateMenu(menu.id).then((result) => {
        if (result.ok) toast.success("Menú desactivado")
        return result
      })
    )
    setConfirmDeactivate(null)
  }

  return (
    <div className="@container/main flex flex-1 flex-col gap-4 px-4 py-6 lg:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <NotebookTextIcon className="size-5" />
            Menús
          </h2>
          <p className="text-sm text-muted-foreground">
            Colecciones de artículos para filtrar el punto de venta por
            ocasión u horario.
          </p>
        </div>
        {canManage ? (
          <Button type="button" onClick={openNew}>
            <PlusIcon />
            Nuevo menú
          </Button>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Menús" value={menus.length} />
        <SummaryCard label="Activos" value={active.length} />
        <SummaryCard label="En horario ahora" value={availableNow.length} />
        <SummaryCard label="Artículos asignados" value={assignedItems} />
      </div>

      {rowForm.error ? (
        <p role="alert" className="text-sm text-destructive">
          {rowForm.error}
        </p>
      ) : null}

      {menus.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <NotebookTextIcon className="size-8 text-muted-foreground" />
            <div>
              <p className="font-medium">Todavía no hay menús</p>
              <p className="text-sm text-muted-foreground">
                Crea el menú infantil, el nocturno o cualquier colección que
                quieras usar como filtro en el POS.
              </p>
            </div>
            {canManage ? (
              <Button type="button" onClick={openNew}>
                <PlusIcon />
                Crear el primer menú
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {menus.map((menu) => (
            <Card key={menu.id} className="flex flex-col">
              <CardHeader className="gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="truncate">{menu.name}</CardTitle>
                    <CardDescription className="line-clamp-2">
                      {menu.description ?? "Sin descripción"}
                    </CardDescription>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge variant={menu.isActive ? "secondary" : "outline"}>
                      {menu.isActive ? "Activo" : "Inactivo"}
                    </Badge>
                    {menu.isActive ? (
                      <Badge
                        variant={menu.isAvailableNow ? "outline" : "destructive"}
                      >
                        {menu.isAvailableNow
                          ? "En horario"
                          : "Fuera de horario"}
                      </Badge>
                    ) : null}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-3">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarClockIcon className="size-3.5 shrink-0" />
                  {formatMenuSchedule(menu)}
                </p>

                <div className="flex flex-wrap gap-1.5">
                  {menu.items.slice(0, 4).map((row) => (
                    <span
                      key={row.id}
                      className="rounded-md bg-muted px-1.5 py-0.5 text-xs"
                    >
                      {row.item.name}
                    </span>
                  ))}
                  {menu.items.length > 4 ? (
                    <span className="px-1 text-xs text-muted-foreground">
                      +{menu.items.length - 4}
                    </span>
                  ) : null}
                </div>

                <p className="text-xs text-muted-foreground">
                  {menu.items.length} artículo
                  {menu.items.length === 1 ? "" : "s"}
                </p>

                {canManage ? (
                  <div className="mt-auto flex flex-wrap gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openEdit(menu)}
                    >
                      <PencilIcon />
                      Editar
                    </Button>
                    {menu.isActive ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmDeactivate(menu)}
                      >
                        <PowerIcon />
                        Desactivar
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleActivate(menu)}
                      >
                        <PowerIcon />
                        Activar
                      </Button>
                    )}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {dialogOpen && canManage ? (
        <MenuDialog
          menu={editing}
          items={items}
          categories={categories}
          onClose={() => setDialogOpen(false)}
        />
      ) : null}

      <AlertDialog
        open={confirmDeactivate !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDeactivate(null)
        }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogMedia>
              <PowerIcon />
            </AlertDialogMedia>
            <AlertDialogTitle>Desactivar menú</AlertDialogTitle>
            <AlertDialogDescription>
              El menú «{confirmDeactivate?.name ?? ""}» dejará de aparecer como
              filtro en el punto de venta. Los artículos seguirán disponibles
              en «Todos los menús».
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeactivateAction}>
              Desactivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  )
}
