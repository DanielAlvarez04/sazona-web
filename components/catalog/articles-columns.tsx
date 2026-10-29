"use client"

import Link from "next/link"
import { createColumnHelper } from "@tanstack/react-table"
import {
  ChevronDownIcon,
  ChevronsUpDownIcon,
  ChevronUpIcon,
  EllipsisVerticalIcon,
  EyeIcon,
  PencilIcon,
  PowerIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  formatMoney,
  formatPercent,
  type ArticleListItem,
} from "@/lib/catalog"

import type { DataTableFeatures } from "@/components/data-table/data-table-features"

const columnHelper = createColumnHelper<DataTableFeatures, ArticleListItem>()

interface SortableColumn {
  getCanSort: () => boolean
  getIsSorted: () => false | "asc" | "desc"
  getToggleSortingHandler: () => ((event: unknown) => void) | undefined
}

function ArticleColumnHeader({
  title,
  column,
  align = "left",
}: {
  title: string
  column: SortableColumn
  align?: "left" | "right"
}) {
  const sorted = column.getIsSorted()

  if (!column.getCanSort()) {
    return (
      <span className={`font-medium ${align === "right" ? "block text-right" : ""}`}>
        {title}
      </span>
    )
  }

  return (
    <div className={align === "right" ? "flex justify-end" : undefined}>
      <Button
        variant="ghost"
        size="sm"
        className={`h-8 data-[sorted=true]:bg-accent ${align === "right" ? "ml-0" : "-ml-2"}`}
        data-sorted={sorted !== false}
        onClick={column.getToggleSortingHandler()}
      >
        {title}
        {sorted === "asc" ? (
          <ChevronUpIcon data-icon="inline-end" />
        ) : sorted === "desc" ? (
          <ChevronDownIcon data-icon="inline-end" />
        ) : (
          <ChevronsUpDownIcon
            data-icon="inline-end"
            className="text-muted-foreground"
          />
        )}
      </Button>
    </div>
  )
}

export interface ArticleRowActions {
  onEdit: (article: ArticleListItem) => void
  onDeactivate: (article: ArticleListItem) => void
  canManage: boolean
  isPending: (article: ArticleListItem) => boolean
}

function ArticleActionsMenu({
  article,
  actions,
}: {
  article: ArticleListItem
  actions: ArticleRowActions
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon-sm" />}
        disabled={actions.isPending(article)}
      >
        <EllipsisVerticalIcon />
        <span className="sr-only">Acciones</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => actions.onEdit(article)}>
            <PencilIcon />
            Editar artículo
          </DropdownMenuItem>
          <DropdownMenuItem
            render={<Link href={`/catalog/${article.id}`} />}
          >
            <EyeIcon />
            Ver detalle
          </DropdownMenuItem>
        </DropdownMenuGroup>
        {actions.canManage && article.isActive ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => actions.onDeactivate(article)}
            >
              <PowerIcon />
              Desactivar
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function createArticleColumns(
  actions: ArticleRowActions,
  options: { selectable: boolean }
) {
  return columnHelper.columns([
    ...(options.selectable
      ? [
          columnHelper.display({
            id: "select",
            header: ({ table }) => (
              <Checkbox
                aria-label="Seleccionar todos los artículos"
                checked={table.getIsAllPageRowsSelected()}
                indeterminate={table.getIsSomePageRowsSelected()}
                onCheckedChange={(checked) =>
                  table.toggleAllPageRowsSelected(checked === true)
                }
              />
            ),
            cell: ({ row }) => (
              <Checkbox
                aria-label={`Seleccionar ${row.original.name}`}
                checked={row.getIsSelected()}
                onCheckedChange={(checked) =>
                  row.toggleSelected(checked === true)
                }
              />
            ),
            enableSorting: false,
          }),
        ]
      : []),

    columnHelper.accessor("name", {
      id: "name",
      header: ({ column }) => (
        <ArticleColumnHeader title="Artículo" column={column} />
      ),
      cell: ({ row }) => (
        <div className="flex flex-col gap-1">
          <Link
            href={`/catalog/${row.original.id}`}
            className="font-medium hover:underline"
          >
            {row.original.name}
          </Link>
          <span className="text-xs text-muted-foreground">
            {row.original.sku ?? "Sin SKU"}
          </span>
          <div className="flex flex-wrap gap-1">
            {row.original.isCombo ? <Badge>Combo</Badge> : null}
            {(row.original.recipes?.length ?? row.original._count.recipes) > 0 ? (
              <Badge variant="secondary">Con receta</Badge>
            ) : (
              <Badge variant="outline">Sin receta</Badge>
            )}
          </div>
        </div>
      ),
    }),

    columnHelper.accessor(
      (article) => article.category?.name ?? "Sin categoría",
      {
        id: "category",
        header: ({ column }) => (
          <ArticleColumnHeader title="Categoría" column={column} />
        ),
        cell: ({ getValue }) => (
          <span className="text-muted-foreground">{getValue()}</span>
        ),
      }
    ),

    columnHelper.accessor((article) => Number(article.price), {
      id: "price",
      header: ({ column }) => (
        <ArticleColumnHeader title="Precio" column={column} align="right" />
      ),
      cell: ({ getValue }) => (
        <span className="block text-right tabular-nums">
          {formatMoney(getValue())}
        </span>
      ),
    }),

    columnHelper.accessor(
      (article) => (article.taxRate === null ? null : Number(article.taxRate)),
      {
        id: "taxRate",
        header: ({ column }) => (
          <ArticleColumnHeader title="IVA" column={column} align="right" />
        ),
        cell: ({ getValue }) => {
          const value = getValue()
          return (
            <span className="block text-right text-muted-foreground">
              {value === null ? "Sin IVA" : formatPercent(String(value))}
            </span>
          )
        },
      }
    ),

    columnHelper.accessor((article) => article.variants.length, {
      id: "variants",
      header: ({ column }) => (
        <ArticleColumnHeader
          title="Presentaciones"
          column={column}
          align="right"
        />
      ),
      cell: ({ getValue }) => (
        <span className="block text-right tabular-nums">{getValue()}</span>
      ),
    }),

    columnHelper.accessor((article) => article.isActive, {
      id: "status",
      header: ({ column }) => (
        <ArticleColumnHeader title="Estado" column={column} />
      ),
      cell: ({ getValue }) =>
        getValue() ? (
          <Badge variant="secondary">Activo</Badge>
        ) : (
          <Badge variant="outline">Inactivo</Badge>
        ),
    }),

    columnHelper.display({
      id: "actions",
      header: () => <span className="sr-only">Acciones</span>,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <ArticleActionsMenu article={row.original} actions={actions} />
        </div>
      ),
      enableSorting: false,
    }),
  ])
}

export const ARTICLE_COLUMN_LABELS: Record<string, string> = {
  name: "Artículo",
  category: "Categoría",
  price: "Precio",
  taxRate: "IVA",
  variants: "Presentaciones",
  status: "Estado",
}
