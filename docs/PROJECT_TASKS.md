# PROJECT_TASKS.md

**Product:** StickyFlow  
**Version:** 1.0  
**Last updated:** 2026-07-24  
**Companion:** [IMPLEMENTATION_ORDER.md](./IMPLEMENTATION_ORDER.md)  
**Rule:** Check boxes only when acceptance criteria in IMPLEMENTATION_ORDER are met.  
**Rule:** No application code until founder approves docs + this plan.

**Canonical model:** One `Item` (sticky/commitment). There is **no** separate Tasks table.

---

## Legend

- `[ ]` todo · `[x]` done  
- Prefix `E0`…`E15` = engineering phase ([IMPLEMENTATION_ORDER](./IMPLEMENTATION_ORDER.md))  
- **Blockers before E4 UI:** masonry board locked · Postgres host chosen · `dueDate` naming patch accepted  

---

## Pre-flight (docs / decisions)

- [x] Approve docs `01`–`12`
- [x] Approve IMPLEMENTATION_ORDER audit resolutions (C1–C12)
- [x] Lock board layout = **masonry** (not freeform for MVP)
- [x] Choose Postgres host: local Docker for dev (Railway/Supabase later for prod)
- [ ] Patch docs: `dueAt` → `dueDate` everywhere
- [ ] Patch docs: reminder `d_day_afternoon` rule aligned
- [x] Schema includes `retryCount`, `dismissedAt` (webhook/inbox summary deferred to later phases)
- [ ] Create Clerk app (dev + staging) — **required before auth works end-to-end**
- [ ] Create Vercel + Railway accounts
- [ ] Generate VAPID keys (staging)
- [x] Trademark / final name decision (or proceed as StickyFlow working title)
- [x] Explicit founder go-ahead to start **E0** code

---

## E0 — Project setup

- [x] Initialize git repository (if not already) — optional; workspace ready
- [x] Create monorepo workspace (`apps/web`, `apps/api`, `packages/shared`)
- [x] Configure package manager (pnpm recommended) + workspaces
- [x] Add root scripts: `dev`, `lint`, `typecheck`, `test`, `build`
- [x] Add EditorConfig (+ Prettier deferred)
- [x] Scaffold Next.js 15 + React 19 + TypeScript in `apps/web`
- [x] Enable App Router
- [x] Configure TypeScript `strict` for web
- [x] Scaffold Express + TypeScript in `apps/api`
- [x] Add `GET /health` endpoint
- [x] Configure TypeScript `strict` for api
- [x] Add Zod env validation for api
- [x] Web env via `.env.local` (`NEXT_PUBLIC_*`)
- [x] Create `.env.example` (web + api)
- [x] Add `docker-compose.yml` with PostgreSQL
- [x] Document local boot in root README
- [ ] Add GitHub Actions CI — deferred (not needed for Phase 1 local)
- [ ] Configure Vercel / Railway — deferred until deploy
- [ ] Wire Sentry — deferred (avoid over-engineering)
- [x] Verify local `/health` returns ok
- [x] Add `packages/shared` for Zod schemas / types

---

## E1 — Design system (MDL)

- [x] Configure TailwindCSS in web
- [x] Extend Tailwind theme: canvas / ink / accent / danger / success / warning
- [x] Extend Tailwind theme: sticky color tokens (8)
- [x] Extend Tailwind theme: radius + spacing scale
- [x] Load **Source Sans 3** via `next/font`
- [x] Load **Fraunces** via `next/font`
- [x] shadcn-style primitives (Button, Input, Dialog) skinned to MDL
- [ ] Dropdown Menu / Popover — add when ItemSheet needs them (Phase 2)
- [x] Build `DoodleFrame` with presets `sketch-a|b|c`
- [x] Build `DueChip` component (all statuses)
- [x] Add Framer Motion dependency
- [x] Create `lib/motion.ts` presets + reduced-motion helper
- [x] Add empty-state illustration (Board)
- [ ] Agenda / Inbox empty illustrations — when those views ship
- [x] MDL verified via marketing + `/app` (no separate sandbox page)

---

## E2 — Authentication (Clerk)

- [x] Add Clerk to Next.js
- [x] Create `/sign-in` and `/sign-up` routes
- [x] Add Clerk middleware protecting `/app/*`
- [x] Add Clerk provider in root layout
- [x] Implement API JWT verification middleware
- [x] Reject missing/invalid Bearer tokens with 401
- [x] Implement `GET /v1/me` upsert by `clerkId`
- [x] Implement `PATCH /v1/me` preferences
- [x] Map Clerk email/name into User on upsert
- [x] Build web `api()` client attaching Clerk token
- [x] Add TanStack Query provider
- [x] Add `useMe` hook
- [x] Redirect authenticated users from marketing to `/app`
- [x] Handle API upsert failure with retry UI (no loop)

---

## E3 — Database (Prisma MVP)

- [x] Add Prisma to `apps/api`
- [x] Define enum `Priority`
- [x] Define enum `StickyColor`
- [x] Define enum `ReminderStatus`
- [x] Define enum `ReminderChannel`
- [x] Define enum `WeekStart`
- [x] Create `User` model
- [x] Create `Item` model
- [x] Create `Tag` model
- [x] Create `ItemTag` model
- [x] Create `ReminderOccurrence` model
- [x] Add `retryCount` to `ReminderOccurrence`
- [x] Create `ReminderInboxEntry` model
- [x] Add `dismissedAt` to `ReminderInboxEntry`
- [x] Create `PushSubscription` model
- [x] Add indexes: items by user/archived/pinned
- [x] Add indexes: items by user/dueDate
- [x] Add indexes: reminders by status/fireAt
- [x] Run initial migration locally
- [ ] Run migration on staging — deferred until deploy
- [x] Implement `lib/prisma.ts` singleton
- [x] Implement date helpers in `@stickyflow/shared`
- [x] Unit tests: remaining days / status
- [ ] Prisma migrate deploy on Railway — deferred until deploy

---

## E4 — Sticky Notes CRUD

### API

- [ ] `GET /v1/items` view=`board`
- [ ] `GET /v1/items` view=`archive`
- [ ] `GET /v1/items` pagination cursor/limit
- [ ] `GET /v1/items/:id`
- [ ] `POST /v1/items` (description required)
- [ ] `PATCH /v1/items/:id`
- [ ] `DELETE /v1/items/:id`
- [ ] Enforce userId scoping on all item queries (404 other user)
- [ ] Tag normalize (trim, lowercase, strip `#`)
- [ ] Upsert tags on create/update
- [ ] Cap tags per item at 20
- [ ] `GET /v1/tags` with counts
- [ ] `DELETE /v1/tags/:id`
- [ ] Search `?q=` across title, description, tag names
- [ ] Integration tests I-ITEM-01, I-AUTH-02, I-SEARCH-01

### Web — shell

- [ ] Create `/app` layout with top nav (desktop)
- [ ] Create mobile bottom tab bar
- [ ] Nav links: Board, Agenda, Inbox, Archive, Settings
- [ ] Floating / primary **New Sticky** CTA
- [ ] Loading skeleton cards
- [ ] Global error callout + retry pattern
- [ ] Toast helper for mutations

### Web — board

- [ ] Board page fetches `view=board`
- [ ] Masonry / responsive grid layout
- [ ] `StickyCard` with color + doodle border
- [ ] Show title or description clamp
- [ ] Show priority indicator + sr-text
- [ ] Show up to 2 tags +N
- [ ] Pin glyph when pinned
- [ ] Pinned zone above active stickies
- [ ] Open ItemSheet on card click
- [ ] Create sticky flow (≤2 interactions)
- [ ] Autosave PATCH debounce 400ms
- [ ] Pin / unpin toggle
- [ ] Archive action (unpin if needed)
- [ ] Delete confirm dialog (focus trapped)
- [ ] Color swatches (8)
- [ ] Priority selector
- [ ] Tag input with autocomplete from `/v1/tags`
- [ ] Search overlay / input with debounce
- [ ] Archive page `view=archive`
- [ ] Restore from archive (`archived: false`)
- [ ] XSS-safe text rendering (no raw HTML)
- [ ] Playwright E-02, E-06, E-07

---

## E5 — Commitments (unified Item — not a Task entity)

- [ ] Accept `dueDate` `YYYY-MM-DD` on create/patch
- [ ] Serializer: `status` derived field
- [ ] Serializer: `remainingDays` derived field
- [ ] Clear dueDate demotes to note + cancels reminders (wire when E7 ready)
- [ ] Past dueDate allowed → overdue
- [ ] `POST /v1/items/:id/complete`
- [ ] Honor `autoArchiveOnComplete` user pref
- [ ] `POST /v1/items/:id/reopen`
- [ ] DueChip on StickyCard
- [ ] Due date picker in ItemSheet
- [ ] Complete / reopen controls in ItemSheet
- [ ] Copy: avoid “created a task” language
- [ ] Integration tests I-ITEM-04, I-ITEM-05
- [ ] Playwright E-03, E-05

---

## E6 — Agenda

- [ ] `GET /v1/items?view=agenda`
- [ ] Agenda sorts by dueDate ASC, priority DESC
- [ ] Exclude archived + completed from agenda
- [ ] Agenda page route `/app/agenda`
- [ ] Section: Overdue
- [ ] Section: Today
- [ ] Section: Tomorrow
- [ ] Section: Upcoming by date
- [ ] Open ItemSheet from agenda row
- [ ] Agenda empty state
- [ ] Verify same `id` as board (AC-DEDUP-01)
- [ ] Integration test I-AGENDA-01
- [ ] Playwright E-04

---

## E7 — Reminder engine

- [ ] Implement policy key planner (`d_minus_7`, `d_minus_5`, `d_minus_1`, `d_minus_1_evening`, `d_day`, `d_day_afternoon`)
- [ ] Skip policy fires before “now” (except overdue path)
- [ ] Skip D−7/D−5 when due too soon
- [ ] High priority adds evening-before occurrence
- [ ] Apply quiet-hours shift using User minute defaults
- [ ] `ReminderService.rebuildForItem` transaction (cancel scheduled + insert)
- [ ] Cancel reminders on complete
- [ ] Cancel reminders on delete
- [ ] Cancel reminders on archive
- [ ] Rebuild on restore if dated + open
- [ ] Rebuild on dueDate change
- [ ] Rebuild on priority change (evening rule)
- [ ] Rebuild on timezone change (async OK)
- [ ] Unit tests U-REM-01…10
- [ ] Worker process entrypoint
- [ ] Worker poll every 30s
- [ ] `FOR UPDATE SKIP LOCKED` claim batch
- [ ] Mark `claimed` → process → `sent` / `failed` / `cancelled`
- [ ] Skip send if item completed/archived
- [ ] Always create/ensure `ReminderInboxEntry` on fire
- [ ] Overdue rolling sweep job (do not pre-insert year of rows)
- [ ] `retryCount` increment + requeue transient failures
- [ ] Terminal `failed` after max retries
- [ ] Worker metrics/logging (no note body)
- [ ] Railway worker service runs continuously
- [ ] Worker tests W-01, W-02, W-04, W-05
- [ ] Staging soak plan documented

---

## E8 — Notifications (Inbox + Web Push)

### Inbox

- [ ] `GET /v1/inbox`
- [ ] `GET /v1/inbox?unreadOnly=true`
- [ ] `GET /v1/inbox/summary` → `{ unreadCount }`
- [ ] `POST /v1/inbox/:id/read`
- [ ] `POST /v1/inbox/read-all`
- [ ] `POST /v1/reminders/:occurrenceId/dismiss`
- [ ] `POST /v1/reminders/:occurrenceId/snooze` presets
- [ ] Snooze preset `1h`
- [ ] Snooze preset `later_today`
- [ ] Snooze preset `tomorrow_9`
- [ ] Inbox page `/app/inbox`
- [ ] Unread / All filters in UI
- [ ] Inbox row actions: Complete, Snooze, Open, Dismiss
- [ ] Nav badge bound to unreadCount
- [ ] Poll inbox every 60s + refetch on window focus
- [ ] Deep link `/app/items/[id]?occurrence=`
- [ ] Playwright E-08, E-09, E-10
- [ ] Integration I-SNOOZE-01

### Web Push

- [ ] Generate/store VAPID keys in env
- [ ] `POST /v1/push-subscriptions`
- [ ] Upsert by endpoint uniqueness
- [ ] Reject non-https endpoints
- [ ] `DELETE /v1/push-subscriptions`
- [ ] `POST /v1/push-subscriptions/test`
- [ ] Implement PushService (`web-push`)
- [ ] Delete subscription on 410/404
- [ ] Add `public/sw.js` push handler
- [ ] notificationclick → item deep link
- [ ] Client `lib/push.ts` subscribe helper
- [ ] Request permission UX in Settings
- [ ] Document Safari/iOS limitations in UI
- [ ] Worker sends push to all user subscriptions
- [ ] Product works when permission denied (inbox-only)
- [ ] Integration I-PUSH-01, I-PUSH-02
- [ ] Manual matrix: Chrome macOS push verified
- [ ] Remove push subscription on sign-out (best effort)

---

## E9 — Settings + account

- [ ] Settings page `/app/settings`
- [ ] Preferences: timezone (IANA select)
- [ ] Preferences: week starts on
- [ ] Preferences: auto-archive on complete
- [ ] Preferences: remindersEnabled
- [ ] Notifications: enable Web Push
- [ ] Notifications: send test
- [ ] Account: export JSON (`GET /v1/export`)
- [ ] Rate limit export (5/hour)
- [ ] Account: delete with `{ confirm: "DELETE" }`
- [ ] Client also deletes Clerk user after app delete (documented flow)
- [ ] `POST /v1/webhooks/clerk` with signature verify
- [ ] Webhook `user.deleted` cascades app user
- [ ] Integration I-EXPORT-01, I-ACCOUNT-01, I-RATE-01
- [ ] CORS allowlist production web origin only
- [ ] Helmet + requestId + pino logger (redact bodies)
- [ ] Global API rate limit 120 req/min per clerkId

---

## E10 — Onboarding + MVP hardening

- [ ] First-run 3 example stickies (client-side)
- [ ] Dismiss examples → `onboardingCompleted=true`
- [ ] Never show examples again when flag true
- [ ] Marketing landing stub `/`
- [ ] Favicon + basic OG image
- [ ] Privacy policy stub page/link
- [ ] Playwright smoke E-01…E-06 in CI
- [ ] Accessibility pass A-01…A-05
- [ ] Security pass S-01…S-07
- [ ] Load check: 200 items board usable
- [ ] Reminder worker 48h staging soak
- [ ] Confirm reminder lag p95 &lt; 5 minutes
- [ ] Define analytics event names for WCCR (log-only MVP)
- [ ] Closed beta checklist signed off ([12](./12-testing-checklist.md) §16)
- [ ] Update root README with architecture + docs links

---

## E11 — Phase 2 depth

- [ ] `view=today` API
- [ ] Today / Focus page `/app/today`
- [ ] Quiet hours start/end Settings UI
- [ ] Morning digest job + preference
- [ ] Filter chips: color
- [ ] Filter chips: tag
- [ ] Filter chips: priority
- [ ] Filter chips: due window
- [ ] Optional `dueTime` schema + migration
- [ ] Policy supports dueTime fires
- [ ] Checklist field/schema for items
- [ ] Checklist UI in ItemSheet
- [ ] `trackAsCommitment` without dueDate
- [ ] Keyboard shortcut: New sticky
- [ ] Keyboard shortcut: Search focus
- [ ] Dark mode tokens + toggle
- [ ] Virtualize board at &gt;150 items
- [ ] Idempotency-Key support for POST /items
- [ ] Search includes archived with explicit toggle

---

## E12 — Calendar + Google Calendar

- [ ] Calendar page `/app/calendar`
- [ ] Month grid UI
- [ ] Week grid UI
- [ ] Render commitments on days
- [ ] Drag item to new day → PATCH dueDate
- [ ] Reschedule rebuilds reminders
- [ ] Feature flag `FF_CALENDAR`
- [ ] Google OAuth start/callback routes
- [ ] Encrypt refresh tokens at rest
- [ ] `GoogleCalendarConnection` migration
- [ ] `GoogleEventMap` migration
- [ ] Create/patch Google all-day events on dueDate changes
- [ ] Settings: connect / disconnect / sync status
- [ ] Handle token revoke UX
- [ ] Tests GC-01…GC-06

---

## E13 — Focus streaks

- [ ] `StreakDay` migration
- [ ] Nightly streak computation job (per user TZ)
- [ ] Neutral day when planned=0
- [ ] Rest day API `POST /v1/streaks/rest-day`
- [ ] `GET /v1/streaks` summary
- [ ] Subtle current streak UI (not guilt copy)
- [ ] Longest streak + completion % display
- [ ] Consistency score v1
- [ ] Ensure opens do **not** affect streak
- [ ] Tests ST-01…ST-05
- [ ] Feature flag `FF_STREAKS`

---

## E14 — Analytics

- [ ] Finalize event taxonomy (WCCR, reminder→complete)
- [ ] Persist or warehouse events (choose approach)
- [ ] `GET /v1/insights/summary` (or equivalent)
- [ ] Insights page `/app/insights`
- [ ] Chart: WCCR trend
- [ ] Chart: overdue rate
- [ ] Breakdown by tag/color
- [ ] Reminder → complete funnel
- [ ] CSV export enrichment
- [ ] No team/org analytics

---

## E15 — AI assistant

- [ ] Privacy opt-in gate
- [ ] Provider configuration (server-side keys)
- [ ] Suggest dueDate from natural language (confirm required)
- [ ] Suggest checklist breakdown (confirm required)
- [ ] “What should I do now?” ranker over existing open items
- [ ] Hard ban: autopilot mass task creation
- [ ] Feature flag `FF_AI`
- [ ] Side panel UX (not new top-level tab initially)
- [ ] Audit logging without storing full prompts in plaintext longer than needed

---

## Explicitly excluded (do not add tasks casually)

- [ ] ~~Separate Task table~~ **Rejected**
- [ ] ~~Reward app opens~~ **Rejected**
- [ ] ~~Team workspaces / comments~~ **Rejected MVP+**
- [ ] ~~Drawing on stickies~~ **Deferred**
- [ ] ~~E2E encryption~~ **Rejected MVP**
- [ ] ~~Native iOS/Android apps~~ **Deferred**
- [ ] ~~SMS reminders~~ **Out of scope**
- [ ] ~~GraphQL~~ **Rejected**

---

## Progress tracking

| Phase | Total checkboxes (approx) | Done |
|-------|---------------------------|------|
| Pre-flight | 12 | 0 |
| E0 Setup | ~28 | 0 |
| E1 MDL | ~22 | 0 |
| E2 Auth | ~14 | 0 |
| E3 DB | ~24 | 0 |
| E4 Stickies | ~45 | 0 |
| E5 Commitments | ~16 | 0 |
| E6 Agenda | ~12 | 0 |
| E7 Reminders | ~28 | 0 |
| E8 Notifications | ~35 | 0 |
| E9 Settings | ~18 | 0 |
| E10 Harden | ~16 | 0 |
| **MVP subtotal** | **~270** | **0** |
| E11–E15 post-MVP | ~70 | 0 |

Update counts when checking off; keep this file the execution source of truth.
