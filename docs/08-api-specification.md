# 08 — API Specification

**Product:** StickyFlow  
**Version:** 1.0  
**Base URL:** `https://api.stickyflow.app` (prod) · `http://localhost:4000` (dev)  
**Auth:** `Authorization: Bearer <Clerk JWT>`  
**Related:** [06-database-schema](./06-database-schema.md) · [07-backend-architecture](./07-backend-architecture.md) · [03-user-flows](./03-user-flows.md)

---

## 1. Conventions

| Topic | Rule |
|-------|------|
| Format | JSON UTF-8 |
| Dates | `dueDate`: `YYYY-MM-DD`; timestamps: ISO-8601 UTC |
| IDs | `cuid` strings |
| Pagination | `?cursor=&limit=` (default 50, max 100) |
| Errors | `{ "error": { "code": "ITEM_NOT_FOUND", "message": "..." } }` |
| Success | Direct resource or `{ data, nextCursor }` |

### Common HTTP codes

| Code | Meaning |
|------|---------|
| 200 | OK |
| 201 | Created |
| 204 | No content |
| 400 | Validation |
| 401 | Unauthenticated |
| 403 | Forbidden |
| 404 | Not found |
| 409 | Conflict |
| 429 | Rate limited |
| 500 | Server error |

---

## 2. Shared schemas

### User

```json
{
  "id": "clx...",
  "email": "maya@example.com",
  "displayName": "Maya",
  "timezone": "Asia/Kolkata",
  "weekStartsOn": "monday",
  "autoArchiveOnComplete": false,
  "onboardingCompleted": true,
  "remindersEnabled": true,
  "quietHoursStartMinute": 1320,
  "quietHoursEndMinute": 480,
  "createdAt": "2026-07-24T12:00:00.000Z"
}
```

### Item

```json
{
  "id": "clxitem...",
  "title": "Send invoice",
  "description": "River Co — July retainer",
  "color": "butter",
  "priority": "high",
  "dueDate": "2026-08-01",
  "pinned": false,
  "archived": false,
  "completedAt": null,
  "positionX": 120,
  "positionY": 80,
  "rank": 0,
  "tags": ["client", "billing"],
  "remainingDays": 8,
  "status": "upcoming",
  "createdAt": "2026-07-24T12:00:00.000Z",
  "updatedAt": "2026-07-24T12:00:00.000Z"
}
```

`remainingDays` and `status` are **computed** server-side (see [04](./04-feature-specification.md)).

### ReminderInboxEntry

```json
{
  "id": "clxin...",
  "itemId": "clxitem...",
  "occurrenceId": "clxocc...",
  "title": "8 days left · Send invoice",
  "body": "Due Aug 1",
  "readAt": null,
  "createdAt": "2026-07-24T03:30:00.000Z",
  "item": { "id": "clxitem...", "color": "butter", "dueDate": "2026-08-01" }
}
```

---

## 3. Endpoints — Health

### `GET /health`

Public. No auth.

```json
{ "ok": true, "db": true, "version": "1.0.0" }
```

---

## 4. Endpoints — Me

### `GET /v1/me`

Upserts user from Clerk claims; returns profile.

### `PATCH /v1/me`

Body (all optional):

```json
{
  "timezone": "Asia/Kolkata",
  "weekStartsOn": "monday",
  "autoArchiveOnComplete": true,
  "onboardingCompleted": true,
  "remindersEnabled": true,
  "quietHoursStartMinute": 1320,
  "quietHoursEndMinute": 480,
  "displayName": "Maya"
}
```

**Side effect:** Timezone change may rebuild future reminder `fireAt` for open commitments (async acceptable).

---

## 5. Endpoints — Items

### `GET /v1/items`

Query:

| Param | Description |
|-------|-------------|
| `view` | `board` (default) · `agenda` · `archive` |
| `q` | Search string |
| `tag` | Tag name filter |
| `cursor` | Pagination |
| `limit` | 1–100 |

**board:** `archived=false`, include completed unless `?hideCompleted=true`.  
**agenda:** commitments open, sorted by dueDate.  
**archive:** `archived=true`.

Response:

```json
{ "data": [ /* Item */ ], "nextCursor": null }
```

### `POST /v1/items`

```json
{
  "title": "Optional",
  "description": "Required text",
  "color": "sage",
  "priority": "medium",
  "dueDate": "2026-08-01",
  "tags": ["client"],
  "pinned": false,
  "positionX": 0,
  "positionY": 0
}
```

**201** + Item. Schedules reminders if `dueDate` set.

**400** if description empty.

### `GET /v1/items/:id`

**200** Item or **404**.

### `PATCH /v1/items/:id`

Partial update. Same fields as create + `archived`, `rank`.

Due date / archive / priority changes trigger reminder rebuild/cancel.

### `DELETE /v1/items/:id`

**204**. Cascades reminders & inbox.

### `POST /v1/items/:id/complete`

```json
{ "autoArchive": null }
```

`autoArchive` null → use user preference.

**200** Item.

### `POST /v1/items/:id/reopen`

**200** Item; rebuilds reminders if needed.

---

## 6. Endpoints — Tags

### `GET /v1/tags`

```json
{ "data": [{ "id": "...", "name": "client", "count": 4 }] }
```

### `DELETE /v1/tags/:id`

Removes tag; unlinks from items (ItemTag cascade). Does not delete items.

---

## 7. Endpoints — Inbox & reminders

### `GET /v1/inbox`

Query: `unreadOnly=true|false`, cursor, limit.

### `POST /v1/inbox/:id/read`

Marks read. **204**.

### `POST /v1/inbox/read-all`

**204**.

### `POST /v1/reminders/:occurrenceId/snooze`

```json
{ "preset": "1h" }
```

Presets: `1h` | `later_today` | `tomorrow_9`.

Or `{ "until": "2026-07-25T09:00:00.000Z" }`.

**200** `{ "occurrenceId": "...", "fireAt": "..." }`.

### `POST /v1/reminders/:occurrenceId/dismiss`

Marks occurrence cancelled / inbox read. Does not complete item.

---

## 8. Endpoints — Push

### `POST /v1/push-subscriptions`

```json
{
  "endpoint": "https://fcm.googleapis.com/...",
  "keys": { "p256dh": "...", "auth": "..." },
  "userAgent": "Mozilla/5.0..."
}
```

**201** or **200** upsert by endpoint.

### `DELETE /v1/push-subscriptions`

```json
{ "endpoint": "https://..." }
```

**204**.

### `POST /v1/push-subscriptions/test`

Sends test push to caller’s subscriptions. **200** `{ "sent": 1 }`.

---

## 9. Endpoints — Export / account

### `GET /v1/export`

Returns JSON document:

```json
{
  "exportedAt": "...",
  "user": { },
  "items": [ ],
  "tags": [ ]
}
```

Rate limited: 5/hour.

### `DELETE /v1/account`

Dangerous. Requires body `{ "confirm": "DELETE" }`.  
Deletes app data; client should also delete Clerk user via Clerk SDK/API.

---

## 10. Phase 3 — Google Calendar (preview)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/v1/integrations/google/start` | OAuth redirect URL |
| GET | `/v1/integrations/google/callback` | OAuth callback |
| GET | `/v1/integrations/google` | Connection status |
| DELETE | `/v1/integrations/google` | Disconnect |
| POST | `/v1/integrations/google/sync` | Force sync |

---

## 11. Phase 4 — Streaks (preview)

| Method | Path |
|--------|------|
| GET | `/v1/streaks` → `{ current, longest, completionRate28d, consistencyScore }` |
| POST | `/v1/streaks/rest-day` → `{ date }` |

---

## 12. Error codes catalog

| Code | When |
|------|------|
| `VALIDATION_ERROR` | Zod failure |
| `UNAUTHORIZED` | Bad/missing JWT |
| `ITEM_NOT_FOUND` | Wrong id or other user |
| `OCCURRENCE_NOT_FOUND` | Snooze target missing |
| `PUSH_UNSUPPORTED` | Invalid subscription payload |
| `RATE_LIMITED` | Too many requests |
| `ACCOUNT_CONFIRM_REQUIRED` | Delete without confirm |

---

## 13. Idempotency

| Action | Idempotency |
|--------|-------------|
| Complete | Second call returns already-completed item |
| Snooze | New occurrence each time; prior snoozed |
| Push upsert | Unique endpoint |
| Rebuild reminders | Deterministic cancel+insert in transaction |

Optional header `Idempotency-Key` for `POST /items` in Phase 2.

---

## 14. Example: create dated sticky

**Request**

```http
POST /v1/items HTTP/1.1
Authorization: Bearer eyJ...
Content-Type: application/json

{
  "description": "Send invoice — River Co",
  "title": "Invoice",
  "dueDate": "2026-08-01",
  "priority": "high",
  "color": "butter",
  "tags": ["client"]
}
```

**Response 201** — Item with `status`, `remainingDays`, tags expanded.

**Server side effects** — ReminderOccurrence rows inserted per policy.

---

## 15. Versioning

- Prefix `/v1`.  
- Breaking changes → `/v2`.  
- Additive fields are non-breaking.

---

## 16. Assumptions

- Clerk session tokens accepted; long-lived API keys not offered in MVP.  
- All times compared in UTC on server; civil logic uses user TZ.  
- File uploads not supported (no multipart).
