import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  [
    "inline-flex items-center gap-1.5 px-2.5 py-1 text-[12px] font-medium leading-none",
    "rounded-[8px_11px_9px_10px]",
    "border border-stroke-doodle/20",
  ].join(" "),
  {
    variants: {
      variant: {
        default: "bg-sticky-ink text-ink-muted",
        accent: "bg-accent-soft text-accent",
        success: "bg-sticky-sage/80 text-success",
        warning: "bg-sticky-peach/80 text-warning",
        danger: "bg-sticky-blush/80 text-danger",
        outline: "bg-transparent text-ink-muted border-stroke-doodle/30",
        /** Neutral metadata — tags, soft labels */
        muted: "bg-sticky-ink/70 text-ink-faint border-stroke-doodle/15",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
