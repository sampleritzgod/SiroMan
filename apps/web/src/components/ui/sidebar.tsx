"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { motionTokens } from "@/lib/motion";

export type SidebarItem = {
  id: string;
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  badge?: number;
  onClick?: () => void;
};

type SidebarProps = {
  items: SidebarItem[];
  footer?: React.ReactNode;
  className?: string;
};

export function Sidebar({ items, footer, className }: SidebarProps) {
  const reduced = useReducedMotion();

  return (
    <motion.aside
      initial={reduced ? false : { opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={
        reduced
          ? { duration: 0 }
          : { duration: motionTokens.slow, ease: motionTokens.ease }
      }
      className={cn(
        "flex h-full w-[var(--sidebar-width)] shrink-0 flex-col",
        "border-r border-stroke-doodle/15 bg-surface/55 backdrop-blur-sm",
        className,
      )}
    >
      <nav className="flex flex-1 flex-col gap-1 p-3" aria-label="Main">
        {items.map((item) => {
          const content = (
            <>
              <span className="text-ink-muted [&_svg]:h-[18px] [&_svg]:w-[18px]">
                {item.icon}
              </span>
              <span className="flex-1 text-left">{item.label}</span>
              {typeof item.badge === "number" && item.badge > 0 ? (
                <span className="rounded-[7px_9px_8px_10px] bg-accent px-1.5 py-0.5 text-[11px] font-medium text-accent-foreground">
                  {item.badge > 99 ? "99+" : item.badge}
                </span>
              ) : null}
            </>
          );

          const classNameItem = cn(
            "flex min-h-10 items-center gap-2.5 rounded-[12px_14px_11px_13px] px-3 text-sm font-medium transition-colors",
            item.active
              ? "bg-sticky-ink text-ink shadow-[inset_0_0_0_1.5px_var(--doodle-shadow)]"
              : "text-ink-muted hover:bg-sticky-ink/70 hover:text-ink",
            item.disabled && "pointer-events-none opacity-40",
          );

          if (item.disabled) {
            return (
              <span key={item.id} className={classNameItem} aria-disabled>
                {content}
              </span>
            );
          }

          return (
            <button
              key={item.id}
              type="button"
              onClick={item.onClick}
              className={classNameItem}
              aria-current={item.active ? "page" : undefined}
            >
              {content}
            </button>
          );
        })}
      </nav>
      {footer ? (
        <div className="border-t border-stroke-doodle/15 p-3">{footer}</div>
      ) : null}
    </motion.aside>
  );
}
