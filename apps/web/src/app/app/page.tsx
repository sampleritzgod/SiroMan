"use client";

import { Suspense } from "react";
import { Dashboard } from "@/components/dashboard/dashboard";
import { CalendarOAuthReturnBanner } from "@/components/calendar/calendar-oauth-banner";
import { Button } from "@/components/ui/button";
import { DoodleFrame } from "@/components/md/doodle-frame";
import { useMe } from "@/hooks/use-me";
import { formatApiError } from "@/lib/api-client";

function LoadingSketch() {
  return (
    <div className="space-y-4" role="status" aria-live="polite">
      <div className="h-8 w-48 animate-pulse rounded-[12px_16px_14px_18px] bg-sticky-ink" />
      <div className="h-4 w-72 animate-pulse rounded-[10px] bg-sticky-ink/80" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-40 animate-pulse rounded-[16px_20px_18px_14px] bg-sticky-ink/55"
          />
        ))}
      </div>
      <p className="sr-only">Loading your workspace…</p>
    </div>
  );
}

export default function AppHomePage() {
  const { data, isLoading, isError, error, refetch, isFetching } = useMe();

  if (isLoading) {
    return <LoadingSketch />;
  }

  if (isError || !data) {
    const message = formatApiError(
      error,
      "Couldn’t reach the SiroMan API.",
    );

    return (
      <div className="space-y-4">
        <DoodleFrame
          preset="sketch-c"
          color="blush"
          className="max-w-lg"
          interactive={false}
        >
          <p className="font-hand text-2xl text-ink">Couldn’t sync your account</p>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">{message}</p>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">
            Confirm the API is running and your Clerk keys match on web and API.
          </p>
        </DoodleFrame>
        <Button onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? "Retrying…" : "Retry"}
        </Button>
      </div>
    );
  }

  return (
    <>
      <Suspense fallback={null}>
        <CalendarOAuthReturnBanner />
      </Suspense>
      <Dashboard me={data} />
    </>
  );
}
