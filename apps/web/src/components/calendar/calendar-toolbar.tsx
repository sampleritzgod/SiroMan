"use client";

import { useMemo } from "react";
import type { Priority } from "@stickyflow/shared";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type {
  CalendarMode,
  CalendarRangeFilter,
  StickyTag,
} from "@/lib/types";
import {
  formatDayLabel,
  formatMonthLabel,
  formatWeekLabel,
  type WeekStartsOn,
} from "@/lib/calendar-utils";

export type CalendarFilters = {
  q: string;
  tag: string;
  priority: Priority | "";
  range: CalendarRangeFilter;
};

type CalendarToolbarProps = {
  mode: CalendarMode;
  onModeChange: (mode: CalendarMode) => void;
  anchor: Date;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  weekStartsOn: WeekStartsOn;
  filters: CalendarFilters;
  onFiltersChange: (next: CalendarFilters) => void;
  tags: StickyTag[];
};

const MODES: { value: CalendarMode; label: string }[] = [
  { value: "month", label: "Month" },
  { value: "week", label: "Week" },
  { value: "day", label: "Day" },
];

const RANGES: { value: CalendarRangeFilter; label: string }[] = [
  { value: "all", label: "All dates" },
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
];

const PRIORITIES: { value: Priority | ""; label: string }[] = [
  { value: "", label: "All priorities" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
  { value: "none", label: "None" },
];

export function CalendarToolbar({
  mode,
  onModeChange,
  anchor,
  onPrev,
  onNext,
  onToday,
  weekStartsOn,
  filters,
  onFiltersChange,
  tags,
}: CalendarToolbarProps) {
  const label =
    mode === "month"
      ? formatMonthLabel(anchor)
      : mode === "week"
        ? formatWeekLabel(anchor, weekStartsOn)
        : formatDayLabel(anchor);

  const activeChips = useMemo(() => {
    const chips: string[] = [];
    if (filters.range !== "all") {
      chips.push(
        RANGES.find((r) => r.value === filters.range)?.label ?? filters.range,
      );
    }
    if (filters.priority) chips.push(filters.priority);
    if (filters.tag) chips.push(`#${filters.tag}`);
    if (filters.q.trim()) chips.push(`“${filters.q.trim()}”`);
    return chips;
  }, [filters]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="inline-flex rounded-[12px_14px_11px_13px] border-[1.5px] border-stroke-doodle/40 bg-surface p-1"
            role="tablist"
            aria-label="Calendar view"
          >
            {MODES.map((item) => (
              <button
                key={item.value}
                type="button"
                role="tab"
                aria-selected={mode === item.value}
                onClick={() => onModeChange(item.value)}
                className={cn(
                  "rounded-[9px_11px_10px_12px] px-3 py-1.5 text-sm font-medium transition-colors",
                  mode === item.value
                    ? "bg-sticky-ink text-ink shadow-[0.5px_1px_0_rgba(42,38,34,0.08)]"
                    : "text-ink-muted hover:text-ink",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 w-9 min-h-9 px-0"
              onClick={onPrev}
              aria-label="Previous"
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={1.75} />
            </Button>
            <p className="min-w-[10rem] text-center font-hand text-2xl leading-none text-ink sm:min-w-[14rem]">
              {label}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 w-9 min-h-9 px-0"
              onClick={onNext}
              aria-label="Next"
            >
              <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onToday}
            >
              Today
            </Button>
          </div>
        </div>
      </div>

      <div className="dot-surface space-y-3 rounded-[16px_20px_18px_14px] border-[1.75px] border-stroke-doodle/45 p-4 shadow-[var(--paper-shadow)]">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
            strokeWidth={1.75}
          />
          <Input
            value={filters.q}
            onChange={(e) =>
              onFiltersChange({ ...filters, q: e.target.value })
            }
            placeholder="Search calendar stickies…"
            aria-label="Search calendar items"
            className="pl-6"
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <label className="flex min-w-[140px] flex-1 flex-col gap-1 text-[11px] font-medium uppercase tracking-[0.06em] text-ink-muted">
            Range
            <select
              value={filters.range}
              onChange={(e) =>
                onFiltersChange({
                  ...filters,
                  range: e.target.value as CalendarRangeFilter,
                })
              }
              className="h-10 rounded-[10px_12px_11px_13px] border-[1.5px] border-stroke-doodle/40 bg-surface px-3 text-sm font-normal normal-case tracking-normal text-ink"
            >
              {RANGES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex min-w-[140px] flex-1 flex-col gap-1 text-[11px] font-medium uppercase tracking-[0.06em] text-ink-muted">
            Priority
            <select
              value={filters.priority}
              onChange={(e) =>
                onFiltersChange({
                  ...filters,
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
              onClick={() => onFiltersChange({ ...filters, tag: "" })}
              className={cn(
                "rounded-[8px_11px_9px_10px] border-[1.5px] px-2.5 py-1 text-xs font-medium transition-colors",
                !filters.tag
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
                  onFiltersChange({
                    ...filters,
                    tag: filters.tag === tag.name ? "" : tag.name,
                  })
                }
                className={cn(
                  "rounded-[8px_11px_9px_10px] border-[1.5px] px-2.5 py-1 text-xs font-medium transition-colors",
                  filters.tag === tag.name
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

        {activeChips.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            {activeChips.map((chip) => (
              <Badge key={chip} variant="outline">
                {chip}
              </Badge>
            ))}
            <button
              type="button"
              onClick={() =>
                onFiltersChange({
                  q: "",
                  tag: "",
                  priority: "",
                  range: "all",
                })
              }
              className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink"
            >
              <X className="h-3 w-3" strokeWidth={1.75} />
              Clear filters
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
