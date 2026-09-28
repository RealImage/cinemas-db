import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  // Qube DS Button: hover/pressed are a black-alpha wash over the fill, never a
  // new hue; disabled uses fill-disabled/text-disabled rather than opacity.
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary disabled:cursor-not-allowed disabled:bg-grey-100 disabled:bg-none disabled:text-grey-300 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // DS "primary" — product navy, one per view
        default: "bg-primary text-primary-foreground [--wash:rgba(0,0,0,.2)] hover:[background-image:linear-gradient(0deg,var(--wash),var(--wash))] active:[--wash:rgba(0,0,0,.35)]",
        // DS "negative"
        destructive: "bg-destructive text-destructive-foreground [--wash:rgba(0,0,0,.2)] hover:[background-image:linear-gradient(0deg,var(--wash),var(--wash))]",
        // DS "default" — grey fill, the workhorse
        outline: "bg-secondary text-secondary-foreground [--wash:rgba(0,0,0,.1)] hover:[background-image:linear-gradient(0deg,var(--wash),var(--wash))] active:[--wash:rgba(0,0,0,.2)]",
        secondary: "bg-secondary text-secondary-foreground [--wash:rgba(0,0,0,.1)] hover:[background-image:linear-gradient(0deg,var(--wash),var(--wash))] active:[--wash:rgba(0,0,0,.2)]",
        // DS "secondary" — transparent / ghost
        ghost: "bg-transparent text-muted-foreground hover:bg-black/5 hover:text-foreground active:bg-black/20 disabled:bg-transparent",
        link: "h-auto min-h-0 rounded-none border-b border-transparent bg-transparent px-0.5 py-0 text-blue-700 hover:border-blue-700 disabled:bg-transparent",
      },
      size: {
        // DS medium: 2.125rem (34px) minimum box — do not round
        default: "min-h-[2.125rem] min-w-[2.125rem] rounded-lg px-3 py-1.5 text-xs leading-5",
        sm: "min-h-7 rounded-md px-2 py-1 text-xs leading-5",
        lg: "min-h-10 rounded-lg px-4 py-2 text-sm leading-6",
        icon: "h-[2.125rem] w-[2.125rem] rounded-lg p-1.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

/**
 * Form and dialog action buttons (Save, Cancel, Close, Confirm, Delete…) share
 * one minimum width, so a pair like Save / Cancel is the same size whatever the
 * label length. Dialog footers and FormActions apply it to their buttons.
 */
export const ACTION_BUTTONS = "[&>button]:min-w-20 [&>a]:min-w-20"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  /** Disables the button and shows a spinner beside its label, so its size doesn't change. */
  loading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading && !asChild ? <><Loader2 className="animate-spin" aria-hidden />{children}</> : children}
      </Comp>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
