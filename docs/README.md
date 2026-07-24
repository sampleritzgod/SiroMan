# StickyFlow — Documentation Index

**Status:** Complete for pre-implementation review  
**Last updated:** 2026-07-24  

Do **not** start application coding until this set is explicitly approved.

| # | Document | Purpose |
|---|----------|---------|
| 01 | [Product Requirements](./01-product-requirements.md) | Vision, scope, metrics, risks |
| 02 | [User Personas](./02-user-personas.md) | Beachhead + secondary users |
| 03 | [User Flows](./03-user-flows.md) | End-to-end journeys + Mermaid |
| 04 | [Feature Specification](./04-feature-specification.md) | Detailed behavior + edge cases |
| 05 | [Information Architecture](./05-information-architecture.md) | Nav, URLs, mental model |
| 06 | [Database Schema](./06-database-schema.md) | Prisma/ER, invariants |
| 07 | [Backend Architecture](./07-backend-architecture.md) | Express, workers, deploy |
| 08 | [API Specification](./08-api-specification.md) | REST contracts |
| 09 | [Frontend Architecture](./09-frontend-architecture.md) | Next.js 15 structure |
| 10 | [UI Design System](./10-ui-design-system.md) | Modern Doodle Language |
| 11 | [Development Roadmap](./11-development-roadmap.md) | Phased delivery |
| 12 | [Testing Checklist](./12-testing-checklist.md) | QA gates |
| — | [IMPLEMENTATION_ORDER.md](./IMPLEMENTATION_ORDER.md) | Architect plan, audit, deps, build order |
| — | [PROJECT_TASKS.md](./PROJECT_TASKS.md) | Granular checkbox backlog |

## Critical decisions embedded in these docs

1. **Unified `Item` model** — due dates do not create a separate Task row.  
2. **Reminder engine is MVP** — calendar grid/Google sync are Phase 3.  
3. **Stack:** Next.js 15 + Express + Postgres/Prisma + Clerk + Web Push + (later) Google Calendar.  
4. **Beachhead persona:** Solo Operator (Maya).

## Implementation planning

Before writing application code, review:

1. [IMPLEMENTATION_ORDER.md](./IMPLEMENTATION_ORDER.md) — consistency audit + exact build sequence  
2. [PROJECT_TASKS.md](./PROJECT_TASKS.md) — executable task checkboxes  

## Approval

Reply with approval (and any doc revisions) before Phase 0 scaffolding begins.
