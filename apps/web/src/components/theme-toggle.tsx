"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ThemeMode } from "@/lib/theme";

const LABELS: Record<ThemeMode, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

const ICONS = {
  light: Sun,
  dark: Moon,
  system: Monitor,
} as const;

type ThemeToggleProps = {
  className?: string;
  /** Compact icon button for the navbar. */
  compact?: boolean;
};

export function ThemeToggle({ className, compact = false }: ThemeToggleProps) {
  const { theme, setTheme, cycleTheme } = useTheme();
  const Icon = ICONS[theme];

  if (compact) {
    return (
      <button
        type="button"
        onClick={cycleTheme}
        aria-label={`Theme: ${LABELS[theme]}. Click to change.`}
        title={`Theme: ${LABELS[theme]}`}
        className={cn(
          "inline-flex h-9 w-9 items-center justify-center rounded-[10px_12px_11px_13px] border-[1.5px] border-stroke-doodle/25 text-ink-muted transition-colors hover:bg-sticky-ink/70 hover:text-ink",
          className,
        )}
      >
        <Icon className="h-4 w-4" strokeWidth={1.75} />
      </button>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-ink-muted">
        Appearance
      </p>
      <div className="grid grid-cols-3 gap-2">
        {(["light", "dark", "system"] as const).map((mode) => {
          const ModeIcon = ICONS[mode];
          const selected = theme === mode;
          return (
            <Button
              key={mode}
              type="button"
              size="sm"
              variant={selected ? "secondary" : "ghost"}
              aria-pressed={selected}
              onClick={() => setTheme(mode)}
              className={cn(
                "flex h-auto flex-col gap-1.5 py-3",
                selected &&
                  "border-stroke-doodle bg-sticky-ink shadow-[1px_1px_0_var(--doodle-shadow-soft)]",
              )}
            >
              <ModeIcon className="h-4 w-4" strokeWidth={1.75} />
              <span className="text-xs">{LABELS[mode]}</span>
            </Button>
          );
        })}
      </div>
      <p className="text-xs text-ink-muted">
        System follows your device setting. Preference is saved on this device.
      </p>
    </div>
  );
}
