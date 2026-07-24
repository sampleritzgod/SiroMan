"use client";

import { useMemo, useState } from "react";
import type { ItemSort, Priority } from "@stickyflow/shared";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { StickyTag } from "@/lib/types";

export type StickyFilters = {
  q: string;
  tag: string;
  priority: Priority | "";
  sort: ItemSort;
};

type StickyToolbarProps = {
  value: StickyFilters;
  onChange: (next: StickyFilters) => void;
  tags: StickyTag[];
  className?: string;
};

const SORTS: { value: ItemSort; label: string }[] = [
  { value: "pinned", label: "Pinned first" },
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "dueDate", label: "Due date" },
  { value: "rank", label: "Custom order" },
];

const PRIORITIES: { value: Priority | ""; label: string }[] = [
  { value: "", label: "All priorities" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
  { value: "none", label: "None" },
];

export function StickyToolbar({
  value,
  onChange,
  tags,
  className,
}: StickyToolbarProps) {
  const activeFilters = useMemo(() => {
    const chips: string[] = [];
    if (value.tag) chips.push(`#${value.tag}`);
    if (value.priority) chips.push(value.priority);
    if (value.q.trim()) chips.push(`“${value.q.trim()}”`);
    return chips;
  }, [value]);

  return (
    <div
      className={cn(
        "dot-surface space-y-3 rounded-[16px_20px_18px_14px] border-[1.75px] border-stroke-doodle/45 p-4 shadow-[var(--paper-shadow)]",
        className,
      )}
    >
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
          strokeWidth={1.75}
        />
        <Input
          value={value.q}
          onChange={(e) => onChange({ ...value, q: e.target.value })}
          placeholder="Search stickies…"
          aria-label="Search sticky notes"
          className="pl-6"
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <label className="flex min-w-[160px] flex-1 flex-col gap-1 text-[11px] font-medium uppercase tracking-[0.06em] text-ink-muted">
          Sort
          <select
            value={value.sort}
            onChange={(e) =>
              onChange({ ...value, sort: e.target.value as ItemSort })
            }
            className="h-10 rounded-[10px_12px_11px_13px] border-[1.5px] border-stroke-doodle/40 bg-surface px-3 text-sm font-normal normal-case tracking-normal text-ink"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex min-w-[160px] flex-1 flex-col gap-1 text-[11px] font-medium uppercase tracking-[0.06em] text-ink-muted">
          Priority
          <select
            value={value.priority}
            onChange={(e) =>
              onChange({
                ...value,
                priority: e.target.value as Priority | "",
              })
            }
            className="h-10 rounded-[10px_12px_11px_13px] border-[1.5px] border-stroke-doodle/40 bg-surface px-3 text-sm font-normal normal-case tracking-normal text-ink"
          >
            {PRIORITIES.map((p) => (
              <option key={p.value || "all"} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {tags.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onChange({ ...value, tag: "" })}
            className={cn(
              "rounded-[8px_11px_9px_10px] border-[1.5px] px-2.5 py-1 text-xs font-medium transition-colors",
              !value.tag
                ? "border-stroke-doodle bg-sticky-ink text-ink"
                : "border-stroke-doodle/25 text-ink-muted hover:bg-sticky-ink/60",
            )}
          >
            All tags
          </button>
          {tags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onClick={() =>
                onChange({
                  ...value,
                  tag: value.tag === tag.name ? "" : tag.name,
                })
              }
              className={cn(
                "rounded-[8px_11px_9px_10px] border-[1.5px] px-2.5 py-1 text-xs font-medium transition-colors",
                value.tag === tag.name
                  ? "border-stroke-doodle bg-sticky-ink text-ink"
                  : "border-stroke-doodle/25 text-ink-muted hover:bg-sticky-ink/60",
              )}
            >
              #{tag.name}
              <span className="ml-1 text-ink-faint">{tag.count}</span>
            </button>
          ))}
        </div>
      ) : null}

      {activeFilters.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {activeFilters.map((chip) => (
            <Badge key={chip} variant="outline">
              {chip}
            </Badge>
          ))}
          <button
            type="button"
            onClick={() =>
              onChange({ q: "", tag: "", priority: "", sort: value.sort })
            }
            className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink"
          >
            <X className="h-3 w-3" strokeWidth={1.75} />
            Clear filters
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function useStickyFilters(initial?: Partial<StickyFilters>) {
  return useState<StickyFilters>({
    q: initial?.q ?? "",
    tag: initial?.tag ?? "",
    priority: initial?.priority ?? "",
    sort: initial?.sort ?? "pinned",
  });
}
