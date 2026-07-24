"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Plus } from "lucide-react";
import type { StickyColor } from "@stickyflow/shared";
import { ColorPicker } from "@/components/item/color-picker";
import { StickyEditor } from "@/components/item/sticky-editor";
import { SectionHeader } from "@/components/md/section-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { StickyNoteInput } from "@/lib/types";
import { motionTokens } from "@/lib/motion";
import { cn } from "@/lib/utils";

const DEFAULT_COLOR: StickyColor = "butter";

type QuickAddStickyProps = {
  onCreate: (input: StickyNoteInput) => void | Promise<unknown>;
  title?: string;
  description?: string;
};

export function QuickAddSticky({
  onCreate,
  title = "Quick add",
  description = "Park a thought in one line — refine later.",
}: QuickAddStickyProps) {
  const reduced = useReducedMotion();
  const inputRef = useRef<HTMLInputElement>(null);
  const submittingRef = useRef(false);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [quickTitle, setQuickTitle] = useState("");
  const [quickColor, setQuickColor] = useState<StickyColor>(DEFAULT_COLOR);
  const [editorOpen, setEditorOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [justAdded, setJustAdded] = useState(false);

  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  function resetQuickAdd() {
    setQuickTitle("");
    setQuickColor(DEFAULT_COLOR);
  }

  function flashSuccess() {
    if (reduced) return;
    setJustAdded(true);
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
    successTimerRef.current = setTimeout(() => setJustAdded(false), 420);
  }

  async function handleQuickAdd(event: React.FormEvent) {
    event.preventDefault();
    const value = quickTitle.trim();
    if (!value || submittingRef.current) return;

    submittingRef.current = true;
    setSubmitting(true);

    try {
      await Promise.resolve(
        onCreate({
          title: value,
          color: quickColor,
          description: value,
          pinned: false,
        }),
      );
      resetQuickAdd();
      flashSuccess();
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    } catch {
      // Keep title, color, and focus so the user can retry.
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <>
      <motion.form
        onSubmit={handleQuickAdd}
        initial={reduced ? false : { opacity: 0, y: 8 }}
        animate={
          justAdded && !reduced
            ? { opacity: 1, y: 0, scale: [1, 1.012, 1] }
            : { opacity: 1, y: 0, scale: 1 }
        }
        transition={
          reduced
            ? { duration: 0 }
            : { duration: motionTokens.base, ease: motionTokens.ease }
        }
        className={cn(
          "dot-surface rounded-[16px_20px_18px_14px] border-[1.75px] border-stroke-doodle/50 p-4 shadow-[var(--paper-shadow)]",
          "transition-[border-color,box-shadow] duration-300",
          justAdded &&
            "border-success/35 shadow-[0_0_0_3px_color-mix(in_srgb,var(--success)_12%,transparent)]",
        )}
      >
        <SectionHeader
          title={title}
          description={description}
          action={
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setEditorOpen(true)}
              disabled={submitting}
            >
              <Plus className="h-4 w-4" strokeWidth={1.75} />
              Full editor
            </Button>
          }
        />
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <Input
              ref={inputRef}
              value={quickTitle}
              onChange={(e) => setQuickTitle(e.target.value)}
              placeholder="Write a sticky…"
              aria-label="Quick sticky title"
              disabled={submitting}
            />
          </div>
          <Button type="submit" disabled={!quickTitle.trim() || submitting}>
            {submitting ? "Adding…" : "Add note"}
          </Button>
        </div>
        <div
          className={cn("mt-3", submitting && "pointer-events-none opacity-60")}
          aria-disabled={submitting}
        >
          <ColorPicker
            value={quickColor}
            onChange={(color) => {
              if (submitting) return;
              setQuickColor(color);
            }}
          />
        </div>
      </motion.form>

      <StickyEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        onSave={(input) => onCreate(input)}
      />
    </>
  );
}
