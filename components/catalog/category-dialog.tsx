"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useActionForm } from "@/hooks/use-action-form"
import type { Category } from "@/lib/catalog"
import { clearDraft, readDraft, writeDraft } from "@/lib/drafts"

type Kind = "ARTICLE" | "RECIPE"

export function CategoryDialog({
  open,
  onOpenChange,
  articleCategories,
  recipeCategories,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  articleCategories: Category[]
  recipeCategories: Category[]
}) {
  const router = useRouter()
  const createForm = useActionForm(() => router.refresh())
  const rowForm = useActionForm(() => router.refresh())
  const [kind, setKind] = useState<Kind>("ARTICLE")

  // Borrador del nombre: si se cierra el diálogo por accidente, se recupera.
  const draftKey = `category:new:${kind}`
  const [name, setName] = useState(() => readDraft<string>(draftKey) ?? "")

  const categories = kind === "ARTICLE" ? articleCategories : recipeCategories

  function handleOpenChange(next: boolean) {
    if (!next) writeDraft(draftKey, name)

    onOpenChange(next)
  }

  function handleKindChange(next: string) {
    const value: Kind = next === "RECIPE" ? "RECIPE" : "ARTICLE"
    writeDraft(draftKey, name)
    setKind(value)
    setName(readDraft<string>(`category:new:${value}`) ?? "")
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Categorías</DialogTitle>
          <DialogDescription>
            Las categorías core son compartidas y no se pueden editar. Puedes
            añadir categorías propias para artículos o para recetas.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={kind} onValueChange={handleKindChange} className="gap-3">
          <TabsList>
            <TabsTrigger type="button" value="ARTICLE">
              Artículos
            </TabsTrigger>
            <TabsTrigger type="button" value="RECIPE">
              Recetas
            </TabsTrigger>
          </TabsList>

          <TabsContent value={kind}>
            <form
              className="flex flex-col gap-3"
              onSubmit={(event) => {
                event.preventDefault()
                const formData = new FormData(event.currentTarget)
                formData.set("kind", kind)
                createForm.run(async () => {
                  const result = await createCategory(formData)
                  if (result.ok) {
                    setName("")
                    clearDraft(draftKey)
                  }
                  return result
                })
              }}
            >
              <Field>
                <FieldLabel htmlFor={`category-name-${kind}`}>
                  Nueva categoría de {kind === "ARTICLE" ? "artículos" : "recetas"}
                </FieldLabel>
                <div className="flex gap-2">
                  <Input
                    id={`category-name-${kind}`}
                    name="name"
                    required
                    minLength={2}
                    maxLength={80}
                    placeholder={kind === "ARTICLE" ? "Postres" : "Salsas"}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
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

            <div className="no-scrollbar mt-3 flex max-h-64 flex-col gap-2 overflow-y-auto rounded-md border p-3">
              {categories.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin categorías.</p>
              ) : (
                categories.map((category) => {
                  const count =
                    kind === "ARTICLE"
                      ? (category._count.items ?? 0)
                      : (category._count.recipes ?? 0)

                  return (
                    <div
                      key={category.id}
                      className="flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 truncate text-sm font-medium">
                          {category.name}
                          {category.isCore ? (
                            <Badge variant="outline">Core</Badge>
                          ) : null}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {category.code ? `${category.code} · ` : ""}
                          {count} {kind === "ARTICLE" ? "artículo(s)" : "receta(s)"}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        {category.isActive ? (
                          <Badge variant="secondary">Activa</Badge>
                        ) : (
                          <Badge variant="outline">Inactiva</Badge>
                        )}
                        {!category.isCore && category.isActive ? (
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
                  )
                })
              )}
            </div>

            {rowForm.error ? <FieldError>{rowForm.error}</FieldError> : null}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
