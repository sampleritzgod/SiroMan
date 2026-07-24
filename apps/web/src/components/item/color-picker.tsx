"use client";

import type { StickyColor } from "@stickyflow/shared";
import { cn } from "@/lib/utils";
import { STICKY_COLOR_LABELS, STICKY_COLORS, STICKY_CSS } from "@/lib/sticky-utils";

type ColorPickerProps = {
  value: StickyColor;
  onChange: (color: StickyColor) => void;
  className?: string;
};

export function ColorPicker({ value, onChange, className }: ColorPickerProps) {
  return (
    <div
      className={cn("flex flex-wrap gap-2", className)}
      role="radiogroup"
      aria-label="Sticky color"
    >
      {STICKY_COLORS.map((color) => {
        const selected = value === color;
        return (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={STICKY_COLOR_LABELS[color]}
            onClick={() => onChange(color)}
            className={cn(
              "h-8 w-8 rounded-[9px_11px_8px_10px] border-[1.75px] transition-transform",
              selected
                ? "scale-110 border-stroke-doodle shadow-[1px_2px_0_rgba(42,38,34,0.18)]"
                : "border-stroke-doodle/30 hover:scale-105",
            )}
            style={{ backgroundColor: STICKY_CSS[color] }}
          />
        );
      })}
    </div>
  );
}
