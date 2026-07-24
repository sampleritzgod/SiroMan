"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { motionTokens } from "@/lib/motion";
import { Badge } from "@/components/ui/badge";

export type CalendarDayItem = {
  id: string;
  title: string;
  color?: string;
};

type CalendarCardProps = {
  monthLabel: string;
  days: Array<{
    date: number;
    isToday?: boolean;
    isOutside?: boolean;
    items?: CalendarDayItem[];
  }>;
  className?: string;
};

export function CalendarCard({ monthLabel, days, className }: CalendarCardProps) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        reduced
          ? { duration: 0 }
          : { duration: motionTokens.slow, ease: motionTokens.ease }
      }
      className={cn(
        "dot-surface overflow-hidden rounded-[16px_20px_18px_14px]",
        "border-[1.75px] border-stroke-doodle/55",
        "shadow-[1px_2px_0_var(--doodle-shadow-lift),var(--paper-shadow)]",
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-stroke-doodle/10 px-4 py-3">
        <p className="font-hand text-xl text-ink">{monthLabel}</p>
        <Badge variant="outline">Preview</Badge>
      </div>
      <div className="grid grid-cols-7 gap-px p-3 text-center">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span
            key={`${d}-${i}`}
            className="pb-2 text-[11px] font-medium uppercase tracking-wide text-ink-faint"
          >
            {d}
          </span>
        ))}
        {days.map((day, index) => (
          <div
            key={`${day.date}-${index}`}
            className={cn(
              "relative flex min-h-11 flex-col items-center justify-start rounded-[10px_12px_11px_13px] p-1",
              day.isToday && "bg-accent-soft",
              day.isOutside && "opacity-35",
            )}
          >
            <span
              className={cn(
                "text-xs font-medium",
                day.isToday ? "text-accent" : "text-ink",
              )}
            >
              {day.date}
            </span>
            {day.items && day.items.length > 0 ? (
              <span className="mt-1 flex gap-0.5">
                {day.items.slice(0, 3).map((item) => (
                  <span
                    key={item.id}
                    className="h-1.5 w-1.5 rounded-full"
                    style={{
                      backgroundColor: item.color ?? "var(--accent)",
                    }}
                    title={item.title}
                  />
                ))}
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </motion.div>
  );
}
