"use client";

import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  Archive,
  Bell,
  CalendarDays,
  Home,
  LayoutGrid,
  StickyNote,
} from "lucide-react";
import {
  AppShellProvider,
  useAppShell,
} from "@/components/app-shell-context";
import { ReminderBadgeButton } from "@/components/reminders/reminder-badge";
import { BrowserNotificationListener } from "@/components/reminders/browser-notification-listener";
import { StickyDeepLinkHost } from "@/components/reminders/sticky-deep-link-host";
import { ThemeToggle } from "@/components/theme-toggle";
import { Navbar } from "@/components/ui/navbar";
import { Sidebar } from "@/components/ui/sidebar";
import { useMe } from "@/hooks/use-me";

function workspaceLabel(me: {
  displayName: string | null;
  email: string | null;
} | undefined): string | undefined {
  if (!me) return undefined;
  const name = me.displayName?.trim();
  if (name) return name;
  const email = me.email?.trim();
  if (email) return email;
  return undefined;
}

function AppChrome({ children }: { children: ReactNode }) {
  const { view, setView } = useAppShell();
  const { data: me } = useMe();
  const title = workspaceLabel(me);

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <BrowserNotificationListener />
      <StickyDeepLinkHost />
      <Navbar
        brand={
          <Link
            href="/app"
            onClick={() => setView("home")}
            className="font-hand text-2xl leading-none text-ink transition-opacity hover:opacity-80"
          >
            SiroMan
          </Link>
        }
        title={title}
        actions={
          <>
            <ThemeToggle compact />
            <ReminderBadgeButton
              active={view === "reminders"}
              onClick={() => setView("reminders")}
            />
            <UserButton
              appearance={{
                elements: {
                  avatarBox:
                    "rounded-[10px_12px_11px_13px] border border-[color:var(--stroke-doodle)]/25",
                },
              }}
            />
          </>
        }
      />

      <div className="mx-auto flex w-full max-w-7xl flex-1">
        <div className="sticky top-0 hidden h-[calc(100vh-3.5rem)] md:block">
          <Sidebar
            items={[
              {
                id: "home",
                label: "Home",
                icon: <Home strokeWidth={1.75} />,
                active: view === "home",
                onClick: () => setView("home"),
              },
              {
                id: "stickies",
                label: "Stickies",
                icon: <StickyNote strokeWidth={1.75} />,
                active: view === "stickies",
                onClick: () => setView("stickies"),
              },
              {
                id: "calendar",
                label: "Calendar",
                icon: <CalendarDays strokeWidth={1.75} />,
                active: view === "calendar",
                onClick: () => setView("calendar"),
              },
              {
                id: "reminders",
                label: "Reminders",
                icon: <Bell strokeWidth={1.75} />,
                active: view === "reminders",
                onClick: () => setView("reminders"),
              },
              {
                id: "archive",
                label: "Archive",
                icon: <Archive strokeWidth={1.75} />,
                active: view === "archive",
                onClick: () => setView("archive"),
              },
              {
                id: "board",
                label: "Freeform",
                icon: <LayoutGrid strokeWidth={1.75} />,
                disabled: true,
              },
            ]}
            footer={
              <p className="px-2 text-[11px] leading-relaxed text-ink-faint">
                Doodle accents. Clean commitments.
              </p>
            }
          />
        </div>

        <div className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">
          <div className="mb-5 flex gap-2 overflow-x-auto md:hidden">
            {(
              [
                ["home", "Home"],
                ["stickies", "Stickies"],
                ["calendar", "Calendar"],
                ["reminders", "Reminders"],
                ["archive", "Archive"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setView(id)}
                className={
                  view === id
                    ? "rounded-[10px_12px_11px_13px] border-[1.5px] border-stroke-doodle bg-sticky-ink px-3 py-2 text-sm font-medium text-ink"
                    : "rounded-[10px_12px_11px_13px] border-[1.5px] border-stroke-doodle/25 px-3 py-2 text-sm text-ink-muted"
                }
              >
                {label}
              </button>
            ))}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AppShellProvider>
      <AppChrome>{children}</AppChrome>
    </AppShellProvider>
  );
}
