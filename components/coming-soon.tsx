import type { LucideIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function ComingSoon({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon
  title: string
  description: string
}) {
  return (
    <div className="@container/main flex flex-1 items-center justify-center px-4 py-10 lg:px-6">
      <Card className="w-full max-w-lg text-center">
        <CardHeader className="items-center">
          <div className="mb-2 flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="size-6" />
          </div>
          <CardTitle className="text-xl">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-3">
          <Badge variant="outline">Próximamente</Badge>
          <p className="text-sm text-muted-foreground">
            Esta sección todavía no está implementada.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
