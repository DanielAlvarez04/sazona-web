"use client"

import { Slot as SlotPrimitive } from "@radix-ui/react-slot"
import { cn } from "cn"

function Slot({ className, ...props }: React.ComponentProps<typeof SlotPrimitive>) {
  return <SlotPrimitive data-slot="slot" className={cn("", className)} {...props} />
}

export { Slot }