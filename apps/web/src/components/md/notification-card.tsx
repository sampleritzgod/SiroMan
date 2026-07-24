"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { motionTokens } from "@/lib/motion";

type NotificationCardProps = {
  title: string;
  body?: string;
  timeLabel: string;
  unread?: boolean;
  accentColor?: string;
  className?: string;
  actions?: ReactNode;
};

export function NotificationCard({
  title,
  body,
  timeLabel,
  unread = false,
  accentColor = "var(--sticky-butter)",
  className,
  actions,
}: NotificationCardProps) {
  const reduced = useReducedMotion();

  return (
    <motion.article
      initial={reduced ? false : { opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={
        reduced
          ? { duration: 0 }
          : { duration: motionTokens.base, ease: motionTokens.ease }
      }
      className={cn(
        "group relative flex gap-3 rounded-[14px_16px_13px_15px] border-[1.5px] border-stroke-doodle/30 bg-surface/90 p-3.5",
        "shadow-[0.5px_1px_0_var(--doodle-shadow-lift)]",
        "transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5",
        className,
      )}
    >
      <span
        aria-hidden
        className="mt-0.5 h-9 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: accentColor }}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-ink">
            {unread ? (
              <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-accent align-middle" />
            ) : null}
            {title}
          </p>
          <time className="shrink-0 text-[11px] text-ink-faint">{timeLabel}</time>
        </div>
        {body ? (
          <p className="mt-1 text-sm leading-relaxed text-ink-muted">{body}</p>
        ) : null}
        {actions ? <div className="mt-2.5 flex gap-2">{actions}</div> : null}
      </div>
    </motion.article>
  );
}
