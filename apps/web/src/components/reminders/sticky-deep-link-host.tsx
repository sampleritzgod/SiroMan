"use client";

import { useEffect, useRef, useState } from "react";
import { useAppShell } from "@/components/app-shell-context";
import { StickyEditor } from "@/components/item/sticky-editor";
import { useStickyMutations } from "@/hooks/use-items";
import { useReminderMutations } from "@/hooks/use-reminders";
import { useApiClient } from "@/lib/api-client";
import type { StickyNote, StickyNoteInput, StickyNoteView } from "@/lib/types";

/**
 * Opens a sticky from notification click (or any requestOpenSticky call)
 * regardless of which app view is active.
 */
export function StickyDeepLinkHost() {
  const { pendingStickyId, clearPendingSticky } = useAppShell();
  const { api } = useApiClient();
  const apiRef = useRef(api);
  apiRef.current = api;
  const stickyMutations = useStickyMutations();
  const reminderMutations = useReminderMutations();
  const markReadRef = useRef(reminderMutations.markRead);
  markReadRef.current = reminderMutations.markRead;
  const [note, setNote] = useState<StickyNoteView | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!pendingStickyId) return;

    let cancelled = false;
    const stickyId = pendingStickyId;

    void (async () => {
      try {
        const fetched = await apiRef.current<StickyNote>(`/v1/items/${stickyId}`);
        if (cancelled) return;
        setNote(fetched);
        setOpen(true);

        // Best-effort: mark related unread inbox entries as read.
        try {
          const inbox = await apiRef.current<{
            data: { id: string; itemId: string; readAt: string | null }[];
          }>("/v1/inbox?unreadOnly=true&limit=50");
          const related = inbox.data.find(
            (entry) => entry.itemId === stickyId && !entry.readAt,
          );
          if (related) {
            void markReadRef.current.mutateAsync(related.id);
          }
        } catch {
          // ignore inbox mark-read failures
        }
      } catch {
        // Sticky may have been deleted — fail quietly.
      } finally {
        if (!cancelled) clearPendingSticky();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pendingStickyId, clearPendingSticky]);

  async function handleSave(input: StickyNoteInput) {
    if (!note) return;
    const updated = await stickyMutations.update.mutateAsync({
      id: note.id,
      patch: input,
    });
    setNote(updated);
  }

  return (
    <StickyEditor
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setNote(null);
      }}
      note={note}
      onSave={(input) => void handleSave(input)}
      onDelete={
        note
          ? () => {
              void stickyMutations.remove.mutateAsync(note.id);
              setOpen(false);
              setNote(null);
            }
          : undefined
      }
    />
  );
}
