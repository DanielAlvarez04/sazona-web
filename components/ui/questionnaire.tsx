"use client"

import * as React from "react"
import { createContext } from "react"
import { cn } from "@/lib/utils"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CheckIcon,
  Loader2Icon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardTitle,
} from "@/components/ui/card"
import {
  FieldError,
} from "@/components/ui/field"
import { Label } from "@/components/ui/label"

interface QuestionnaireContextValue {
  currentItem: string
  totalItems: number
  items: readonly { name: string; required: boolean }[]
  completedItems: Set<string>
  goToItem: (name: string) => void
  nextItem: () => void
  prevItem: () => void
  markComplete: (name: string) => void
  markIncomplete: (name: string) => void
  isItemComplete: (name: string) => boolean
  isItemActive: (name: string) => boolean
  canGoNext: boolean
  canGoPrev: boolean
  isFirstItem: boolean
  isLastItem: boolean
  registerItem: (name: string, required: boolean) => void
}

const QuestionnaireContext = createContext<QuestionnaireContextValue | null>(null)

function useQuestionnaireContext() {
  const context = React.useContext(QuestionnaireContext)
  if (!context) {
    throw new Error("Questionnaire components must be used within a Questionnaire")
  }
  return context
}

interface QuestionnaireProps {
  children: React.ReactNode
  defaultItem?: string
  items: readonly { name: string; required: boolean }[]
  onSubmit?: (event: React.FormEvent<HTMLFormElement>) => void
  className?: string
}

export const Questionnaire = React.forwardRef<HTMLFormElement, QuestionnaireProps>(
  ({ children, defaultItem, items, onSubmit, className, ...props }, ref) => {
    const [currentItem, setCurrentItem] = React.useState(defaultItem ?? items[0]?.name ?? "")
    const [completedItems, setCompletedItems] = React.useState<Set<string>>(new Set())
    const [/* registeredItems */] = React.useState(() => new Map(items.map((item) => [item.name, item.required])))

    // const totalItems = items.length

    const goToItem = React.useCallback(
      (name: string) => {
        // Ignore unknown item names so progress can never render "Paso 0 de N".
        if (items.some((item) => item.name === name)) {
          setCurrentItem(name)
        }
      },
      [items]
    )

    const nextItem = React.useCallback(() => {
      const currentIndex = items.findIndex((item) => item.name === currentItem)
      if (currentIndex < items.length - 1) {
        setCurrentItem(items[currentIndex + 1].name)
      }
    }, [currentItem, items])

    const prevItem = React.useCallback(() => {
      const currentIndex = items.findIndex((item) => item.name === currentItem)
      if (currentIndex > 0) {
        setCurrentItem(items[currentIndex - 1].name)
      }
    }, [currentItem, items])

    const markComplete = React.useCallback((name: string) => {
      setCompletedItems((prev) => new Set([...prev, name]))
    }, [])

    const markIncomplete = React.useCallback((name: string) => {
      setCompletedItems((prev) => {
        const next = new Set(prev)
        next.delete(name)
        return next
      })
    }, [])

    const isItemComplete = React.useCallback(
      (name: string) => completedItems.has(name),
      [completedItems]
    )

    const isItemActive = React.useCallback(
      (name: string) => name === currentItem,
      [currentItem]
    )

    const canGoNext = currentItem !== items[items.length - 1]?.name
    const canGoPrev = currentItem !== items[0]?.name
    const isFirstItem = currentItem === items[0]?.name
    const isLastItem = currentItem === items[items.length - 1]?.name

    const registerItem = React.useCallback(() => {
      // Since registeredItems is initialized once and doesn't change,
      // we don't need to update it. The initial map is built from items.
    }, [])

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      onSubmit?.(event)
    }

    const contextValue = React.useMemo(
      () => ({
        currentItem,
        totalItems: items.length,
        items,
        completedItems,
        goToItem,
        nextItem,
        prevItem,
        markComplete,
        markIncomplete,
        isItemComplete,
        isItemActive,
        canGoNext,
        canGoPrev,
        isFirstItem,
        isLastItem,
        registerItem,
      }),
      [
        currentItem,
        items,
        completedItems,
        goToItem,
        nextItem,
        prevItem,
        markComplete,
        markIncomplete,
        isItemComplete,
        isItemActive,
        canGoNext,
        canGoPrev,
        isFirstItem,
        isLastItem,
        registerItem,
      ]
    )

    return (
      <QuestionnaireContext.Provider value={contextValue}>
        <form ref={ref} onSubmit={handleSubmit} className={cn("space-y-6", className)} {...props}>
          {children}
        </form>
      </QuestionnaireContext.Provider>
    )
  }
)

Questionnaire.displayName = "Questionnaire"

// QuestionnaireProgress
interface QuestionnaireProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  render?: (props: React.HTMLAttributes<HTMLDivElement>, state: { current: number; total: number }) => React.ReactNode
}

export function QuestionnaireProgress({ className, render, ...props }: QuestionnaireProgressProps) {
  const { currentItem, items } = useQuestionnaireContext()
  const totalItems = items.length

  const currentStep = React.useMemo(() => {
    return items.findIndex((item: { name: string; required: boolean }) => item.name === currentItem) + 1
  }, [items, currentItem])

  if (render) {
    return (
      <div {...props} className={cn("mb-8", className)}>
        {render(
          { ...props, role: "progressbar", "aria-valuenow": currentStep, "aria-valuemin": 1, "aria-valuemax": totalItems },
          { current: currentStep, total: totalItems }
        )}
      </div>
    )
  }

  return (
    <div {...props} className={cn("mb-8", className)}>
      <div className="mb-2 flex gap-1.5" aria-hidden="true">
        {Array.from({ length: totalItems }, (_, index) => (
          <span
            key={index}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors",
              index < (currentStep ?? 1) - 1 ? "bg-primary" : "bg-muted"
            )}
          />
        ))}
      </div>
      <span>Paso {currentStep} de {totalItems}</span>
    </div>
  )
}

QuestionnaireProgress.displayName = "QuestionnaireProgress"

// QuestionnaireItem
interface QuestionnaireItemProps {
  children: React.ReactNode
  name: string
  required?: boolean
  className?: string
}

export function QuestionnaireItem({ children, name, required = false, className, ...props }: QuestionnaireItemProps) {
  const { registerItem } = useQuestionnaireContext()
  const active = useQuestionnaireContext().currentItem === name

  React.useEffect(() => {
    registerItem(name, required)
    return () => {}
  }, [name, required, registerItem])

  // Auto-mark complete when item has a value
  // This is a simplified version - in reality you'd track form state

  return (
    <div
      className={cn("animate-in fade-in-200 duration-300", !active && "hidden", className)}
      role="tabpanel"
      aria-labelledby={`item-${name}-title`}
      {...props}
    >
      <Card className="w-full">
        <CardContent className="pt-0">
          {children}
        </CardContent>
      </Card>
    </div>
  )
}

QuestionnaireItem.displayName = "QuestionnaireItem"

// QuestionnaireTitle
type QuestionnaireTitleProps = React.HTMLAttributes<HTMLHeadingElement>

export const QuestionnaireTitle = React.forwardRef<HTMLHeadingElement, QuestionnaireTitleProps>(
  ({ className, children, ...props }, ref) => (
    <CardTitle ref={ref} className={cn("text-2xl font-heading text-center", className)} {...props}>
      {children}
    </CardTitle>
  )
)

QuestionnaireTitle.displayName = "QuestionnaireTitle"

// QuestionnaireChoices
interface QuestionnaireChoicesProps extends React.HTMLAttributes<HTMLDivElement> {
  /** `true` for multiple-choice (checkbox) groups. */
  multiple?: boolean
}

export function QuestionnaireChoices({
  className,
  children,
  multiple = false,
  ...props
}: QuestionnaireChoicesProps) {
  return (
    <div
      className={cn("grid grid-cols-1 gap-2 sm:grid-cols-2", className)}
      {...props}
      role={multiple ? "group" : "radiogroup"}
    >
      {children}
    </div>
  )
}

QuestionnaireChoices.displayName = "QuestionnaireChoices"

// QuestionnaireChoice
interface QuestionnaireChoiceProps {
  value: string
  children: React.ReactNode
  name: string
  type?: "radio" | "checkbox"
  checked?: boolean
  onChange?: (value: string) => void
  className?: string
}

export function QuestionnaireChoice({
  className,
  value,
  children,
  name,
  type = "radio",
  checked = false,
  onChange,
}: QuestionnaireChoiceProps) {
  const active = checked

  return (
    <Label
      className={cn(
        "flex min-h-10 cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors",
        active
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/40 hover:bg-accent",
        className
      )}
    >
      <input
        type={type}
        name={name}
        value={value}
        checked={active}
        onChange={() => onChange?.(value)}
        className="sr-only"
      />
      <span
        className={cn(
          "flex size-4 shrink-0 items-center justify-center border-2 transition-all",
          type === "radio" ? "rounded-full" : "rounded-sm",
          active
            ? "border-primary bg-primary text-primary-foreground"
            : "border-muted-foreground/40 text-transparent"
        )}
      >
        <CheckIcon className="size-3" strokeWidth={3} />
      </span>
      <span className="text-sm font-medium leading-snug capitalize">
        {children}
      </span>
    </Label>
  )
}

QuestionnaireChoice.displayName = "QuestionnaireChoice"

// QuestionnaireError
type QuestionnaireErrorProps = React.HTMLAttributes<HTMLDivElement>

export function QuestionnaireError({
  className,
  children,
  ...props
}: QuestionnaireErrorProps) {
  return (
    <FieldError className={cn("mt-2", className)} {...props}>
      {children}
    </FieldError>
  )
}

QuestionnaireError.displayName = "QuestionnaireError"

// QuestionnaireActions
type QuestionnaireActionsProps = React.HTMLAttributes<HTMLDivElement>

export function QuestionnaireActions({ className, children }: QuestionnaireActionsProps) {
  const items = React.Children.toArray(children)

  return (
    <div className={cn("flex items-center justify-between gap-4 border-t pt-4", className)}>
      <div className="flex items-center gap-2">
        {items.slice(0, -1)}
      </div>
      <div className="ml-auto flex items-center gap-2">
        {items.at(-1)}
      </div>
    </div>
  )
}

QuestionnaireActions.displayName = "QuestionnaireActions"

// QuestionnairePrevious
type QuestionnairePreviousProps = React.ButtonHTMLAttributes<HTMLButtonElement>

export function QuestionnairePrevious({ className, children = "Atrás", ...props }: QuestionnairePreviousProps) {
  const { prevItem, canGoPrev, isFirstItem } = useQuestionnaireContext()

  return (
    <Button
      type="button"
      variant="ghost"
      size="lg"
      onClick={prevItem}
      disabled={!canGoPrev || isFirstItem}
      className={cn("flex items-center gap-2", className)}
      {...props}
    >
      <ChevronLeftIcon className="mr-2 size-5" />
      {children}
    </Button>
  )
}

QuestionnairePrevious.displayName = "QuestionnairePrevious"

// QuestionnaireNext
type QuestionnaireNextProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "onClick"
> & {
  /**
   * Runs before advancing. Return `false` (or a promise resolving to `false`)
   * to block navigation, e.g. when persisting the step failed validation.
   */
  onClick?: (
    event: React.MouseEvent<HTMLButtonElement>
  ) => boolean | void | Promise<boolean | void>
}

export function QuestionnaireNext({
  className,
  children = "Continuar",
  onClick,
  disabled,
  ...props
}: QuestionnaireNextProps) {
  const { nextItem, canGoNext } = useQuestionnaireContext()
  const [pending, setPending] = React.useState(false)

  async function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
    if (pending || !canGoNext) return

    setPending(true)
    try {
      const result = await onClick?.(event)
      if (result !== false) nextItem()
    } finally {
      setPending(false)
    }
  }

  return (
    <Button
      type="button"
      size="lg"
      onClick={handleClick}
      disabled={disabled || !canGoNext || pending}
      className={cn("flex items-center gap-2", className)}
      {...props}
    >
      {pending && <Loader2Icon className="mr-2 size-5 animate-spin" />}
      {children}
      <ChevronRightIcon className="ml-2 size-5" />
    </Button>
  )
}

QuestionnaireNext.displayName = "QuestionnaireNext"

// QuestionnaireSubmit
type QuestionnaireSubmitProps = React.ButtonHTMLAttributes<HTMLButtonElement>

export function QuestionnaireSubmit({ className, children = "Finalizar", ...props }: QuestionnaireSubmitProps) {
  useQuestionnaireContext()

  return (
    <Button
      type="submit"
      size="lg"
      className={cn("flex items-center gap-2", className)}
      {...props}
    >
      {children}
      <CheckIcon className="ml-2 size-5" />
    </Button>
  )
}

QuestionnaireSubmit.displayName = "QuestionnaireSubmit"