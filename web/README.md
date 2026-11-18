# LiftLog (Next.js)

Replacement for the legacy Express/SQLite app (kept untouched in `../backend` and `../frontend` during migration).

**Status: migration milestone 1**: scaffold, PostgreSQL schema, email/password authentication, per-user data isolation, legacy importer. Workout logging UI is the next milestone.

## Stack
Next.js (App Router) · TypeScript (strict) · Tailwind CSS v4 · shadcn/ui-style primitives · Prisma 7 + PostgreSQL (Neon) · Better Auth · Zod + React Hook Form. Recharts, Motion, GSAP and Zustand are added when their features land.

## Setup
```bash
cd web
cp .env.example .env        # fill in values (never commit .env)
npm install                 # also runs `prisma generate`
npm run db:migrate          # creates tables in your DATABASE (dev)
npm run dev
```

### Environment variables
| Name | Purpose |
|---|---|
| `DATABASE_URL` | Neon **pooled** connection string (runtime) |
| `DIRECT_URL` | Neon **direct** connection string (migrations only) |
| `BETTER_AUTH_SECRET` | ≥32 chars: `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | Public app URL (falls back to `https://$VERCEL_URL` on Vercel) |
| `BETTER_AUTH_TRUSTED_ORIGINS` | Optional extra allowed origins |

Server env is validated with Zod at startup (`src/server/env.ts`); errors name variables, never values.

## Scripts
`dev` · `build` · `start` · `lint` · `typecheck` · `test` · `db:migrate` · `db:deploy` (production migrations) · `db:status` · `import:legacy`

## Database & migrations
Schema: `prisma/schema.prisma`. SQL migrations: `prisma/migrations/`. The second migration holds CHECK constraints, a partial unique index and deferrable FKs that Prisma's schema language cannot express (weights ≥ 0, reps 1–1000, one global exercise per name, safe account-deletion cascade).

**First thing to run on your machine** (these migrations were hand-written and verified against PostgreSQL, but the Prisma schema engine could not run in the authoring sandbox):
```bash
npm run db:migrate    # against a fresh/dev Neon branch; Prisma reports any drift between migrations and schema.prisma
```
If Prisma proposes a new migration, review the diff and commit it.

## Security model
- `requireUser()` (`src/server/session.ts`) is the authorization gate; `src/proxy.ts` is only an optimistic redirect.
- Every query is scoped by the authenticated user's id; client-supplied ids are never trusted alone.
- Sessions are validated against the database on every request (sign-out/revocation is immediate; no cookie cache).
- Passwords: scrypt hashes via Better Auth; 10–128 chars. Sign-up input cannot set `goalDaysPerWeek`/`emailVerified`/`id`; `weightUnit`/`timezone` are coerced server-side.
- Auth endpoints are rate-limited (stored in PostgreSQL so limits hold across serverless instances); origin/CSRF checks are on.
- Security headers set in `next.config.ts`. A nonce-based CSP is a tracked follow-up.

## Testing
```bash
npm test                                                       # unit tests
TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/liftlog_test npm test   # + PostgreSQL integration tests
```
The integration suite **drops and recreates the `public` schema** and refuses to run unless the database name ends in `_test`.

## Deploy (Vercel)
Set the project **Root Directory** to `web`, add the env vars above, and run `npm run db:deploy` against production before the first release. The legacy Netlify/Render deployments are unaffected.
