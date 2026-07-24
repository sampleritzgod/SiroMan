"use client";

import { useReducedMotion } from "framer-motion";

export const motionTokens = {
  fast: 0.12,
  base: 0.18,
  slow: 0.28,
  ease: [0.2, 0.8, 0.2, 1] as const,
};

export const stickyHover = {
  y: -3,
  rotate: 0.4,
  transition: { duration: motionTokens.fast, ease: motionTokens.ease },
};

export function useMotionSafe() {
  const reduced = useReducedMotion();
  return {
    reduced: Boolean(reduced),
    transition: reduced
      ? { duration: 0 }
      : { duration: motionTokens.base, ease: motionTokens.ease },
  };
}
