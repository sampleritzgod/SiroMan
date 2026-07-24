# SiroMan

Commitment-keeping sticky notes (MVP in progress).

Working product concept was documented as “StickyFlow”; the product name is **SiroMan**.

## Stack

- `apps/web` — Next.js 15, Clerk, Tailwind (MDL)
- `apps/api` — Express, Prisma, PostgreSQL (`siroman`)
- `packages/shared` — shared Zod schemas + date helpers

## Phase 1 (current)

Project setup · Design system · Authentication · Database

## Local development

### 1. Start Postgres

```bash
docker compose up -d
```

Database: `siroman` · User: `siroman` · Password: `siroman`

### 2. Environment

```bash
cp .env.example apps/api/.env
# copy the NEXT_PUBLIC_* and CLERK_* lines into apps/web/.env.local
```

Set real Clerk keys in both files.

### 3. Database migrate

```bash
pnpm db:generate
pnpm --filter @stickyflow/api exec prisma migrate deploy
```

### 4. Run

```bash
pnpm --filter @stickyflow/shared build
pnpm dev
```

- Web: http://localhost:3000  
- API health: http://localhost:4000/health  

## Docs

See `/docs` for PRD, architecture, and task list.
