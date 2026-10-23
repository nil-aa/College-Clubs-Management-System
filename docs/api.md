# API contract

`apps/api` is the backend boundary for migrated features. Every route below is prefixed with `/api`, accepts and returns JSON, and requires `Authorization: Bearer <Supabase access token>` unless marked public. Errors use:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "...", "details": {} } }
```

`details` is optional. The API returns 400 for validation, 401 for missing/invalid/expired tokens, 403 for authorization or inactive profiles, 404 for missing/inaccessible resources, 409 for conflicts, 429 for rate limiting, and 500 for unexpected errors. Stack traces never leave the server. Every log line has a request id.

## Endpoints

| Method | Path                             | Auth / permission             | Request                                                                 | Response                                                                                                        |
| ------ | -------------------------------- | ----------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| GET    | `/health`                        | None                          | —                                                                       | `{ ok: true }`                                                                                                  |
| GET    | `/users/me`                      | Authenticated, active profile | —                                                                       | Own profile fields                                                                                              |
| PATCH  | `/users/me`                      | Authenticated, active profile | `full_name?`, `department?`, `year_of_study?`, `phone?`, `roll_number?` | Updated own profile                                                                                             |
| GET    | `/me/permissions`                | Authenticated                 | —                                                                       | `{ roles: [{ code, clubId }], permissions: [{ code, clubId }] }`                                                |
| GET    | `/clubs`                         | Authenticated                 | `search?`, `category?`                                                  | Active club array                                                                                               |
| GET    | `/clubs/:id`                     | Authenticated                 | UUID path param                                                         | Club plus active head `{ id, full_name }` values; inactive clubs are visible only to admins or an assigned head |
| GET    | `/me/clubs`                      | Authenticated                 | —                                                                       | Clubs assigned to the caller as an active Club Head, including inactive clubs                                   |
| GET    | `/admin/clubs`                   | Admin                         | `search?`, `category?`                                                  | All clubs, including inactive                                                                                   |
| POST   | `/admin/clubs`                   | Admin                         | `name`, `description?`, `category?`, `contact_email?`                   | 201, created club                                                                                               |
| PATCH  | `/admin/clubs/:id`               | Admin                         | Same club body                                                          | Updated club; duplicate name is 409                                                                             |
| POST   | `/admin/clubs/:id/activate`      | Admin                         | —                                                                       | Activated club                                                                                                  |
| POST   | `/admin/clubs/:id/deactivate`    | Admin                         | —                                                                       | Deactivated club                                                                                                |
| GET    | `/admin/clubs/:id/heads`         | Admin                         | —                                                                       | Active head `{ id, full_name }` values                                                                          |
| POST   | `/admin/clubs/:id/heads`         | Admin                         | `{ userId }`                                                            | 201, assignment; duplicate/invalid assignment is 409/403/404                                                    |
| DELETE | `/admin/clubs/:id/heads/:userId` | Admin                         | —                                                                       | `{ revoked: true }`                                                                                             |
| GET    | `/admin/users`                   | Admin                         | `query`                                                                 | Search result `{ id, full_name, email, is_active }` values only                                                 |
| GET    | `/notifications`                 | Authenticated, active profile | `limit?`, `offset?`, `unread?`                                          | `{ items, total, unread_count, limit, offset }`; own notifications only                                         |
| GET    | `/notifications/unread-count`    | Authenticated, active profile | —                                                                       | `{ count }`                                                                                                     |
| PATCH  | `/notifications/:id/read`        | Authenticated, active profile | —                                                                       | Marks the caller's notification read                                                                            |
| POST   | `/notifications/read-all`        | Authenticated, active profile | —                                                                       | `{ updated }`; marks only the caller's notifications read                                                       |

The API treats an inactive profile as unavailable before route authorization. An inactive club is not disclosed as a 404 to students or unrelated Club Heads. Club Head management is exact-club only; admins pass globally. Club creation, activation and deactivation keep the current SQL audit action names: `club.created`, `club.updated`, `club.activated`, `club.deactivated`, `club_head.assigned`, and `club_head.revoked`.

## Adding a teammate module

Put a module in `apps/api/src/modules/<module>/` with `routes.ts`, `controller.ts`, `service.ts`, `repository.ts`, and `schemas.ts`. Keep controllers responsible only for HTTP parsing/serialization. Services own rules and transactions. Repositories are the only code that calls Prisma. Register the module in `src/app.ts` and use the shared `authenticate` middleware plus `requirePermission` or `requireClubManager` from `src/shared/authz/service.ts`. Do not put a service-role key in the API or frontend.

`AuditService.log` and `NotificationService.send`/`sendBulk` accept a repository client, so use the same transaction repository for the business write and side effects. The notification service validates the five event types and removes duplicate/null recipient ids.

Example only — this is not an events implementation:

```ts
await repository.transaction(async (tx) => {
  const registration = await eventsRepository(tx).insertRegistration({ eventId, userId });
  await new NotificationService(tx).send({
    userId,
    type: 'registration_confirmed',
    title: 'Registration confirmed',
    message: 'Your registration was confirmed.',
    relatedEventId: eventId,
  });
  await new AuditService(tx).log({
    actorId: userId,
    action: 'event_registration.created',
    entityType: 'event_registrations',
    entityId: registration.id,
    details: { eventId },
  });
});
```

Members 2 and 3 own their SQL migrations and API modules. Use `m2_` or `m3_` migration prefixes and do not change M1 tables without requesting an M1 migration.

## Complete-project endpoint extension

The backend migration now covers the M2/M3 tables as well. The browser does not call their
SQL RPCs or tables directly; the API services below use the same database connection and
transaction boundary:

| Method      | Path                                                     | Auth / permission                          | Purpose                                                                          |
| ----------- | -------------------------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------- |
| GET         | `/events`, `/events/:eventId`                            | Active user                                | Published event discovery and detail                                             |
| POST/DELETE | `/events/:eventId/registrations`                         | Student or active Club Head                | Own registration and cancellation with event-row locking for capacity            |
| GET         | `/me/registrations`, `/me/participation`                 | Active user                                | Own registration and participation history                                       |
| GET         | `/admin/events`, `/admin/events/:eventId`                | `events.manage`; exact club for Club Heads | Managed event list/detail                                                        |
| POST/PATCH  | `/admin/events`, `/admin/events/:eventId`                | `events.manage`; exact club                | Create/update events; schedule confirmation is explicit when registrations exist |
| POST        | `/admin/events/:eventId/publish`, `/postpone`, `/cancel` | `events.manage`; exact club                | Lifecycle transitions and participant/student notifications                      |
| GET         | `/admin/events/:eventId/participants`                    | `events.manage`; exact club                | Participant list                                                                 |
| GET/POST    | `/admin/events/:eventId/attendance`                      | `events.manage`; exact club                | Attendance snapshot and marking                                                  |
| POST        | `/admin/events/:eventId/attendance/finalize`             | `events.manage`; exact club                | Finalize only after every active registration is marked                          |
| GET         | `/admin/attendance`                                      | `events.manage`                            | Attendance aggregates                                                            |
| POST/GET    | `/admin/events/:eventId/od-sheets`, `/admin/od-sheets`   | `events.manage`; exact club for detail     | Generate and read finalized-attendance OD snapshots                              |

Event lifecycle strings are `DRAFT`, `PUBLISHED`, `POSTPONED`, `CANCELLED`, and `COMPLETED`
in the existing M2 database. Registration strings are `REGISTERED` and `CANCELLED`. M3
attendance uses `PRESENT`, `ABSENT`, and `EXCUSED`, with session states `OPEN` and `FINALIZED`.
The TypeScript services preserve the existing SQL lifecycle guards, active-club checks,
registration capacity lock, schedule-confirmation setting, attendance finalization guard,
and OD-sheet finalized-attendance guard. Audit and notification writes happen in the same
transaction as each successful mutation.

## API environment and grants

`DATABASE_URL` is the Supabase transaction-pooler URL for `club_api`; it must never be a
frontend variable. `SUPABASE_JWKS_URL` is preferred for asymmetric signing keys, while
`SUPABASE_JWT_SECRET` is the legacy alternative; configure exactly one. `VITE_API_URL` is
the only backend URL needed by the web app. The API rejects any environment containing
`SUPABASE_SERVICE_ROLE_KEY`.

After all current M1/M2/M3 migrations have been applied, run `npm run check:api-grants`.
It reports every public table's `club_api` privileges and whether an RLS table has an
explicit API policy. The `m1_api_grants_all` migration adds current grants, permissive API
policies as a deny-by-default browser safety net, audit's select/insert exception, and
default table/sequence privileges. PostgreSQL has no default-policy feature, so the check
script is required after every teammate migration.
