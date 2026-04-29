import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

import { cn } from "@/lib/utils";

type TooltipInternalContextValue = {
  isTouch: boolean
  open: boolean
  setOpen: (v: boolean) => void
  triggerRef: React.MutableRefObject<HTMLElement | null>
}

const TooltipInternalContext = React.createContext<
  TooltipInternalContextValue | null
>(null)

function useTooltipInternal() {
  const ctx = React.useContext(TooltipInternalContext)
  if (!ctx) return null
  return ctx
}

function TooltipProvider({
  delayDuration = 0,
  skipDelayDuration = 0,
  disableHoverableContent = true,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      delayDuration={delayDuration}
      skipDelayDuration={skipDelayDuration}
      disableHoverableContent={disableHoverableContent}
      {...props}
    />
  )
}

function Tooltip({
  open: openProp,
  onOpenChange,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  const [isTouch, setIsTouch] = React.useState(false)
  const [openState, setOpenState] = React.useState(false)
  const triggerRef = React.useRef<HTMLElement | null>(null)
  const open = openProp ?? openState
  const setOpen = React.useCallback(
    (v: boolean) => {
      if (onOpenChange) onOpenChange(v)
      if (openProp === undefined) setOpenState(v)
    },
    [onOpenChange, openProp],
  )

  React.useEffect(() => {
    try {
      const w = window as unknown as {
        ontouchstart?: unknown
        navigator?: { maxTouchPoints?: number }
      }
      const next =
        "ontouchstart" in w ||
        Boolean(w.navigator?.maxTouchPoints && w.navigator.maxTouchPoints > 0)
      setIsTouch(next)
    } catch {
      setIsTouch(false)
    }
  }, [])

  // Auto-dismiss tooltip on outside tap for touch devices
  React.useEffect(() => {
    if (!isTouch || !open) return
    const handler = (e: PointerEvent | MouseEvent) => {
      const trigger = triggerRef.current
      if (trigger && !trigger.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("pointerdown", handler, { passive: true })
    return () => document.removeEventListener("pointerdown", handler)
  }, [isTouch, open, setOpen])

  const ctx = React.useMemo<TooltipInternalContextValue>(
    () => ({ isTouch, open, setOpen, triggerRef }),
    [isTouch, open, setOpen],
  )

  return (
    <TooltipInternalContext.Provider value={ctx}>
      <TooltipPrimitive.Root
        open={isTouch ? open : openProp}
        onOpenChange={isTouch ? setOpen : onOpenChange}
        {...props}
      />
    </TooltipInternalContext.Provider>
  )
}

const TooltipTrigger = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Trigger>
>(({ onClick, ...props }, ref) => {
  const ctx = useTooltipInternal()

  const mergedRef = React.useCallback(
    (node: HTMLButtonElement | null) => {
      if (ctx) ctx.triggerRef.current = node
      if (typeof ref === "function") ref(node)
      else if (ref) (ref as React.MutableRefObject<HTMLButtonElement | null>).current = node
    },
    [ctx, ref],
  )

  return (
    <TooltipPrimitive.Trigger
      ref={mergedRef}
      onClick={(e) => {
        onClick?.(e)
        if (ctx?.isTouch) ctx.setOpen(!ctx.open)
      }}
      {...props}
    />
  )
})
TooltipTrigger.displayName = TooltipPrimitive.Trigger.displayName

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn(
      "z-50 overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
      className,
    )}
    {...props}
  />
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
