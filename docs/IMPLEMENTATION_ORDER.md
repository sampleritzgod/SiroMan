# IMPLEMENTATION_ORDER.md

**Product:** StickyFlow  
**Role:** Staff Software Architect / Tech Lead  
**Version:** 1.0  
**Last updated:** 2026-07-24  
**Status:** Pre-code implementation plan  
**Companion:** [PROJECT_TASKS.md](./PROJECT_TASKS.md)  
**Sources:** All files in `/docs` (`01`–`12` + README)

---

## 0. Executive verdict

Docs are **internally coherent on the product thesis** (unified `Item`, reminders in MVP, calendar later). They are **not yet implementation-ready** without resolving naming contradictions, overdue-generation design, and a few missing API/schema pieces.

**Do not invent a separate Tasks table.** The user’s example phase list (“Phase 3 Tasks”) must be reinterpreted as **Commitments / Agenda views** over the same `Item` model ([01](./01-product-requirements.md), [06](./06-database-schema.md)).

**Correct build spine:**

```text
Foundations → Auth → MDL → Item CRUD → Due/Commitment → Agenda
  → Reminder policy + worker → Inbox → Web Push → Settings polish
  → Onboarding/QA → (Phase 2+) Today, Calendar, Streaks, Analytics, AI
```

---

## 1. Documentation consistency audit

### 1.1 Contradictions (must resolve before/during Phase 0)

| ID | Conflict | Sources | Resolution (architect decision) |
|----|----------|---------|----------------------------------|
| C1 | Field named `dueAt` vs `dueDate` | 01, 03 use `dueAt`; 04/06/08 use `dueDate` | **Standardize on `dueDate`** (civil `DATE`). Update 01/03 in a doc patch. |
| C2 | API paths omit `/v1` in flows | 03: `POST /items`; 08: `/v1/items` | **Always `/v1/...`**. Flows are conceptual. |
| C3 | `d_day_afternoon` who gets it? | 01: if still open; 04 table: unconditional; 12 U-REM-02: high only | **MVP: schedule `d_day_afternoon` for all priorities; worker no-ops if completed.** High also gets `d_minus_1_evening`. Patch 04/12 to match. |
| C4 | Filters in MVP? | 03 F09 “Search & filter”; 04 “MVP search only” | **MVP = search only.** Filters = Phase 2. |
| C5 | Quiet hours MVP vs Phase 2 | 01 defaults in MVP; 04 UI Phase 2; 12 tests quiet hours | **Apply stored defaults in worker MVP; Settings UI for quiet hours in Phase 2.** |
| C6 | Inbox “states” vs schema | 04 lists pending/sent/read/acted…; 06 only `readAt` on inbox | **Status lives on `ReminderOccurrence`; inbox uses `readAt` (+ optional `dismissedAt`).** Drop inbox state enum or add columns deliberately. |
| C7 | Reminder `channel` enum | 06: one of `inbox`\|`webpush`; worker does both | **Treat channel as “primary delivery intent”; always write inbox.** Or remove channel from occurrence and always dual-write. Prefer: `channel` default `webpush`, inbox always created. |
| C8 | Example phase order vs docs | User sketch: Calendar before Reminders | **Rejected.** Reminders before calendar ([01](./01-product-requirements.md), [11](./11-development-roadmap.md)). |
| C9 | “Tasks” as separate phase | User sketch Phase 3 Tasks | **No Task entity.** Commitment = `Item` with `dueDate`. |
| C10 | ER quietHours vs Prisma | ER shows `quietHoursStart` datetime; Prisma uses minute ints | **Prisma minute ints are canonical.** |
| C11 | Onboarding seed location | 03: client-side or API | **Client-seeded examples until dismiss; set `onboardingCompleted` via PATCH /me.** No server example rows (avoids delete clutter). |
| C12 | Nav: top bar vs left rail | 05, 10 leave open | **MVP: top bar desktop + bottom tabs mobile.** Left rail later if needed. |

### 1.2 Missing features / specs

| Gap | Impact | Action |
|-----|--------|--------|
| Overdue **rolling** generator | Cannot insert all future overdue rows at schedule time | Add `overdueSweep` job: daily ensure next overdue occurrence exists |
| `retryCount` on `ReminderOccurrence` | Retry policy in 07 has nowhere to store | Add `Int @default(0)` |
| Clerk **webhook** route | Account delete cascade incomplete | Add `POST /v1/webhooks/clerk` |
| Inbox **unread count** API | Nav badge (05) | Add `GET /v1/inbox/summary` → `{ unreadCount }` |
| `view=today` | Phase 2 Today | Extend items query later |
| Checklist / `dueTime` | Phase 2 features | Schema migration in Phase 2 |
| Analytics events / WCCR storage | Metrics in 01, no schema | Phase 5: `AnalyticsEvent` or warehouse; MVP: client+server log events only |
| AI endpoints | Phase 6 | Spec when entering phase |
| Restore named clearly | Archive restore | Document as `PATCH { archived: false }` |
| Soft-delete grace for account | 04 “30 days SLA” | MVP: hard delete app data; document Clerk delete; optional `deletionRequestedAt` later |
| Pin warn &gt; 20 | Soft warn only | Frontend-only |

### 1.3 Missing / incomplete API endpoints

| Endpoint | Why needed | Phase |
|----------|------------|-------|
| `POST /v1/webhooks/clerk` | user.deleted | 0/1 |
| `GET /v1/inbox/summary` | Badge count | 1 |
| `POST /v1/tags` (optional) | Explicit create — **skip**; tags via items | — |
| `GET /v1/items?view=today` | Today view | 2 |
| Google + streak routes | Already previewed in 08 | 3–4 |
| `GET /v1/insights/*` | Analytics | 5 |
| `POST /v1/ai/*` | Assistant | 6 |

### 1.4 Missing database fields (recommended)

**MVP patch to schema before first migrate:**

| Field | Model | Reason |
|-------|-------|--------|
| `retryCount Int` | ReminderOccurrence | Worker retries |
| `dismissedAt DateTime?` | ReminderInboxEntry | Dismiss ≠ read |
| *(optional)* `contentHash` | — | Skip MVP |

**Phase 2+:** `dueTime`, checklist JSON/table, `AnalyticsEvent`, Google/Streak tables (already designed).

### 1.5 UX inconsistencies

| Issue | Decision |
|-------|----------|
| Freeform vs masonry | **Default MVP = masonry/responsive grid.** Freeform = Phase 2 experiment (DnD risk). |
| Complete undated notes | Allowed; copy “Mark done” not “Complete commitment.” |
| Archive on mobile under More | OK; ensure Archive reachable in ≤2 taps. |
| Settings late in example plan | **Settings MVP slice early** (timezone + notifications required for reminders). |

### 1.6 Security issues

| Issue | Severity | Mitigation |
|-------|----------|------------|
| Cross-user item IDOR | S1 if missed | Always scope by `userId`; return 404 |
| Clerk webhook unsigned | S1 | Svix/Clerk signature verify |
| Note bodies in logs | S2 | Pino redact; 07 already says so — enforce in review |
| Push endpoint SSRF | S2 | https-only allowlist |
| Export abuse | S2 | Rate limit 5/h + auth |
| Account delete race | S2 | Transaction + Clerk webhook |
| Google tokens plaintext | S1 Phase 3 | App-level encryption |
| No step-up for delete account | S3 | Confirm string + typed email later |
| CORS misconfig | S1 | Exact origin allowlist |

### 1.7 Scalability issues

| Issue | When it hurts | Plan |
|-------|---------------|------|
| 30s poll worker | 100k users | BullMQ delayed jobs |
| ILIKE search | 500+ items/user | FTS / Typesense Phase 2+ |
| Unbounded overdue rows | Bad design | Rolling sweep (1–2 rows ahead) |
| Board render 500 DOM nodes | Heavy clients | Virtualize Phase 2 |
| Single region Postgres | Global latency | Accept MVP; read replica later |

### 1.8 Suggested doc improvements (non-code)

1. Patch all `dueAt` → `dueDate`.  
2. Add ADR-001: Board layout = masonry.  
3. Add ADR-002: Overdue rolling sweep.  
4. Add webhook + inbox summary to [08](./08-api-specification.md).  
5. Align reminder afternoon/high rules across 01/04/12.  
6. Clarify inbox vs occurrence state machine in 04.  
7. Lock font choice: Source Sans 3 + Fraunces (drop “or”).  

---

## 2. Dependency graph

### 2.1 System-level

```mermaid
flowchart TD
  subgraph Foundations
    Repo[Monorepo scaffold]
    DB[(Postgres + Prisma MVP)]
    MDL[MDL tokens + shadcn]
    Clerk[Clerk web + API JWT]
    Deploy[Vercel + Railway + CI]
  end

  subgraph CoreDomain
    Me[/v1/me upsert]
    Items[Item CRUD API]
    BoardUI[Board + ItemSheet]
    Tags[Tags via items]
    Search[Search q=]
  end

  subgraph Commitment
    Due[dueDate + status + remainingDays]
    Agenda[Agenda view]
    RemPolicy[ReminderService.rebuild]
  end

  subgraph Delivery
    Worker[Reminder worker]
    Inbox[Inbox API + UI]
    Push[Web Push]
    Settings[Settings TZ + notif]
  end

  subgraph Later
    Today[Today/Focus]
    Cal[Calendar grid]
    GCal[Google Calendar]
    Streak[Streaks]
    Insights[Analytics]
    AI[AI assistant]
  end

  Repo --> DB
  Repo --> MDL
  Repo --> Clerk
  Repo --> Deploy
  Clerk --> Me
  DB --> Me
  Me --> Items
  MDL --> BoardUI
  Items --> BoardUI
  Items --> Tags
  Items --> Search
  Items --> Due
  Due --> Agenda
  Due --> RemPolicy
  Settings --> RemPolicy
  Settings --> Push
  RemPolicy --> Worker
  Worker --> Inbox
  Worker --> Push
  BoardUI --> Inbox
  Due --> Today
  Due --> Cal
  Cal --> GCal
  Items --> Streak
  Worker --> Streak
  Items --> Insights
  Worker --> Insights
  Items --> AI
```

### 2.2 Feature dependency matrix

| Feature | Depends on |
|---------|------------|
| Board UI | Auth, MDL, Item CRUD |
| Tags/Search | Item CRUD |
| Commitment / DueChip | Item CRUD, date lib, user TZ |
| Agenda | Commitment |
| Reminder scheduling | Commitment, ReminderService, User TZ |
| Worker | Scheduling, DB claim indexes |
| Inbox | Worker (or manual seed), Item complete/snooze APIs |
| Web Push | PushSubscription table, VAPID, SW, Settings |
| Onboarding | Board UI, PATCH /me |
| Export/Delete | Auth, Item cascade |
| Today | Commitment + pinned query |
| Calendar | Commitment + Agenda patterns |
| Google sync | Calendar + OAuth + encryption |
| Streaks | Complete events + nightly job + StreakDay |
| Analytics | Event taxonomy + Insights UI |
| AI | Items + opt-in + provider |

### 2.3 Critical path (MVP)

```text
Prisma User/Item → Clerk /me → Item CRUD → dueDate rebuild →
Worker + Inbox → Push → Agenda/Settings polish → E2E/soak
```

Anything that blocks **dueDate → ReminderOccurrence → Inbox** blocks the mission.

---

## 3. Engineering phases (authoritative)

> Mapping: Product roadmap Phase 0–6 ([11](./11-development-roadmap.md)) is expanded into **build phases E0–E12** for tasking.  
> User’s sample “Phase 3 Tasks / Phase 4 Calendar / Phase 5 Reminders” is **incorrect for StickyFlow** — see §0.

| Eng phase | Name | Product map | Outcome |
|-----------|------|-------------|---------|
| **E0** | Project setup | Phase 0 | Repo, CI, envs boot |
| **E1** | Design system | Phase 0 | MDL + shadcn usable |
| **E2** | Auth + User | Phase 0 | Clerk ↔ User upsert |
| **E3** | Database MVP | Phase 0 | Migrated schema subset |
| **E4** | Sticky Notes CRUD | Phase 1 M1 | Board create/edit/delete/pin/archive/colors/tags/search |
| **E5** | Commitments (not “Tasks”) | Phase 1 M2 | dueDate, status, remainingDays, complete/reopen |
| **E6** | Agenda | Phase 1 M2 | Chronologic commitment view |
| **E7** | Reminder engine | Phase 1 M3 | Policy + rebuild + worker + overdue sweep |
| **E8** | Notifications | Phase 1 M4 | Inbox + Web Push + snooze |
| **E9** | Settings + account | Phase 1 | TZ, notif, export, delete, webhook |
| **E10** | Onboarding + MVP hardening | Phase 1 M5 | Seeds, a11y, soak, beta gate |
| **E11** | Depth (Today, filters, dark, shortcuts…) | Product Phase 2 | |
| **E12** | Calendar + Google | Product Phase 3 | |
| **E13** | Streaks | Product Phase 4 | |
| **E14** | Analytics | Product Phase 5 | |
| **E15** | AI assistant | Product Phase 6 | |

Checkbox inventory: [PROJECT_TASKS.md](./PROJECT_TASKS.md).

---

## 4. Phase-by-phase task breakdown

Each task: **Goal · Complexity · Dependencies · Files affected · Acceptance criteria**

Complexity: **E** Easy · **M** Medium · **H** Hard

---

### E0 — Project setup

#### E0.1 Monorepo scaffold
- **Goal:** `apps/web`, `apps/api`, `packages/shared` boot locally  
- **Complexity:** M  
- **Dependencies:** None  
- **Files:** `package.json`, `pnpm-workspace.yaml`, `apps/*`, `turbo.json` (or npm workspaces)  
- **AC:** `pnpm dev` runs web+api; TypeScript project refs work  

#### E0.2 Next.js 15 app
- **Goal:** App Router web shell  
- **Complexity:** E  
- **Dependencies:** E0.1  
- **Files:** `apps/web/**`  
- **AC:** `/` renders; TS strict  

#### E0.3 Express API skeleton
- **Goal:** HTTP server + `/health`  
- **Complexity:** E  
- **Dependencies:** E0.1  
- **Files:** `apps/api/src/{index,app}.ts`  
- **AC:** `GET /health` → `{ ok: true }`  

#### E0.4 Env + config
- **Goal:** Zod-validated env for api/web  
- **Complexity:** E  
- **Dependencies:** E0.2, E0.3  
- **Files:** `.env.example`, `apps/*/src/config/env.ts`  
- **AC:** Missing secrets fail fast in api  

#### E0.5 CI pipeline
- **Goal:** lint, typecheck, test on PR  
- **Complexity:** M  
- **Dependencies:** E0.1  
- **Files:** `.github/workflows/ci.yml`  
- **AC:** Green on empty tests  

#### E0.6 Deploy stubs
- **Goal:** Vercel project + Railway services defined  
- **Complexity:** M  
- **Dependencies:** E0.2, E0.3  
- **Files:** `railway.toml`, `vercel.json`, docs runbook  
- **AC:** Staging URLs respond health  

#### E0.7 Docker Postgres local
- **Goal:** Local DB via compose  
- **Complexity:** E  
- **Dependencies:** None  
- **Files:** `docker-compose.yml`  
- **AC:** Postgres up on 5432  

#### E0.8 Sentry stub
- **Goal:** Error SDK wired both apps  
- **Complexity:** E  
- **Dependencies:** E0.2, E0.3  
- **Files:** sentry configs  
- **AC:** Test error appears in project  

---

### E1 — Design system (MDL)

#### E1.1 Tailwind theme tokens
- **Goal:** Canvas/ink/accent/sticky colors in Tailwind  
- **Complexity:** E  
- **Dependencies:** E0.2  
- **Files:** `tailwind.config.ts`, `globals.css`  
- **AC:** Utility classes match [10](./10-ui-design-system.md)  

#### E1.2 Fonts
- **Goal:** Source Sans 3 + Fraunces via `next/font`  
- **Complexity:** E  
- **Dependencies:** E1.1  
- **Files:** `app/layout.tsx`  
- **AC:** No Inter default  

#### E1.3 shadcn init + skin
- **Goal:** Button, Dialog, Input, Dropdown skinned to MDL  
- **Complexity:** M  
- **Dependencies:** E1.1  
- **Files:** `components/ui/*`  
- **AC:** Primary button uses teal accent; no purple default  

#### E1.4 DoodleFrame
- **Goal:** 3 stroke presets component  
- **Complexity:** M  
- **Dependencies:** E1.1  
- **Files:** `components/md/doodle-frame.tsx`  
- **AC:** Renders on Safari/Chrome; focus ring visible  

#### E1.5 DueChip + motion presets
- **Goal:** Semantic chip + Framer tokens  
- **Complexity:** E  
- **Dependencies:** E1.1  
- **Files:** `components/md/due-chip.tsx`, `lib/motion.ts`  
- **AC:** Status labels match 10; reduced-motion safe  

#### E1.6 Empty state SVGs
- **Goal:** 3 simple illustrations  
- **Complexity:** E  
- **Dependencies:** E1.1  
- **Files:** `components/md/illustrations/*`  
- **AC:** Board/Agenda/Inbox empty use them  

---

### E2 — Authentication

#### E2.1 Clerk on Next.js
- **Goal:** Sign-in/up + middleware protect `/app`  
- **Complexity:** M  
- **Dependencies:** E0.2  
- **Files:** `middleware.ts`, `(auth)/*`, `app/app/layout.tsx`  
- **AC:** Unauth → sign-in; auth → `/app`  

#### E2.2 API JWT middleware
- **Goal:** Verify Clerk JWT; attach clerkId  
- **Complexity:** M  
- **Dependencies:** E0.3, E3.1 (User model)  
- **Files:** `middleware/auth.ts`  
- **AC:** No token → 401; bad token → 401  

#### E2.3 GET/PATCH `/v1/me`
- **Goal:** Upsert User; update prefs  
- **Complexity:** M  
- **Dependencies:** E2.2, E3.1  
- **Files:** `routes/me.ts`, `services/userService.ts`  
- **AC:** First call creates row; second returns same id  

#### E2.4 Web → API client with token
- **Goal:** `api()` helper + React Query provider  
- **Complexity:** M  
- **Dependencies:** E2.1, E2.3  
- **Files:** `lib/api-client.ts`, providers  
- **AC:** `/app` loads `/v1/me` successfully  

---

### E3 — Database MVP

#### E3.1 Prisma schema MVP subset
- **Goal:** User, Item, Tag, ItemTag, ReminderOccurrence (+ retryCount), ReminderInboxEntry (+ dismissedAt), PushSubscription  
- **Complexity:** M  
- **Dependencies:** E0.7  
- **Files:** `apps/api/prisma/schema.prisma`  
- **AC:** `prisma validate` passes; includes audit fixes §1.4  

#### E3.2 Initial migration
- **Goal:** Deploy migrate local + staging  
- **Complexity:** E  
- **Dependencies:** E3.1  
- **Files:** `prisma/migrations/*`  
- **AC:** Tables exist; indexes on `(status, fireAt)`  

#### E3.3 Prisma client + date lib
- **Goal:** Shared Luxon helpers for civil dates  
- **Complexity:** M  
- **Dependencies:** E3.1  
- **Files:** `lib/prisma.ts`, `lib/dates.ts`, `packages/shared`  
- **AC:** Unit tests U-DAY-01…05 pass  

---

### E4 — Sticky Notes CRUD

#### E4.1 Items API CRUD
- **Goal:** GET/POST/PATCH/DELETE `/v1/items`  
- **Complexity:** M  
- **Dependencies:** E2.3, E3.2  
- **Files:** `routes/items.ts`, `services/itemService.ts`  
- **AC:** I-ITEM-01, ownership 404, pagination  

#### E4.2 Tags sync on write
- **Goal:** Normalize tags; upsert Tag + ItemTag  
- **Complexity:** M  
- **Dependencies:** E4.1  
- **Files:** itemService tag helpers  
- **AC:** Duplicate tags collapsed; GET `/v1/tags` counts  

#### E4.3 Search
- **Goal:** `?q=` ILIKE title/description/tags  
- **Complexity:** E  
- **Dependencies:** E4.1  
- **Files:** items route  
- **AC:** I-SEARCH-01  

#### E4.4 StickyCard + Board page
- **Goal:** Masonry board lists items  
- **Complexity:** M  
- **Dependencies:** E1.*, E4.1, E2.4  
- **Files:** `app/app/page.tsx`, `components/board/*`  
- **AC:** Create appears without full reload (Query)  

#### E4.5 ItemSheet
- **Goal:** Edit all MVP fields; autosave debounce 400ms  
- **Complexity:** M  
- **Dependencies:** E4.4  
- **Files:** `components/item/item-sheet.tsx`  
- **AC:** Empty description blocked; pin/archive/delete work  

#### E4.6 Pin zone + archive view
- **Goal:** Pinned zone; `/app/archive`  
- **Complexity:** E  
- **Dependencies:** E4.5  
- **Files:** board + `archive/page.tsx`  
- **AC:** Archive hides from board; restore via sheet  

#### E4.7 App shell nav
- **Goal:** Top nav + mobile tabs  
- **Complexity:** M  
- **Dependencies:** E1, E2.1  
- **Files:** `components/layout/*`  
- **AC:** Board/Agenda/Inbox/Archive/Settings reachable  

---

### E5 — Commitments (“Tasks” without Task table)

#### E5.1 dueDate side effects hook
- **Goal:** On dueDate/priority/archive/complete → reminder rebuild/cancel stubs  
- **Complexity:** M  
- **Dependencies:** E4.1, E7.1 (can stub no-op first)  
- **Files:** itemService  
- **AC:** Clearing dueDate cancels scheduled rows  

#### E5.2 status + remainingDays serializer
- **Goal:** Compute per [04](./04-feature-specification.md)  
- **Complexity:** M  
- **Dependencies:** E3.3  
- **Files:** `lib/item-derived.ts`  
- **AC:** U-DAY tests green  

#### E5.3 Complete / reopen API + UI
- **Goal:** POST complete/reopen; optimistic UI  
- **Complexity:** M  
- **Dependencies:** E5.2, E4.5  
- **Files:** items routes, ItemSheet  
- **AC:** I-ITEM-04/05; DueChip → Done  

#### E5.4 DueChip on cards
- **Goal:** Show remaining/overdue  
- **Complexity:** E  
- **Dependencies:** E5.2, E1.5  
- **Files:** StickyCard  
- **AC:** E-03  

---

### E6 — Agenda

#### E6.1 `view=agenda` API
- **Goal:** Open commitments sorted  
- **Complexity:** E  
- **Dependencies:** E5.2  
- **Files:** items route  
- **AC:** I-AGENDA-01  

#### E6.2 Agenda page UI
- **Goal:** Overdue/Today/Tomorrow/Upcoming sections  
- **Complexity:** M  
- **Dependencies:** E6.1, E4.7  
- **Files:** `app/app/agenda/page.tsx`  
- **AC:** Same id as board card; empty state  

---

### E7 — Reminder engine

#### E7.1 ReminderService.rebuildForItem
- **Goal:** Policy table insert/cancel  
- **Complexity:** H  
- **Dependencies:** E3.3, E5.1  
- **Files:** `services/reminderService.ts`  
- **AC:** U-REM-01…05, 07, 08, 09, 10  

#### E7.2 Quiet-hours shift helper
- **Goal:** Apply user minute defaults  
- **Complexity:** M  
- **Dependencies:** E7.1  
- **Files:** `lib/dates.ts`  
- **AC:** U-REM-06  

#### E7.3 Reminder worker process
- **Goal:** Poll SKIP LOCKED; claim; inbox; push stub  
- **Complexity:** H  
- **Dependencies:** E7.1, E3.2  
- **Files:** `workers/reminderWorker.ts`, Railway worker start  
- **AC:** W-01, W-02, W-04  

#### E7.4 Overdue rolling sweep
- **Goal:** Ensure next overdue occurrence  
- **Complexity:** H  
- **Dependencies:** E7.1, E7.3  
- **Files:** reminderService + worker cron  
- **AC:** Overdue item gets daily fire without 365 rows  

#### E7.5 Retry + failure handling
- **Goal:** retryCount; failed terminal; inbox always  
- **Complexity:** M  
- **Dependencies:** E7.3  
- **Files:** worker, PushService  
- **AC:** W-05  

---

### E8 — Notifications (Inbox + Web Push)

#### E8.1 Inbox API
- **Goal:** list, read, read-all, summary, dismiss  
- **Complexity:** M  
- **Dependencies:** E7.3  
- **Files:** `routes/inbox.ts`  
- **AC:** Unread filter; summary count  

#### E8.2 Inbox UI
- **Goal:** `/app/inbox` + badge  
- **Complexity:** M  
- **Dependencies:** E8.1, E4.7  
- **Files:** `inbox/page.tsx`, nav badge  
- **AC:** E-09; complete from row  

#### E8.3 Snooze API + UI
- **Goal:** Presets 1h / later today / tomorrow 9  
- **Complexity:** M  
- **Dependencies:** E7.1, E8.2  
- **Files:** reminders route, inbox actions  
- **AC:** I-SNOOZE-01, E-10  

#### E8.4 Push subscriptions API
- **Goal:** POST/DELETE/test  
- **Complexity:** M  
- **Dependencies:** E3.1  
- **Files:** `routes/push.ts`, `pushService.ts`  
- **AC:** I-PUSH-01/02; https only  

#### E8.5 Service worker + client subscribe
- **Goal:** VAPID subscribe; notificationclick deep link  
- **Complexity:** H  
- **Dependencies:** E8.4, E2.1  
- **Files:** `public/sw.js`, `lib/push.ts`, Settings  
- **AC:** Staging real push on Chrome; denial still usable  

#### E8.6 Worker sends webpush
- **Goal:** Integrate PushService in worker  
- **Complexity:** M  
- **Dependencies:** E7.3, E8.4  
- **Files:** worker  
- **AC:** W-01 with real push; W-03 prunes 410  

---

### E9 — Settings + account

#### E9.1 Settings preferences UI
- **Goal:** TZ, week start, auto-archive, remindersEnabled  
- **Complexity:** M  
- **Dependencies:** E2.3, E4.7  
- **Files:** `settings/page.tsx`  
- **AC:** TZ change persists; triggers rebuild job (async OK)  

#### E9.2 Notifications settings
- **Goal:** Enable push + test  
- **Complexity:** E  
- **Dependencies:** E8.5  
- **Files:** settings notifications section  
- **AC:** Honest iOS/Safari limitations copy  

#### E9.3 Export + delete account
- **Goal:** GET export; DELETE account confirm  
- **Complexity:** M  
- **Dependencies:** E4.1  
- **Files:** `routes/export.ts`, settings danger zone  
- **AC:** I-EXPORT-01, I-ACCOUNT-01  

#### E9.4 Clerk webhook
- **Goal:** user.deleted cascades  
- **Complexity:** M  
- **Dependencies:** E3.2  
- **Files:** `routes/webhooks/clerk.ts`  
- **AC:** Signature required; user+items gone  

---

### E10 — Onboarding + MVP hardening

#### E10.1 First-run examples
- **Goal:** 3 dismissible client examples  
- **Complexity:** E  
- **Dependencies:** E4.4, E9.1  
- **Files:** board onboarding component  
- **AC:** Dismiss sets onboardingCompleted  

#### E10.2 Marketing stub page
- **Goal:** Minimal `/` with CTA  
- **Complexity:** E  
- **Dependencies:** E1  
- **Files:** `(marketing)/page.tsx`  
- **AC:** Lighthouse a11y ≥ 90 stretch  

#### E10.3 Playwright smoke
- **Goal:** E-01…E-06 automated  
- **Complexity:** M  
- **Dependencies:** E4–E6  
- **Files:** `e2e/*`  
- **AC:** CI green against staging/local  

#### E10.4 Reminder soak + load
- **Goal:** 48h soak; 200-item board  
- **Complexity:** M  
- **Dependencies:** E7–E8  
- **Files:** runbook notes  
- **AC:** Lag &lt; 5m; no Sev-1  

#### E10.5 Security + a11y pass
- **Goal:** Checklists 12 §9–10  
- **Complexity:** M  
- **Dependencies:** MVP features  
- **Files:** fixes as found  
- **AC:** Release gate §16  

---

### E11 — Product Phase 2 (depth)

| Task | Goal | Cx | Deps |
|------|------|----|------|
| E11.1 Today view API+UI | Overdue+today+pinned | M | E5, E6 |
| E11.2 Filters | color/tag/priority/due | M | E4.3 |
| E11.3 Quiet hours UI | Edit minutes | E | E7.2 |
| E11.4 Morning digest | Batch inbox/push | H | E7, E8 |
| E11.5 dueTime optional | Schema+policy | H | E7 |
| E11.6 Checklist in item | JSON or child rows | M | E4 |
| E11.7 Keyboard shortcuts | C, /, etc. | E | E4 |
| E11.8 Dark mode | Tokens | M | E1 |
| E11.9 Virtualized board | react-virtuoso | M | E4.4 |
| E11.10 trackAsCommitment | Undated track | M | E5, E7 |

---

### E12 — Calendar + Google (Product Phase 3)

| Task | Goal | Cx | Deps |
|------|------|----|------|
| E12.1 Month/week grid | In-app calendar | H | E6 |
| E12.2 Drag reschedule | PATCH dueDate | M | E12.1, E7 |
| E12.3 Google OAuth | Encrypt tokens | H | E9 |
| E12.4 Outbound sync | Event map | H | E12.3 |
| E12.5 Settings connection UX | Errors/reconnect | M | E12.3 |

---

### E13 — Streaks (Product Phase 4)

| Task | Goal | Cx | Deps |
|------|------|----|------|
| E13.1 StreakDay migration | Table | E | E3 pattern |
| E13.2 Nightly streak job | TZ EOD | H | E5 complete |
| E13.3 Rest day API/UI | Neutral rules | M | E13.2 |
| E13.4 Streak display | Header subtle | E | E13.2 |
| E13.5 Guardrail metrics | Guilt tracking | M | analytics light |

---

### E14 — Analytics (Product Phase 5)

| Task | Goal | Cx | Deps |
|------|------|----|------|
| E14.1 Event taxonomy | WCCR events | M | E5, E8 |
| E14.2 Insights API | Aggregates | M | E14.1 |
| E14.3 Insights UI | Charts | M | E14.2 |
| E14.4 CSV export | Enrich export | E | E9.3 |

---

### E15 — AI (Product Phase 6)

| Task | Goal | Cx | Deps |
|------|------|----|------|
| E15.1 Opt-in + provider | Privacy | M | E9 |
| E15.2 Date parse suggest | Confirm UX | M | E5 |
| E15.3 Breakdown suggest | Checklist | M | E11.6 |
| E15.4 What now ranker | Existing only | H | E5, E6 |

---

## 5. Exact implementation order (sequence)

Build **strictly** in this order unless two tasks are parallelizable as noted.

```text
1.  E0.1 → E0.7 → E0.2 + E0.3 (parallel) → E0.4 → E0.5 → E0.6 → E0.8
2.  E3.1 → E3.2 → E3.3
3.  E1.1 → E1.2 → E1.3 → E1.4 → E1.5 → E1.6
4.  E2.1 → E2.2 → E2.3 → E2.4
5.  E4.1 → E4.2 → E4.3 → E4.7 → E4.4 → E4.5 → E4.6
6.  E5.2 → E5.3 → E5.4 → E5.1 (wire to stubs)
7.  E7.1 → E7.2 → E5.1 (full wire) → E7.3 → E7.4 → E7.5
8.  E6.1 → E6.2
9.  E8.1 → E8.2 → E8.3 → E8.4 → E8.5 → E8.6
10. E9.1 → E9.2 → E9.3 → E9.4
11. E10.1 → E10.2 → E10.3 → E10.4 → E10.5
12. STOP — closed beta / approval for E11+
13. E11.* (priority: Today → quiet hours UI → filters → shortcuts → dark → rest)
14. E12.* (grid before Google)
15. E13.* → E14.* → E15.*
```

**Parallel opportunities**

- After E0.1: web and api skeletons parallel  
- After E2.4: MDL polish (E1.4–1.6) can overlap Item API (E4.1)  
- Agenda UI (E6.2) can start once E5.2 exists even if worker incomplete  
- Inbox UI can proceed with worker writing inbox before Push works  

**Hard gates**

| Gate | Requirement |
|------|-------------|
| G1 | No Board UI until `/v1/me` works |
| G2 | No Push until Inbox works without Push |
| G3 | No Calendar until Reminder soak passes |
| G4 | No Streaks until complete/reopen stable |
| G5 | No AI until Insights event privacy review |

---

## 6. Team recommendations

| If team size | Mode |
|--------------|------|
| 1 full-stack | Follow sequence literally; masonry only |
| 2 (FE+BE) | BE leads E3→E7; FE leads E1→E4 UI; integrate daily on Item contract |
| 3 | + Design owns MDL/illustrations 1 week ahead |

**Definition of Ready for first code commit**

1. This plan + [PROJECT_TASKS.md](./PROJECT_TASKS.md) approved  
2. C1–C12 decisions accepted  
3. Board layout = masonry locked  
4. Postgres host chosen (Supabase **or** Railway)  
5. Clerk + Vercel + Railway accounts ready  

---

## 7. Out of scope reminders

Do **not** schedule in MVP tasks:

- Separate Task model  
- Drawing on stickies  
- Team workspaces  
- E2E encryption  
- Native mobile apps  
- Google Calendar  
- Streaks / Analytics / AI  

---

## 8. Document control

| Artifact | Purpose |
|----------|---------|
| This file | Order, deps, audit, phased task specs |
| [PROJECT_TASKS.md](./PROJECT_TASKS.md) | Checkbox execution backlog |
| [11-development-roadmap.md](./11-development-roadmap.md) | Product-level phases |
| [12-testing-checklist.md](./12-testing-checklist.md) | QA gates |

**Next step after approval:** Begin E0.1 only — still wait for explicit “start implementation” from founder if required by [01](./01-product-requirements.md).
