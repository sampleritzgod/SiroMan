"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { motionTokens } from "@/lib/motion";

const presets = {
  "sketch-a":
    "M6.2,11.5 C9,3.8 19.5,5.2 28,6.8 C41,9.2 49,3.5 62,6.1 C74,8.5 83,4.2 95,7.4 C106,10.2 114,5.8 119.2,10.5 L118.4,88.2 C112,97.5 98,93.2 86,94.8 C72,96.6 61,90.5 48,93.2 C34,96.1 22,91.4 11.2,94.6 C6.8,95.8 4.5,91.2 5.1,86.5 Z",
  "sketch-b":
    "M5.5,13 C14,2.5 31,7.8 45,5.2 C61,2.2 74,9.5 89,5.8 C101,3.1 114,8.4 119,14.2 L117.2,87.5 C108,98 92,93.5 78,95.8 C62,98.4 49,91.2 34,94.5 C20,97.5 9.5,92.2 5.8,86.8 Z",
  "sketch-c":
    "M7.8,15.2 C18,3.5 37,8.8 52,5.5 C69,1.8 84,9.2 99,5.2 C110,2.5 117,10.8 118.5,16.5 L116.8,85.2 C104,97.8 86,92.5 70,95.2 C52,98.2 38,90.8 23,94.2 C12,96.5 5.5,90.5 6.2,84.8 Z",
} as const;

export type DoodlePreset = keyof typeof presets;

const fills: Record<string, string> = {
  surface: "var(--surface)",
  butter: "var(--sticky-butter)",
  mist: "var(--sticky-mist)",
  sage: "var(--sticky-sage)",
  blush: "var(--sticky-blush)",
  slate: "var(--sticky-slate)",
  lavender: "var(--sticky-lavender)",
  peach: "var(--sticky-peach)",
  ink: "var(--sticky-ink)",
};

type DoodleFrameProps = {
  children: ReactNode;
  preset?: DoodlePreset;
  color?: keyof typeof fills;
  className?: string;
  as?: "div" | "article" | "section";
  interactive?: boolean;
  delay?: number;
};

export function DoodleFrame({
  children,
  preset = "sketch-a",
  color = "surface",
  className,
  as: Comp = "div",
  interactive = true,
  delay = 0,
}: DoodleFrameProps) {
  const reduced = useReducedMotion();
  const path = presets[preset];
  const fill = fills[color] ?? fills.surface;

  return (
    <motion.div
      className={cn("relative", className)}
      initial={reduced ? false : { opacity: 0, y: 10, rotate: -0.55 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={
        reduced
          ? { duration: 0 }
          : { duration: motionTokens.slow, ease: motionTokens.ease, delay }
      }
      whileHover={
        interactive && !reduced
          ? { y: -3, rotate: 0.4, transition: { duration: motionTokens.fast } }
          : undefined
      }
    >
      <Comp className="relative">
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
          viewBox="0 0 124 100"
          preserveAspectRatio="none"
          aria-hidden
        >
          <path
            d={path}
            fill="none"
            stroke="var(--stroke-doodle)"
            strokeWidth="2.5"
            strokeOpacity="0.14"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            transform="translate(1.15 1.05)"
          />
          <path d={path} fill={fill} stroke="none" />
          <path
            d={path}
            fill="none"
            stroke="var(--stroke-doodle)"
            strokeWidth="1.85"
            strokeOpacity="0.88"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        <div
          className="relative m-[4.5%] overflow-hidden rounded-[calc(var(--radius-md)-2px)] p-4"
          style={{
            backgroundColor: fill,
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.55)",
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.15 0 0 0 0 0.12 0 0 0 0 0.1 0 0 0 0.035 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
            backgroundBlendMode: "multiply",
          }}
        >
          <span
            aria-hidden
            className="pointer-events-none absolute -top-1 left-1/2 h-3 w-11 -translate-x-1/2 rotate-[-2deg] rounded-[2px]"
            style={{
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.72), rgba(255,252,247,0.35))",
              boxShadow: "0 0 0 1px rgba(42,38,34,0.08)",
            }}
          />
          {children}
        </div>
      </Comp>
    </motion.div>
  );
}
