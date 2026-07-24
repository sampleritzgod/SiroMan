"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { motionTokens } from "@/lib/motion";

type PencilDividerProps = {
  className?: string;
  label?: string;
};

export function PencilDivider({ className, label }: PencilDividerProps) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={
        reduced
          ? { duration: 0 }
          : { duration: motionTokens.base, ease: motionTokens.ease }
      }
      className={cn("flex items-center gap-3 py-1", className)}
      role="separator"
    >
      <svg
        className="h-3 flex-1 text-stroke-doodle"
        viewBox="0 0 200 8"
        preserveAspectRatio="none"
        aria-hidden
      >
        <path
          d="M1 4.2C24 1.5 48 6.5 72 3.8C96 1.2 120 6.8 144 3.5C168 0.5 188 5.5 199 3.2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeOpacity="0.35"
          strokeLinecap="round"
        />
      </svg>
      {label ? (
        <span className="font-hand text-lg text-ink-faint">{label}</span>
      ) : null}
      <svg
        className="h-3 flex-1 text-stroke-doodle"
        viewBox="0 0 200 8"
        preserveAspectRatio="none"
        aria-hidden
      >
        <path
          d="M1 3.8C22 6 46 1.2 70 4.2C94 7 118 1.5 142 4.5C166 7.2 186 2 199 4.8"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeOpacity="0.35"
          strokeLinecap="round"
        />
      </svg>
    </motion.div>
  );
}
