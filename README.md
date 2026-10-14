# College Club Management System

Monorepo scaffold for the Identity, Clubs and Membership foundation. Each future feature is intended to land as one vertical slice: migration, RLS, database tests, backend/Edge Function logic where needed, and the React UI.

## Structure

```text
supabase/
  config.toml
  migrations/                 # timestamp_m1_* migrations owned by this module
  tests/                      # pgTAP tests
  functions/notifications/    # Deno Edge Function skeleton
packages/shared/              # shared Database type and typed RPC wrappers
apps/web/                     # React + TypeScript + Vite + Tailwind shell
```

The events and venue/finance modules are deliberately not implemented. Their web extension points are `/events` and `/bookings`; the volunteer tables keep `event_id uuid` without a foreign key until the events migration exists.

## Prerequisites

- Node.js 20+
- npm 10+
- Docker Desktop (for the local Supabase stack)
- Supabase CLI (`supabase --version`)

Install the Supabase CLI using the official method for your operating system: https://supabase.com/docs/guides/cli.

## Local setup with Docker

From the repository root in PowerShell:

```powershell
npm install
Copy-Item .env.example apps/web/.env.local
supabase start
supabase status
supabase db reset
```

Copy the local API URL and `anon key` printed by `supabase status` into `apps/web/.env.local`:

```dotenv
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=the-local-anon-key-from-supabase-status
VITE_DEFAULT_CLUB_ID=20000000-0000-0000-0000-000000000001
```

Then validate and run the web app:

```powershell
npm run typecheck
npm run lint
npm run format:check
npm run db:test
npm run build
npm run dev
```

Open http://localhost:5173. The seed accounts are development-only and all use the password `Test1234!`; never reuse or deploy these credentials. Authentication and profile pages are available at `/login`, `/signup`, `/forgot-password`, `/reset-password`, and `/profile`. To invoke the notification function locally, copy `supabase/functions/.env.example` to `supabase/functions/.env`, fill in the local service-role key from `supabase status`, and run:

```powershell
supabase functions serve notifications --env-file supabase/functions/.env
```

Never put the service-role key in `apps/web`, a committed file, or a `VITE_` variable.

## Hosted Supabase project

Create a project in the Supabase dashboard, then from the repository root:

```powershell
npm install
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
supabase functions deploy notifications
supabase secrets set SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
```

Create `apps/web/.env.local` using the hosted Project URL and anon key from Project Settings → API, then run `npm run dev` or build/deploy the Vite output. The local seed is not automatically suitable for production; create real users through Supabase Auth and assign roles through an admin-only workflow.

## Useful commands

```powershell
npm run db:reset       # recreate local DB, apply migrations and seed
npm run db:test        # run pgTAP tests; requires Docker and local Supabase
npm run db:types       # refresh shared Database types from local schema
npm run typecheck
npm run build
npm run format
```

`npm run db:test` uses the Supabase CLI test runner and therefore requires Docker. If you are working only against a hosted Supabase project, first ensure the migrations and development seed are applied, then open each matching file in `supabase/tests/editor/` in the Supabase SQL Editor and run the entire file. Each editor script collects the TAP output into one result set and wraps all writes in `begin`/`rollback`, so it leaves no test data behind. The hosted project must have the `pgtap` extension enabled.

## Security decisions in this scaffold

- Every requested public table has RLS enabled and starts closed to `anon`/`authenticated` unless a policy grants access.
- Role assignments may have `club_id = null` for global roles or a concrete club for club-scoped roles.
- `global_admin` is recognized by `has_permission` and passes permission checks across clubs.
- Shared helper functions are `security definer` with a fixed `search_path`; callers receive only execute privileges.
- `log_audit` and `send_notification` are the atomic insertion boundaries for their respective tables.
- The signup trigger creates a profile from `raw_user_meta_data.full_name` and falls back to the email local-part.

## Ordered vertical-slice roadmap

1. Authentication and profiles: auth configuration, signup/profile trigger hardening, profile RLS, Vitest client/auth context tests, and login/profile UI.
2. Roles and permissions: role administration migration/RLS, pgTAP scope matrix, admin Edge Function if needed, and role/permission UI.
3. Clubs: club CRUD migration refinements, RLS and audit coverage, and club list/create/detail pages.
4. Memberships: membership state transitions as an atomic SQL function, pgTAP tests, notifications, and membership management UI.
5. Recruitment: published form schema validation, application review functions/RLS, tests, and applicant/reviewer pages.
6. Committees: designation and assignment transitions, term constraints/RLS, tests, and committee management pages.
7. Club dashboard: aggregate views/functions, dashboard RLS/tests, and the club overview UI.
8. Audit logging: audit query/report functions, retention/index tests, and an audit viewer UI.
9. Notifications: delivery preferences, provider adapter Edge Function, retry/status data, tests, and notification center UI.
10. Event volunteers: keep the uuid seam, add the events foreign key after Teammate 2's migration, atomic capacity checks, RLS/tests, notification calls, and volunteer pages.
11. Integration hardening: shared generated types, cross-module RLS contract tests, CI commands, and production deployment checks.

Each item is intentionally small enough to handle in one focused prompt while keeping the database, backend and UI in the same slice.

## Assumptions and decisions to confirm

- The initial role codes are `global_admin`, `club_admin`, `president`, `recruitment_manager`, `volunteer_coordinator`, `committee_member`, and `member`.
- Recruitment form questions are stored as JSONB until the form-builder requirements are known.
- A membership is considered a club member only while its status is `active`.
- The notification function creates the in-app notification now and logs email delivery when `EMAIL_PROVIDER` is absent; no provider adapter is selected yet.
- The local seed inserts deterministic auth users for development only. Confirm whether you want different role names, seed identities, or an institutional email/SSO provider before the authentication slice.
