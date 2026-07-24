"use client";

function Pulse({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-[12px_16px_14px_18px] bg-sticky-ink ${className ?? ""}`}
    />
  );
}

function RowSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-[14px_16px_13px_15px] border-[1.5px] border-stroke-doodle/20 bg-surface/70 px-3.5 py-3">
      <Pulse className="h-9 w-1.5 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-2">
        <Pulse className="h-3.5 w-2/3 max-w-[12rem]" />
        <Pulse className="h-3 w-1/3 max-w-[6rem] bg-sticky-ink/70" />
      </div>
      <Pulse className="h-6 w-16 rounded-[9px_12px_10px_11px]" />
    </div>
  );
}

/** Layout-matched skeleton so the execution dashboard paints immediately. */
export function DashboardSkeleton() {
  return (
    <div className="space-y-8" role="status" aria-label="Loading dashboard">
      <div className="rounded-[20px_24px_18px_22px] border-[1.75px] border-stroke-doodle/35 bg-surface/70 p-6 md:p-8">
        <Pulse className="h-3.5 w-40 bg-sticky-ink/80" />
        <Pulse className="mt-3 h-10 w-64 max-w-full md:h-12 md:w-80" />
        <Pulse className="mt-3 h-4 w-72 max-w-full bg-sticky-ink/70" />
        <div className="mt-5 flex gap-2">
          <Pulse className="h-10 w-36 rounded-[12px_14px_11px_13px]" />
          <Pulse className="h-10 w-24 rounded-[12px_14px_11px_13px] bg-sticky-ink/70" />
        </div>
      </div>

      <div className="space-y-4">
        <Pulse className="h-8 w-40" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Pulse
              key={i}
              className="h-40 rounded-[16px_20px_18px_14px] bg-sticky-ink/55"
            />
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {[0, 1].map((col) => (
          <div key={col} className="space-y-3">
            <Pulse className="h-8 w-36" />
            <RowSkeleton />
            <RowSkeleton />
            <RowSkeleton />
          </div>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Pulse className="h-32 rounded-[16px_20px_18px_14px] bg-sticky-ink/55" />
        <Pulse className="h-32 rounded-[16px_20px_18px_14px] bg-sticky-ink/55" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Pulse className="h-44 rounded-[16px_20px_18px_14px] bg-sticky-ink/50" />
        <div className="space-y-3">
          <Pulse className="h-8 w-36" />
          <RowSkeleton />
          <RowSkeleton />
        </div>
      </div>
    </div>
  );
}
