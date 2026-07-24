"use client";

import { useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Plus } from "lucide-react";
import { StickyCard } from "@/components/item/sticky-card";
import { StickyEditor } from "@/components/item/sticky-editor";
import { QuickAddSticky } from "@/components/item/quick-add-sticky";
import {
  StickyToolbar,
  type StickyFilters,
} from "@/components/item/sticky-toolbar";
import { BoardEmptyIllustration } from "@/components/md/board-empty";
import { Button } from "@/components/ui/button";
import type { StickyNoteInput, StickyNoteView, StickyTag } from "@/lib/types";
import { cn } from "@/lib/utils";

type StickyBoardProps = {
  notes: StickyNoteView[];
  tags?: StickyTag[];
  emptyTitle?: string;
  emptyDescription?: string;
  onCreate: (input: StickyNoteInput) => void | Promise<unknown>;
  onUpdate: (id: string, input: StickyNoteInput) => void | Promise<unknown>;
  onDelete: (id: string) => void | Promise<unknown>;
  onTogglePin: (id: string) => void | Promise<unknown>;
  onToggleArchive: (id: string) => void | Promise<unknown>;
  onToggleComplete: (id: string) => void | Promise<unknown>;
  onReorder?: (orderedIds: string[]) => void | Promise<unknown>;
  showQuickAdd?: boolean;
  showToolbar?: boolean;
  filters?: StickyFilters;
  onFiltersChange?: (next: StickyFilters) => void;
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  onRetry?: () => void;
};

export function StickyBoard({
  notes,
  tags = [],
  emptyTitle,
  emptyDescription,
  onCreate,
  onUpdate,
  onDelete,
  onTogglePin,
  onToggleArchive,
  onToggleComplete,
  onReorder,
  showQuickAdd = true,
  showToolbar = false,
  filters,
  onFiltersChange,
  isLoading,
  isError,
  errorMessage,
  onRetry,
}: StickyBoardProps) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<StickyNoteView | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [localOrder, setLocalOrder] = useState<string[] | null>(null);

  const ordered = useMemo(() => {
    const byId = new Map(notes.map((n) => [n.id, n]));
    if (localOrder) {
      const fromLocal = localOrder
        .map((id) => byId.get(id))
        .filter(Boolean) as StickyNoteView[];
      const missing = notes.filter((n) => !localOrder.includes(n.id));
      return [...fromLocal, ...missing];
    }
    return notes;
  }, [notes, localOrder]);

  function openCreate() {
    setEditing(null);
    setEditorOpen(true);
  }

  function openEdit(note: StickyNoteView) {
    setEditing(note);
    setEditorOpen(true);
  }

  async function handleSave(input: StickyNoteInput) {
    if (editing) await onUpdate(editing.id, input);
    else await onCreate(input);
  }

  function handleDragStart(id: string) {
    if (!onReorder) return;
    setDraggingId(id);
  }

  function handleDragOver(event: React.DragEvent, overId: string) {
    event.preventDefault();
    if (!draggingId || draggingId === overId) return;
    const ids = ordered.map((n) => n.id);
    const from = ids.indexOf(draggingId);
    const to = ids.indexOf(overId);
    if (from < 0 || to < 0) return;
    const next = [...ids];
    next.splice(from, 1);
    next.splice(to, 0, draggingId);
    setLocalOrder(next);
  }

  async function handleDragEnd() {
    if (!onReorder || !localOrder) {
      setDraggingId(null);
      return;
    }
    setDraggingId(null);
    try {
      await onReorder(localOrder);
    } finally {
      setLocalOrder(null);
    }
  }

  if (isError) {
    return (
      <div className="space-y-3 rounded-[16px_20px_18px_14px] border-[1.75px] border-stroke-doodle/40 bg-sticky-blush/40 p-5">
        <p className="font-hand text-2xl text-ink">Couldn’t load stickies</p>
        <p className="text-sm text-ink-muted">
          {errorMessage ??
            "Check that the API is running, then try again."}
        </p>
        {onRetry ? (
          <Button type="button" variant="secondary" onClick={onRetry}>
            Retry
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {showQuickAdd ? <QuickAddSticky onCreate={onCreate} /> : null}

      {showToolbar && filters && onFiltersChange ? (
        <StickyToolbar
          value={filters}
          onChange={onFiltersChange}
          tags={tags}
        />
      ) : null}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-44 animate-pulse rounded-[16px_20px_18px_14px] bg-sticky-ink/55"
            />
          ))}
        </div>
      ) : ordered.length === 0 ? (
        <div className="space-y-4 py-4 text-center">
          {emptyTitle ? (
            <div>
              <p className="font-hand text-3xl text-ink">{emptyTitle}</p>
              {emptyDescription ? (
                <p className="mt-2 text-sm text-ink-muted">{emptyDescription}</p>
              ) : null}
            </div>
          ) : (
            <BoardEmptyIllustration />
          )}
          <Button type="button" onClick={openCreate}>
            <Plus className="h-4 w-4" strokeWidth={1.75} />
            Create sticky
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {ordered.map((note, index) => (
              <div
                key={note.id}
                draggable={Boolean(onReorder)}
                onDragStart={() => handleDragStart(note.id)}
                onDragOver={(e) => handleDragOver(e, note.id)}
                onDragEnd={() => void handleDragEnd()}
                className={cn(
                  onReorder && "cursor-grab active:cursor-grabbing",
                  draggingId === note.id && "opacity-60",
                )}
              >
                <StickyCard
                  note={note}
                  delay={Math.min(index * 0.04, 0.24)}
                  onEdit={openEdit}
                  onDelete={(id) => void onDelete(id)}
                  onTogglePin={(id) => void onTogglePin(id)}
                  onToggleArchive={(id) => void onToggleArchive(id)}
                  onToggleComplete={(id) => void onToggleComplete(id)}
                />
              </div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <StickyEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        note={editing}
        onSave={(input) => void handleSave(input)}
        onDelete={
          editing
            ? () => {
                void onDelete(editing.id);
              }
            : undefined
        }
      />
    </div>
  );
}
