# 04 — Feature Specification

**Product:** StickyFlow  
**Version:** 1.0  
**Last updated:** 2026-07-24  
**Related:** [01-product-requirements](./01-product-requirements.md) · [03-user-flows](./03-user-flows.md) · [06-database-schema](./06-database-schema.md) · [08-api-specification](./08-api-specification.md)

---

## 1. Feature inventory by phase

| Feature area | MVP | P2 | P3 | P4 | P5 | P6 |
|--------------|-----|----|----|----|----|----|
| Sticky CRUD | ✓ | | | | | |
| Tags & search | ✓ | filters++ | | | | |
| Commitments / remaining days | ✓ | | | | | |
| Agenda | ✓ | | | | | |
| Reminder engine + Web Push | ✓ | quiet hours, digest | | | | |
| Today / Focus | | ✓ | | | | |
| Calendar grid | | | ✓ | | | |
| Google Calendar | | | ✓ | | | |
| Streaks | | | | ✓ | | |
| Analytics | | | | | ✓ | |
| AI assistant | | | | | | ✓ |

---

## 2. Sticky notes

### 2.1 Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| title | string ≤ 120 | No | |
| description | string ≤ 10_000 | Yes* | *Or title if we allow title-only — **MVP: description required** |
| color | enum | Yes | Default `butter` |
| priority | enum `none\|low\|medium\|high` | Yes | Default `none` |
| dueAt | civil date or timestamptz | No | MVP: **date-only** in user TZ |
| tags | string[] ≤ 20 tags, each ≤ 40 chars | No | Normalized lowercase trim |
| pinned | boolean | Yes | Default false |
| archived | boolean | Yes | Default false |
| completedAt | timestamptz | No | |
| positionX, positionY | float | No | If freeform board |
| rank | int | No | If sorted layout |

### 2.2 Operations

| Op | Rules |
|----|-------|
| Create | Defaults applied; returns item |
| Update | Partial PATCH; dueAt changes reschedule reminders |
| Delete | Confirm; cascade reminders |
| Pin | Max practical ~50 pinned; soft warn above 20 |
| Archive | Sets archived; **cancels** future reminders |
| Restore | Clears archived; **reschedules** if dueAt set and not completed |
| Complete | Sets completedAt; cancels reminders |
| Reopen | Clears completedAt; reschedules if needed |

### 2.3 Colors (MDL)

`butter` · `mist` · `sage` · `blush` · `slate` · `lavender` · `peach` · `ink`  
Exactly 8. No custom hex in MVP.

### 2.4 Edge cases

- Tags with `#` stripped; duplicates collapsed.  
- Search: case-insensitive ILIKE on title, description, tag names.  
- Pin + archive: archived items cannot stay in pinned zone (unpin on archive).

---

## 3. Commitment model

### 3.1 Definition

```text
isCommitment = (dueAt != null) OR (trackAsCommitment == true)
```

MVP ships `dueAt` path only. `trackAsCommitment` is Phase 2 for undated important work.

### 3.2 Derived status

| Status | Condition |
|--------|-----------|
| `note` | not commitment |
| `upcoming` | dueAt &gt; today+1 |
| `tomorrow` | dueAt == tomorrow |
| `today` | dueAt == today |
| `overdue` | dueAt &lt; today && !completed |
| `done` | completedAt != null |

**Remaining days:** `dueCivilDate - todayCivilDate` in `user.timezone` (integer; negative = overdue magnitude).

### 3.3 Zero duplication rule

Agenda, Calendar, Reminder targets, and Board cards share the same `Item.id`. UI may label “Task” in copy; storage remains `Item`.

---

## 4. Agenda view

- Lists non-archived commitments sorted by `dueAt` ASC, then priority DESC.  
- Sections: Overdue · Today · Tomorrow · Upcoming (grouped by date).  
- Completed in last 7 days optional collapsible (Phase 2).  
- Click opens same item editor as Board.

---

## 5. Reminder engine

### 5.1 Policy table (MVP default)

Given commitment due on civil date `D` in user timezone:

| Policy key | Fire at (local) | Condition |
|------------|-----------------|-----------|
| `d_minus_7` | D−7 09:00 | D−7 ≥ created date; else skip |
| `d_minus_5` | D−5 09:00 | same |
| `d_minus_1` | D−1 09:00 | always if D−1 ≥ today at schedule time |
| `d_minus_1_evening` | D−1 18:00 | priority ∈ {high} |
| `d_day` | D 09:00 | |
| `d_day_afternoon` | D 15:00 | still not completed |
| `overdue_daily` | each overdue day 09:00 | for 7 days |
| `overdue_weekly` | weekly 09:00 | after daily window |

### 5.2 Channels

| Channel | MVP |
|---------|-----|
| In-app inbox | Required |
| Web Push | Required (opt-in) |
| Email | Phase 2+ |
| SMS | Out of scope |

### 5.3 Inbox item states

`pending` · `sent` · `read` · `acted` · `snoozed` · `cancelled`

### 5.4 Snooze

Presets create a one-off `ReminderOccurrence` with `policyKey=snooze` and cancel/ defer the current one.

### 5.5 Intelligence roadmap

| Level | Behavior |
|-------|----------|
| L0 MVP | Fixed policy table |
| L1 | Priority & quiet hours modulate |
| L2 | Digest morning brief |
| L3 | Timing learned from open/complete rates (privacy-safe aggregates) |

### 5.6 Edge cases

| Case | Behavior |
|------|----------|
| Due in 2 days at creation | Skip D−7 and D−5 |
| Complete between scheduled and send | Worker no-ops; marks cancelled |
| Archive | Cancel all future |
| User disables push mid-flight | Inbox still fills |
| Clock skew / DST | Use timezone lib (e.g. Luxon) on worker |

---

## 6. Notifications (Web Push)

### 6.1 Payload

```json
{
  "title": "2 days left · Send invoice",
  "body": "River Co — due Friday",
  "data": { "itemId": "cuid", "occurrenceId": "cuid" }
}
```

### 6.2 Subscription lifecycle

Register · refresh · delete on sign-out · prune 410 Gone endpoints.

### 6.3 Limitations (documented in Settings)

- Requires HTTPS.  
- iOS Safari needs PWA install constraints — document honestly.  
- Permission denial is valid; product must still work.

---

## 7. Tags & search

- Autocomplete from user’s existing tags.  
- Filter chips Phase 2: color, tag, priority, due window.  
- MVP search box only.

---

## 8. Today / Focus (Phase 2)

Shows: overdue + due today + pinned open items.  
Single purpose: act now. No analytics widgets.

---

## 9. Calendar (Phase 3)

### 9.1 In-app grid

- Month + week.  
- Dots/cards per due date.  
- Drag to reschedule → PATCH dueAt → reschedule reminders.

### 9.2 Google Calendar API

| Direction | MVP-of-Phase-3 |
|-----------|----------------|
| StickyFlow → Google | Create/update all-day events for commitments |
| Google → StickyFlow | Optional later; conflict-prone |

**Mapping:** `Item.id` stored in event extended properties.  
**Disconnect:** Stop sync; leave events or delete — user choice.

**Edge cases:** Token revoke → banner reconnect. Event deleted in Google → Soft flag, don’t delete StickyFlow item.

---

## 10. Focus streak (Phase 4)

### 10.1 Rules

| Rule | Definition |
|------|------------|
| Planned | Commitments with dueAt = that civil day OR user marked “plan for today” (future) |
| Success | completedCount ≥ plannedCount (strict v1) |
| Neutral | plannedCount = 0 |
| Rest day | User-flagged; no break |
| Current streak | Consecutive success days ignoring neutrals/rest |
| Longest streak | Max historical |
| Completion % | Rolling 28-day completed/planned |
| Consistency score | Weighted completion with overdue penalty (formula in analytics doc later) |

**Never** increment on login/open.

### 10.2 UX

Subtle checkmark motion; no confetti storms. Optional weekly summary.

---

## 11. Analytics (Phase 5)

Personal-only charts:

- WCCR trend  
- Overdue rate  
- Completions by tag/color  
- Reminder → complete funnel  

Export CSV. No team dashboards.

---

## 12. AI assistant (Phase 6)

| Capability | Rule |
|------------|------|
| Parse natural dates in text | Suggest dueAt; user confirms |
| Break down sticky | Suggest checklist; user confirms |
| “What should I do now?” | Rank existing open commitments only |
| Autopilot mass-create | **Forbidden** |

Privacy: note content sent to model provider only with explicit opt-in.

---

## 13. Settings (MVP)

- Timezone (IANA)  
- Week start (Sun/Mon)  
- Notification enable + test  
- Auto-archive on complete (bool)  
- Quiet hours (Phase 2; defaults stored)  
- Danger: export JSON, delete account  

---

## 14. Permissions & privacy features

| Feature | Spec |
|---------|------|
| Private by default | All items `userId`-scoped |
| Sharing | None in v1 |
| Export | JSON of items + tags |
| Delete account | Cascade all user data within 30 days SLA; immediate soft-disable |

---

## 15. Feature acceptance criteria (MVP sample)

**AC-REMINDER-01:** Given an item due in 10 days, when created, then occurrences exist for d_minus_7, d_minus_5, d_minus_1, d_day (and priority extras).  

**AC-DEDUP-01:** Given dueAt set, when user opens Agenda, then the same `id` as Board card is shown — no second record.  

**AC-PUSH-01:** Given valid subscription, when occurrence fires, then push delivered OR inbox row created within 5 minutes.  

Full test mapping: [12-testing-checklist](./12-testing-checklist.md).
