import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "flex h-11 w-full bg-transparent px-1 py-2 text-sm text-ink",
        "rounded-none border-0 border-b-[1.75px] border-stroke-doodle/45",
        "placeholder:text-ink-faint",
        "transition-[border-color,box-shadow] duration-150",
        "focus-visible:border-accent focus-visible:outline-none",
        "focus-visible:shadow-[0_2px_0_0_color-mix(in_srgb,var(--accent)_35%,transparent)]",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = "Input";
