"use client";

import type { ItemStatus } from "@stickyflow/shared";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { motionTokens } from "@/lib/motion";

const labels: Record<ItemStatus, (days: number | null) => string> = {
  note: () => "Note",
  upcoming: (days) => `${days ?? 0} days`,
  tomorrow: () => "Tomorrow",
  today: () => "Today",
  overdue: (days) => `Overdue · ${Math.abs(days ?? 0)}d`,
  done: () => "Done",
};

const tones: Record<ItemStatus, string> = {
  note: "text-ink-muted bg-sticky-ink",
  upcoming: "text-ink-muted bg-sticky-ink",
  tomorrow: "text-warning bg-sticky-peach",
  today: "text-accent bg-sticky-sage",
  overdue: "text-danger bg-sticky-blush",
  done: "text-success bg-sticky-sage",
};

type DueChipProps = {
  status: ItemStatus;
  remainingDays?: number | null;
  className?: string;
};

export function DueChip({
  status,
  remainingDays = null,
  className,
}: DueChipProps) {
  const reduced = useReducedMotion();
  if (status === "note") return null;

  return (
    <motion.span
      initial={reduced ? false : { opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={
        reduced
          ? { duration: 0 }
          : { duration: motionTokens.fast, ease: motionTokens.ease }
      }
      className={cn(
        "inline-flex items-center px-2.5 py-1 text-[13px] leading-[18px]",
        "rounded-[9px_12px_10px_11px]",
        "border-[1.5px] border-stroke-doodle/25",
        "shadow-[0.5px_1px_0_rgba(42,38,34,0.06)]",
        tones[status],
        className,
      )}
    >
      <span
        aria-hidden
        className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current opacity-70"
      />
      {labels[status](remainingDays)}
    </motion.span>
  );
}
