import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

/**
 * Agrupa varios `Badge` en una sola píldora continua.
 *
 * Mismo patrón que `ButtonGroup`: los hijos con `data-slot` se pegan entre sí
 * quitando el borde izquierdo y los radios intermedios, y sólo el primero y el
 * último conservan su radio exterior.
 */
const badgeGroupVariants = cva("flex w-fit items-stretch", {
  variants: {
    orientation: {
      horizontal:
        "*:data-slot:rounded-r-none [&>[data-slot]:not(:has(~[data-slot]))]:rounded-r-4xl! [&>[data-slot]~[data-slot]]:rounded-l-none [&>[data-slot]~[data-slot]]:border-l-0",
      vertical:
        "flex-col *:data-slot:rounded-b-none [&>[data-slot]:not(:has(~[data-slot]))]:rounded-b-4xl! [&>[data-slot]~[data-slot]]:rounded-t-none [&>[data-slot]~[data-slot]]:border-t-0",
    },
  },
  defaultVariants: {
    orientation: "horizontal",
  },
})

function BadgeGroup({
  className,
  orientation,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof badgeGroupVariants>) {
  return (
    <div
      role="group"
      data-slot="badge-group"
      data-orientation={orientation}
      className={cn(badgeGroupVariants({ orientation }), className)}
      {...props}
    />
  )
}

export { BadgeGroup, badgeGroupVariants }
