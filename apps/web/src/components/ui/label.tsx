import * as React from "react";
import { cn } from "@/lib/utils";

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        "mb-1.5 block text-[12px] font-medium uppercase tracking-[0.06em] text-ink-muted",
        className,
      )}
      {...props}
    />
  );
}
