# College Club Management System

Monorepo for the reduced club management scope. Each feature is delivered as one vertical slice: migration, RLS, database tests, backend/Edge Function logic where needed, and the React UI.

## Structure

```text
supabase/
  config.toml
  migrations/                 # timestamp_m1_* migrations owned by this module
  tests/                      # pgTAP tests
  functions/notifications/    # Deno Edge Function skeleton
docs/schema.md                # shared cross-member schema contract
packages/shared/              # shared Database type and typed RPC wrappers
apps/web/                     # React + TypeScript + Vite + Tailwind shell
```

The current scope has three roles: `student`, `club_head`, and `admin`. Club-head access is always scoped to an assigned club. The events and attendance modules are deliberately not implemented; their web extension points are `/events` and `/bookings`.

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

Open http://localhost:5173. The seed accounts are development-only and all use the password `Test1234!`; never reuse or deploy these credentials. The seeded admin is `global-admin@example.test`; Club Heads are `president@example.test` and `club-head-two@example.test`; the remaining seeded accounts are students. Authentication and profile pages are available at `/login`, `/signup`, `/forgot-password`, `/reset-password`, and `/profile`. The admin Users & Roles page is `/roles-permissions`, and club administration is `/manage-clubs`; both require `users.manage`. The directory is `/clubs`, and individual club details are `/clubs/:clubId`. To invoke the notification function locally, copy `supabase/functions/.env.example` to `supabase/functions/.env`, fill in the local service-role key from `supabase status`, and run:

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
supabase db push --include-seed
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

`npm run db:test` uses the Supabase CLI test runner and therefore requires Docker. If you are working only against a hosted Supabase project, first ensure the migrations and development seed are applied, then open each matching file in `supabase/tests/editor/` in the Supabase SQL Editor and run the entire file. Each editor script collects the TAP output into one result set and wraps all writes in `begin`/`rollback`, so it leaves no test data behind. The hosted project must have the `pgtap` extension enabled. The editor scripts are test fixtures: do not run them against production data unless you understand the temporary seed identities they use.

## Shared interfaces

The complete cross-member schema contract, ownership rules, status strings, ER diagram, and notification wiring are documented in [docs/schema.md](<C:/Users/Nilaa A J/Desktop/club_management_system/docs/schema.md>).

These SQL helpers are the contract used by the web app and by the other team members' modules. They are security-definer functions with a fixed `search_path`; callers only receive execute access.

```sql
select public.has_role('admin');
select public.has_role('club_head', '00000000-0000-0000-0000-000000000000'::uuid);
select public.has_permission('clubs.manage', '00000000-0000-0000-0000-000000000000'::uuid);
select public.is_club_member('00000000-0000-0000-0000-000000000000'::uuid);
select public.can_manage_club('00000000-0000-0000-0000-000000000000'::uuid);
select public.get_club_heads('00000000-0000-0000-0000-000000000000'::uuid);
```

- `has_role(role, club_id)` checks an active global role, or the exact club-scoped Club Head assignment.
- `has_permission(permission, club_id)` checks an active permission at the requested scope. Admins pass globally.
- `is_club_member(club_id)` checks an active membership for the current user.
- `can_manage_club(club_id)` is true for an admin or a Club Head assigned to that exact club.
- `get_club_heads(club_id)` returns only active head `id` and `full_name` values for a club.
- `assign_club_head(user_id, club_id)`, `revoke_club_head(user_id, club_id)`, and `set_user_role(user_id, role)` are the admin-only write boundaries for RBAC.
- `create_club(name, description, category, contact_email)`, `update_club(club_id, name, description, category, contact_email)`, and `set_club_active(club_id, is_active)` are the admin-only club write boundaries. Club names are case-insensitively unique and clubs are never deleted.
- `send_notification(user_id, type, title, message, related_event_id)` is a trusted, in-app-only delivery helper. It is callable from Member 2's `SECURITY DEFINER` RPCs and `service_role`, not from browser sessions.
- `send_notification_bulk(user_ids, type, title, message, related_event_id)` performs the same trusted delivery for distinct, non-null user ids without querying registrations.
- `get_active_student_ids()` returns active student ids for event publication fan-out. It has the same trusted-only execute restriction.
- `mark_notification_read(notification_id)` and `mark_all_notifications_read()` are the only notification read-state write boundaries available to logged-in users.
- The web notification link contract is `/events/:id`. Until Member 2 registers that detail route, event notifications intentionally render without a link.

SQL Editor smoke test (run as the project owner or service role, never from browser code):

```sql
select public.send_notification(
  '10000000-0000-0000-0000-000000000003'::uuid,
  'event_published',
  'Test notification',
  'This is an in-app delivery smoke test.',
  null::uuid
);
```

The `20261014001000_m1_notifications_realtime.sql` migration adds `public.notifications` to the `supabase_realtime` publication when that standard publication exists. On a hosted project, confirm it with `select * from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'notifications';`. If it is absent, run `alter publication supabase_realtime add table public.notifications;` once in the SQL Editor. RLS still filters Realtime rows to the current user.

## Security decisions in this scaffold

- Every requested public table has RLS enabled and starts closed to `anon`/`authenticated` unless a policy grants access.
- Role assignments may have `club_id = null` for global roles or a concrete club for a Club Head assignment. Active assignments are unique; deactivation preserves history.
- `admin` is the only global administrator role. `global_admin` is still recognized by the compatibility helper so an existing hosted seed can be repaired before old data is migrated.
- Club Heads receive a global role marker plus one or more active, club-scoped assignments. The marker alone grants no club-management permission.
- Shared helper functions are `security definer` with a fixed `search_path`; callers receive only execute privileges. RBAC writes go through the admin-only RPCs.
- `log_audit` and `send_notification` are the atomic insertion boundaries for their respective tables.
- The signup trigger creates a profile from `raw_user_meta_data.full_name` and falls back to the email local-part.
- User and role administration is available at `/roles-permissions` only to users with `users.manage`; role writes go through guarded Postgres RPCs and direct table writes remain revoked.
- The notification inbox is available at `/notifications`; the app layout bell shows the latest five notifications and refetches on window focus when Realtime is unavailable.

## Ordered vertical-slice roadmap

1. Authentication and profiles: auth configuration, signup/profile trigger hardening, profile fields and RLS, Vitest client/auth context tests, and login/profile UI.
2. Roles and authorization: three-role migration, helper/RPC guard rails, pgTAP scope tests, shared wrappers, and the Users & Roles UI.
3. Clubs: admin club CRUD, activation/deactivation, audit/RLS tests, and responsive club list/create/edit/detail pages.
4. Club-head assignments: assignment history and notifications, RPC/RLS tests, and the admin assignment workflow integrated with club details.
5. Student club directory: read-only directory/detail RLS, tests, and student-facing discovery pages.
6. Notifications: inbox/history queries, unread count, mark-read RPC/RLS, tests, and the notification center UI.
7. Events integration: teammate-owned event tables and workflows consume the shared club/authorization/notification interfaces.
8. Attendance integration: teammate-owned attendance and participant workflows consume the shared event and role interfaces.
9. Integration hardening: generated/shared types, cross-module RLS contract tests, CI commands, and production deployment checks.

Each item is intentionally small enough to handle in one focused prompt while keeping the database, backend and UI in the same slice.

## Existing out-of-scope tables and code

The original scaffold created these tables, but the reduced scope does not use them: `membership_applications`, `recruitment_forms`, `recruitment_responses`, `committee_designations`, `committee_assignments`, `event_volunteer_openings`, `volunteer_applications`, and `volunteer_assignments`. The volunteer tables still use a plain `event_id uuid` because the teammate-owned events table does not exist yet.

The earlier custom-role migration and wrappers also remain for compatibility: `assign_role`, `revoke_role`, `create_role`, `update_role`, `update_role_permissions`, `delete_role`, and the old role-management types/helpers. The new RBAC migration revokes application-user execute access to those RPCs, so they are not part of the active feature. Existing placeholder routes/nav entries for memberships, recruitment, committees, and volunteers are likewise retained until you confirm removal.

The first scaffold also introduced legacy role codes such as `global_admin`, `club_admin`, `president`, `recruitment_manager`, `volunteer_coordinator`, `committee_member`, and `member`. The seed no longer assigns those roles to the development users, but it does not delete the role rows or historical assignments.

These tables and legacy functions can be removed in a later cleanup migration after confirming that no teammate branch or hosted data depends on them. They were intentionally not dropped in this step.

## Assumptions and decisions to confirm

- `set_user_role(user_id, 'club_head')` establishes the user's base role marker; an admin must also assign one or more clubs before the user can manage anything.
- Admins cannot receive Club Head assignments, and Club Head access is never global.
- The current profile UI has full name, department, year of study, phone, and email. Roll number is part of the reduced scope but needs a field decision before the next profile migration.
- The notification function creates in-app notifications now and logs email delivery when `EMAIL_PROVIDER` is absent; no external provider adapter is selected yet.
- The local seed inserts deterministic auth users for development only. Confirm whether you want different seed identities or an institutional email/SSO provider before production deployment.
