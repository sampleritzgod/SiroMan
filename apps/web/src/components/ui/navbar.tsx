"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { motionTokens } from "@/lib/motion";

type NavbarProps = {
  brand?: React.ReactNode;
  title?: string;
  actions?: React.ReactNode;
  className?: string;
};

export function Navbar({ brand, title, actions, className }: NavbarProps) {
  const reduced = useReducedMotion();

  return (
    <motion.header
      initial={reduced ? false : { opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        reduced
          ? { duration: 0 }
          : { duration: motionTokens.base, ease: motionTokens.ease }
      }
      className={cn(
        "relative z-30 border-b border-transparent bg-surface/80 backdrop-blur-md",
        className,
      )}
    >
      <div className="flex h-14 items-center justify-between gap-4 px-4 md:px-6">
        <div className="flex min-w-0 items-center gap-3">
          {brand}
          {title ? (
            <p className="truncate text-sm font-medium text-ink-muted">{title}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      </div>
      <svg
        className="pointer-events-none absolute inset-x-0 -bottom-px h-2 w-full text-stroke-doodle"
        viewBox="0 0 800 8"
        preserveAspectRatio="none"
        aria-hidden
      >
        <path
          d="M0 4.5C80 2 160 6.5 240 3.5C320 0.8 400 7 480 3.2C560 0 640 6.8 720 3.5C760 1.8 790 5 800 4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeOpacity="0.35"
          strokeLinecap="round"
        />
      </svg>
    </motion.header>
  );
}
