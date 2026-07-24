"use client";

import type { Priority } from "@stickyflow/shared";
import { cn } from "@/lib/utils";

const OPTIONS: { value: Priority; label: string; tone: string }[] = [
  { value: "none", label: "None", tone: "bg-sticky-ink" },
  { value: "low", label: "Low", tone: "bg-sticky-mist" },
  { value: "medium", label: "Medium", tone: "bg-sticky-peach" },
  { value: "high", label: "High", tone: "bg-sticky-blush" },
];

type PriorityPickerProps = {
  value: Priority;
  onChange: (priority: Priority) => void;
  className?: string;
};

export function PriorityPicker({
  value,
  onChange,
  className,
}: PriorityPickerProps) {
  return (
    <div
      className={cn("flex flex-wrap gap-2", className)}
      role="radiogroup"
      aria-label="Priority"
    >
      {OPTIONS.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex min-h-9 items-center gap-2 rounded-[10px_12px_11px_13px] border-[1.5px] px-3 text-sm transition-colors",
              option.tone,
              selected
                ? "border-stroke-doodle text-ink shadow-[1px_1px_0_var(--doodle-shadow-soft)]"
                : "border-stroke-doodle/20 text-ink-muted hover:border-stroke-doodle/40",
            )}
          >
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                option.value === "high" && "bg-danger",
                option.value === "medium" && "bg-warning",
                option.value === "low" && "bg-accent",
                option.value === "none" && "bg-ink-faint",
              )}
            />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
