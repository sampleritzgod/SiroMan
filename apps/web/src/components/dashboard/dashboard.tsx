"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { CalendarPage } from "@/components/calendar/calendar-page";
import { ExecutionDashboard } from "@/components/dashboard/execution-dashboard";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { ReminderCenter } from "@/components/reminders/reminder-center";
import { StickyBoard } from "@/components/item/sticky-board";
import { StickyEditor } from "@/components/item/sticky-editor";
import { useStickyFilters } from "@/components/item/sticky-toolbar";
import { DoodleFrame } from "@/components/md/doodle-frame";
import { SectionHeader } from "@/components/md/section-header";
import { Button } from "@/components/ui/button";
import { useAppShell } from "@/components/app-shell-context";
import { useStickiesWorkspace } from "@/hooks/use-items";
import { formatApiError } from "@/lib/api-client";
import type { Me, StickyNoteInput, StickyNoteView } from "@/lib/types";

type DashboardProps = {
  me: Me;
};

export function Dashboard({ me }: DashboardProps) {
  const { view } = useAppShell();
  const [filters, setFilters] = useStickyFilters({ sort: "pinned" });
  const stickies = useStickiesWorkspace({
    view: view === "archive" ? "archive" : "board",
    q: view === "stickies" ? filters.q : undefined,
    tag: view === "stickies" ? filters.tag : undefined,
    priority: view === "stickies" ? filters.priority : undefined,
    sort: view === "stickies" ? filters.sort : "pinned",
  });
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<StickyNoteView | null>(null);

  function openCreate() {
    setEditing(null);
    setEditorOpen(true);
  }

  async function handleSave(input: StickyNoteInput) {
    if (editing) await stickies.update(editing.id, input);
    else await stickies.create(input);
  }

  if (view === "calendar") {
    return <CalendarPage me={me} />;
  }

  if (view === "reminders") {
    return <ReminderCenter me={me} />;
  }

  if (view === "home") {
    return <ExecutionDashboard me={me} stickies={stickies} />;
  }

  if (stickies.isLoading) {
    return <DashboardSkeleton />;
  }

  if (stickies.isError) {
    const message = formatApiError(
      stickies.error,
      "Couldn’t load your sticky notes.",
    );
    return (
      <div className="space-y-4">
        <DoodleFrame
          preset="sketch-c"
          color="blush"
          className="max-w-lg"
          interactive={false}
        >
          <p className="font-hand text-2xl text-ink">Stickies didn’t sync</p>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">{message}</p>
        </DoodleFrame>
        <Button type="button" onClick={() => stickies.refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  if (view === "stickies") {
    return (
      <div className="space-y-6">
        <SectionHeader
          title="Sticky notes"
          description="Search, filter, and drag to reorder. Pinned notes stay on top."
          action={
            <Button type="button" onClick={openCreate}>
              <Plus className="h-4 w-4" strokeWidth={1.75} />
              New sticky
            </Button>
          }
        />
        <StickyBoard
          notes={stickies.notes}
          tags={stickies.tags}
          showToolbar
          filters={filters}
          onFiltersChange={setFilters}
          onCreate={stickies.create}
          onUpdate={stickies.update}
          onDelete={stickies.remove}
          onTogglePin={stickies.togglePin}
          onToggleArchive={stickies.toggleArchive}
          onToggleComplete={stickies.toggleComplete}
          onReorder={(ids) => stickies.reorder(ids)}
          isLoading={stickies.isLoading}
          isError={stickies.isError}
          errorMessage={formatApiError(
            stickies.error,
            "Couldn’t load your sticky notes.",
          )}
          onRetry={() => stickies.refetch()}
        />
        <StickyEditor
          open={editorOpen}
          onOpenChange={setEditorOpen}
          note={editing}
          onSave={(input) => void handleSave(input)}
          onDelete={
            editing
              ? () => {
                  void stickies.remove(editing.id);
                }
              : undefined
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Archive"
        description="Restore stickies anytime — or delete them for good."
      />
      <StickyBoard
        notes={stickies.archived}
        showQuickAdd={false}
        emptyTitle="Archive is empty"
        emptyDescription="Archived stickies will rest here."
        onCreate={stickies.create}
        onUpdate={stickies.update}
        onDelete={stickies.remove}
        onTogglePin={stickies.togglePin}
        onToggleArchive={stickies.toggleArchive}
        onToggleComplete={stickies.toggleComplete}
      />
    </div>
  );
}
