"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { DoodleFrame } from "@/components/md/doodle-frame";
import { motionTokens } from "@/lib/motion";

function SketchScribble() {
  return (
    <svg
      className="mt-3 w-36 text-accent"
      viewBox="0 0 140 12"
      fill="none"
      aria-hidden
    >
      <path
        d="M2 7.5C18 3.5 34 9 52 5.5C70 2 88 9.5 106 5C120 1.8 132 7 138 4.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.55"
      />
    </svg>
  );
}

export function MarketingHero() {
  const reduced = useReducedMotion();

  return (
    <main className="relative mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-10 px-6 py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-16 mx-auto h-48 max-w-lg opacity-40"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(255,241,168,0.55), transparent 70%)",
        }}
      />

      <motion.div
        initial={reduced ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={
          reduced
            ? { duration: 0 }
            : { duration: motionTokens.slow, ease: motionTokens.ease }
        }
      >
        <p className="font-hand text-6xl leading-[0.95] tracking-tight text-ink md:text-7xl">
          SiroMan
        </p>
        <SketchScribble />
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-muted">
          People don&apos;t fail because they lack goals. They fail because they
          forget their commitments.
        </p>
      </motion.div>

      <DoodleFrame preset="sketch-a" color="butter" className="max-w-md" delay={0.12}>
        <p className="text-sm leading-relaxed text-ink">
          Capture once. Stay reminded until done. Never duplicate work.
        </p>
      </DoodleFrame>

      <motion.div
        className="flex flex-wrap gap-3"
        initial={reduced ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={
          reduced
            ? { duration: 0 }
            : {
                duration: motionTokens.base,
                ease: motionTokens.ease,
                delay: 0.18,
              }
        }
      >
        <Button asChild>
          <Link href="/sign-up">Get started</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/sign-in">Sign in</Link>
        </Button>
      </motion.div>
    </main>
  );
}
