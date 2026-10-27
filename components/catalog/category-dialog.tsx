"use client"

import { useRouter } from "next/navigation"
import { Loader2Icon, Trash2Icon } from "lucide-react"

import {
  createCategory,
  deactivateCategory,
} from "@/app/(app)/catalog/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useActionForm } from "@/hooks/use-action-form"
import type { Category } from "@/lib/catalog"

export function CategoryDialog({
  open,
  onOpenChange,
  categories,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: Category[]
}) {
  const router = useRouter()
  const createForm = useActionForm(() => router.refresh())
  const rowForm = useActionForm(() => router.refresh())

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Categorías</DialogTitle>
          <DialogDescription>
            Agrupa el menú (bebidas calientes, panadería, combos…).
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            const form = event.currentTarget
            const formData = new FormData(form)
            createForm.run(async () => {
              const result = await createCategory(formData)
              if (result.ok) form.reset()
              return result
            })
          }}
        >
          <Field>
            <FieldLabel htmlFor="category-name">Nueva categoría</FieldLabel>
            <div className="flex gap-2">
              <Input
                id="category-name"
                name="name"
                required
                minLength={2}
                maxLength={80}
                placeholder="Postres"
              />
              <Button type="submit" disabled={createForm.pending}>
                {createForm.pending ? (
                  <Loader2Icon className="animate-spin" />
                ) : null}
                Añadir
              </Button>
            </div>
          </Field>
          {createForm.error ? (
            <FieldError>{createForm.error}</FieldError>
          ) : null}
        </form>

        <div className="flex max-h-64 flex-col gap-2 overflow-y-auto rounded-md border p-3">
          {categories.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin categorías.</p>
          ) : (
            categories.map((category) => (
              <div
                key={category.id}
                className="flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{category.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {category._count.products} producto(s)
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {category.isActive ? (
                    <Badge variant="secondary">Activa</Badge>
                  ) : (
                    <Badge variant="outline">Inactiva</Badge>
                  )}
                  {category.isActive ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Desactivar ${category.name}`}
                      disabled={rowForm.pending}
                      onClick={() =>
                        rowForm.run(() => deactivateCategory(category.id))
                      }
                    >
                      <Trash2Icon />
                    </Button>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>

        {rowForm.error ? <FieldError>{rowForm.error}</FieldError> : null}
      </DialogContent>
    </Dialog>
  )
}
