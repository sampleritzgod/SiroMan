import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "relative inline-flex items-center justify-center gap-2 min-h-11 px-4 text-sm font-medium",
    "transition-[transform,background-color,box-shadow,border-color,filter] duration-150 ease-out",
    "disabled:pointer-events-none disabled:opacity-50",
    "rounded-[14px_16px_13px_15px]",
    "active:translate-y-[1px]",
  ].join(" "),
  {
    variants: {
      variant: {
        primary: [
          "bg-accent text-accent-foreground",
          "border-[1.75px] border-stroke-doodle/25",
          "shadow-[1px_2px_0_rgba(42,38,34,0.12)]",
          "hover:brightness-[1.04] hover:-translate-y-0.5 hover:shadow-[2px_4px_0_rgba(42,38,34,0.14)]",
        ].join(" "),
        secondary: [
          "bg-surface text-ink",
          "border-[1.75px] border-stroke-doodle/55",
          "shadow-[1px_1px_0_rgba(42,38,34,0.08)]",
          "hover:bg-sticky-ink hover:-translate-y-0.5",
        ].join(" "),
        ghost:
          "text-ink hover:bg-sticky-ink/80 border border-transparent hover:-translate-y-0.5",
        danger: [
          "bg-danger text-white",
          "border-[1.75px] border-stroke-doodle/20",
          "shadow-[1px_2px_0_rgba(42,38,34,0.12)]",
          "hover:brightness-105 hover:-translate-y-0.5",
        ].join(" "),
      },
      size: {
        default: "h-11 px-4",
        sm: "h-9 px-3 text-sm min-h-9",
        lg: "h-12 px-5",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
