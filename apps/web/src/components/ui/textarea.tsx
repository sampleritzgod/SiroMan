import * as React from "react";
import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[96px] w-full resize-y bg-transparent px-1 py-2 text-sm leading-relaxed text-ink",
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
Textarea.displayName = "Textarea";
