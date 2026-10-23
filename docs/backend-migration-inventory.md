# Whole-project backend migration inventory

Inventory source: the committed `supabase/migrations`, `supabase/functions`, `apps/api`,
`apps/web/src`, and Prisma schema as of 2026-10-23. Migration ownership is inferred from
the filename prefix (`m1`, `m2`, `m3`). The working tree had no merge conflict markers.

## Headline numbers

- 33 SQL migration files (including the M1 API role and whole-schema grant migrations).
- 24 public tables, 10 public enums, and no public views found in the migration source.
- 64 distinct SQL function names (including trigger functions and later replacements).
- 77 policy declarations across migration history; later migrations replace several earlier policies.
- 1 Edge Function (`notifications`). No Storage usage found in application code or migrations.
- 1 Realtime publication change: `public.notifications` is added to `supabase_realtime` conditionally.
- 0 frontend files contain direct `from`, `rpc`, `storage`, `functions.invoke`, or `channel` calls. Two files use Supabase Auth/session APIs only: `AuthContext.tsx` and the API client's token bridge.
- API coverage after this step: the complete project, including M1 identity/clubs/RBAC/notifications/audit/dashboard and M2/M3 events, registrations, participants, attendance and OD sheets.
- Prisma introspection was retried and could not reach the configured pooler (`P1001`); the schema therefore remains the last committed introspection and must be refreshed when the project is reachable.

## Migration files

| File                                                        | Owner | Summary                                                                                                                                                                              |
| ----------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `20261014000100_m1_identity_clubs_membership.sql`           | M1    | Initial profiles, roles, permissions, clubs, memberships, legacy recruitment/committee/volunteer tables, notifications, audit logs, triggers, helpers and baseline RLS.              |
| `20261014000200_m1_profile_fields.sql`                      | M1    | Adds department/year fields, profile self policies and profile update audit trigger.                                                                                                 |
| `20261014000300_m1_rbac_management.sql`                     | M1    | Adds system-role metadata, legacy custom-role RPCs, read policies and privilege checks.                                                                                              |
| `20261014000400_m1_rbac_three_roles.sql`                    | M1    | Establishes student/club_head/admin, scoped assignments, club-head RPCs and reduced-scope role policies.                                                                             |
| `20261014000500_m1_schema_finalize_identity_clubs.sql`      | M1    | Finalizes profile/club fields, signup student-role trigger, active-state synchronization and no-delete clubs.                                                                        |
| `20261014000600_m1_schema_finalize_notifications_audit.sql` | M1    | Finalizes notification read fields/types and audit actor/details names, append-only triggers and policies.                                                                           |
| `20261014000700_m1_clubs_rpc.sql`                           | M1    | Adds admin club create/update/active-state RPCs and direct-write denial.                                                                                                             |
| `20261014000800_m1_clubs_directory_heads.sql`               | M1    | Adds active/inactive club visibility rules and safe club-head name function.                                                                                                         |
| `20261014000900_m1_notifications_service.sql`               | M1    | Adds validated notification, bulk, active-student, read and read-all functions; restricts execute.                                                                                   |
| `20261014001000_m1_notifications_realtime.sql`              | M1    | Conditionally adds notifications to the Supabase Realtime publication.                                                                                                               |
| `20261014001100_m1_notifications_club_head_message.sql`     | M1    | Replaces the compatibility notification overload for club-head assignment messages.                                                                                                  |
| `20261014001200_m1_audit_dashboard_rpc.sql`                 | M1    | Adds audit indexes, admin audit-log and dashboard-stat RPCs and direct audit-read denial.                                                                                            |
| `20261014001300_m1_audit_dashboard_rpc_repair.sql`          | M1    | Repairs exposed dashboard RPC definitions for hosted projects.                                                                                                                       |
| `20261015000100_m1_audit_dashboard_repair.sql`              | M1    | Repairs audit/dashboard functions and backfills student roles for older profiles.                                                                                                    |
| `20261015000200_m2_event_schema.sql`                        | M2    | Creates events and event registrations, event indexes, statuses and base RLS.                                                                                                        |
| `20261015000300_m2_event_ids_uuid.sql`                      | M2    | Converts event identifiers and dependent references to UUIDs and replaces obsolete RPC signatures.                                                                                   |
| `20261015000400_m2_event_management_rpc.sql`                | M2    | Adds guarded event create/update/publish/postpone/cancel RPCs.                                                                                                                       |
| `20261015000500_m2_student_event_discovery.sql`             | M2    | Adds student event discovery functions and published-event visibility.                                                                                                               |
| `20261015000600_m2_event_registrations_rpc.sql`             | M2    | Adds registration/cancellation RPCs with event-row locking and capacity enforcement.                                                                                                 |
| `20261015000700_m2_allow_club_head_registration.sql`        | M2    | Extends event registration eligibility to active club heads.                                                                                                                         |
| `20261015000800_m3_event_participants.sql`                  | M3    | Adds club-scoped event participant listing RPC.                                                                                                                                      |
| `20261015000900_m3_event_attendance.sql`                    | M3    | Adds attendance session/attendance tables and mark/finalize RPCs.                                                                                                                    |
| `20261015001000_m3_student_participation_history.sql`       | M3    | Adds student participation history RPC.                                                                                                                                              |
| `20261015001100_m3_od_sheets.sql`                           | M3    | Adds OD sheet and OD sheet student tables.                                                                                                                                           |
| `20261015001200_m3_attendance_dashboard.sql`                | M3    | Adds club-scoped attendance dashboard RPC.                                                                                                                                           |
| `20261015001300_m3_roll_number_profile.sql`                 | M3    | Adds roll-number validation trigger and profile audit replacement.                                                                                                                   |
| `20261015001400_drop_unused_scaffold_tables.sql`            | M1    | Removes the out-of-scope scaffold membership/recruitment/committee/volunteer tables.                                                                                                 |
| `20261023000100_signup_email_domains.sql`                   | M1    | Adds allowed signup domains and admin domain-management functions.                                                                                                                   |
| `20261023000200_signup_email_precheck.sql`                  | M1    | Adds signup email eligibility function.                                                                                                                                              |
| `20261023000300_event_end_and_registration_rules.sql`       | M2    | Adds ended-event validation and registration rule replacements.                                                                                                                      |
| `20261023000400_registered_schedule_confirmation.sql`       | M2    | Adds schedule-change confirmation trigger and notification-aware event updates.                                                                                                      |
| `20261023000500_m1_api_role.sql`                            | M1    | Creates the least-privilege `club_api` role and current M1 grants/policies.                                                                                                          |
| `20261023000600_m1_api_grants_all.sql`                      | M1    | Grants the API role access to the complete merged public schema, adds explicit API RLS policies, preserves audit select/insert-only access, and sets future table/sequence defaults. |

## Database objects

### Tables and business-rule columns

| Table                                                                                                                                                                                                     | Owner     | Important columns and rules                                                                                                                            |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `profiles`                                                                                                                                                                                                | M1        | `id` auth user, `full_name`, `email`, `roll_number`, department/year/phone, `is_active`; roll number is nullable/unique and validated by M3’s trigger. |
| `roles`                                                                                                                                                                                                   | M1        | code/name, `is_global`, `is_system`; reduced scope uses student, club_head and admin.                                                                  |
| `permissions`                                                                                                                                                                                             | M1        | unique permission code.                                                                                                                                |
| `role_permissions`                                                                                                                                                                                        | M1        | role/permission composite key.                                                                                                                         |
| `user_roles`                                                                                                                                                                                              | M1        | user/role/optional club, status/is_active, assigner and deactivation history; partial unique indexes prevent duplicate active scopes.                  |
| `clubs`                                                                                                                                                                                                   | M1        | name/slug/category/contact, active/status, creator; delete is blocked.                                                                                 |
| `club_memberships`                                                                                                                                                                                        | M1 legacy | club/user/status and join/leave dates; not used by the current Club Head design.                                                                       |
| `notifications`                                                                                                                                                                                           | M1        | user, type/title/message, related event UUID, read state, legacy channels/metadata/status.                                                             |
| `audit_logs`                                                                                                                                                                                              | M1        | bigint id, nullable actor, dot-action, entity type/id, JSON details, created time; append-only trigger.                                                |
| `allowed_signup_email_domains`                                                                                                                                                                            | M1        | normalized domain primary key.                                                                                                                         |
| `events`                                                                                                                                                                                                  | M2        | UUID `event_id`, club/creator, schedule, capacity, status, publication and postponement fields.                                                        |
| `event_registrations`                                                                                                                                                                                     | M2        | event/student/status and registration timestamps; unique event/student and cancellation state.                                                         |
| `event_attendance_sessions`                                                                                                                                                                               | M3        | event/club, open/finalized status, finalizer/timestamp.                                                                                                |
| `event_attendance`                                                                                                                                                                                        | M3        | session/event/student, attendance enum and marker/finalization data.                                                                                   |
| `od_sheets`                                                                                                                                                                                               | M3        | event/club, selected fields, event data and creator.                                                                                                   |
| `od_sheet_students`                                                                                                                                                                                       | M3        | OD sheet/student rows and generated/approved data.                                                                                                     |
| `membership_applications`, `recruitment_forms`, `recruitment_responses`, `committee_designations`, `committee_assignments`, `event_volunteer_openings`, `volunteer_applications`, `volunteer_assignments` | legacy M1 | Created by the first scaffold and removed by `20261015001400`; they should not exist after all migrations apply.                                       |

### Enums

`profile_status`, `club_status`, `membership_status`, `application_status`, `form_status`,
`assignment_status`, `volunteer_opening_status`, `notification_status`,
`attendance_status` (`PRESENT`, `ABSENT`, `EXCUSED`) and
`attendance_session_status` (`OPEN`, `FINALIZED`).

No public views were found in migration source.

## SQL functions and RPCs

All functions below are in `public`; functions explicitly described as `SECURITY DEFINER`
run with their owner’s privileges and set `search_path = public` unless noted. Function
definitions are replaced by later migrations, so the last definition in migration order is
the effective one. Browser execute grants are summarized as they stand in source; the new API
lock-down will make the API the application path.

| Function(s)                                                                                                                                                                                                                              | Arguments / security / execution                                                  | Reads, writes and notable behavior                                                                                                                                                                                                                                                       |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `handle_new_user`                                                                                                                                                                                                                        | trigger, no args, SECURITY DEFINER; auth trigger only                             | Creates profile from signup metadata and active student role.                                                                                                                                                                                                                            |
| `set_updated_at`, `sync_club_active_state`, `sync_user_role_assignment_state`, `sync_notification_read_state`                                                                                                                            | trigger helpers, no args                                                          | Maintain timestamps, club status/active parity, assignment active parity and notification read/status parity.                                                                                                                                                                            |
| `audit_profile_update`, `validate_profile_roll_number`, `prevent_club_delete`, `prevent_audit_log_mutation`, `require_registered_schedule_confirmation`, `reject_ended_event_insert`, `enforce_signup_email_domain`                      | trigger helpers                                                                   | Enforce profile/club/audit/event/signup invariants; write no business rows.                                                                                                                                                                                                              |
| `has_role(text, uuid)`, `has_permission(text, uuid)`, `is_club_member(uuid)`, `can_manage_club(uuid)`                                                                                                                                    | stable SECURITY DEFINER helpers; selected helpers are executable by browser roles | Read roles, permissions, memberships and active profiles. Admin/global-admin is global; club-head requires matching active club scope.                                                                                                                                                   |
| `log_audit(text, text, uuid, jsonb)`                                                                                                                                                                                                     | SECURITY DEFINER; trusted RPC callers                                             | Inserts `audit_logs` with `auth.uid()` actor.                                                                                                                                                                                                                                            |
| `send_notification(uuid,text,text,text,uuid)`, `send_notification_bulk(uuid[],text,text,text,uuid)`, `get_active_student_ids()`                                                                                                          | SECURITY DEFINER; direct browser execute revoked, service role/trusted RPC use    | Validate event notification types/title/message, insert notification rows, deduplicate bulk ids and skip null ids; no event/registration query in bulk.                                                                                                                                  |
| `mark_notification_read(uuid)`, `mark_all_notifications_read()`                                                                                                                                                                          | SECURITY DEFINER; authenticated                                                   | Updates only caller-owned notification rows.                                                                                                                                                                                                                                             |
| `assign_club_head(uuid,uuid)`, `revoke_club_head(uuid,uuid)`, `set_user_role(uuid,text)`                                                                                                                                                 | SECURITY DEFINER; authenticated execute; checks `users.manage`                    | Admin-only role/assignment writes; last-admin protection, admin scope guard, unique active assignments. Logs `club_head.assigned`, `club_head.revoked`, `user_role.changed`; sends compatibility notifications. `set_user_role` uses advisory transaction locking for last-admin checks. |
| `assign_role`, `revoke_role`, `create_role`, `update_role`, `update_role_permissions`, `delete_role`                                                                                                                                     | SECURITY DEFINER; legacy browser execute revoked under reduced scope              | Legacy custom-role management. Checks `roles.manage`, system-role immutability, permission escalation and last-global-admin protection; logs role actions and attempts compatibility notifications. `revoke_role` uses advisory transaction locking.                                     |
| `create_club`, `update_club`, `set_club_active`                                                                                                                                                                                          | SECURITY DEFINER; authenticated execute                                           | Admin-only club writes, duplicate/unknown-club checks; logs `club.created`, `club.updated`, `club.activated`, `club.deactivated`.                                                                                                                                                        |
| `get_club_heads(uuid)`                                                                                                                                                                                                                   | SECURITY DEFINER, stable; authenticated read                                      | Returns only active head id/name for one club.                                                                                                                                                                                                                                           |
| `list_audit_logs(text,text,uuid,timestamptz,timestamptz,int,int)`                                                                                                                                                                        | SECURITY DEFINER; admin permission                                                | Filters audit rows, joins actor name, newest first and caps limit at 100.                                                                                                                                                                                                                |
| `get_admin_dashboard_stats()`                                                                                                                                                                                                            | SECURITY DEFINER; admin permission                                                | Aggregates active/inactive clubs, users by role, clubs without heads and five recent audit entries.                                                                                                                                                                                      |
| `list_allowed_signup_email_domains()`, `add_allowed_signup_email_domain(text)`, `remove_allowed_signup_email_domain(text)`, `check_signup_email_eligibility(text)`                                                                       | SECURITY DEFINER domain-management/precheck functions                             | Read or mutate signup-domain allowlist; admin checks on mutations.                                                                                                                                                                                                                       |
| `assert_event_manager(uuid)`, `validate_event_fields(...)`, `create_event(...)`, `update_event(...)`, `publish_event(uuid)`, `postpone_event(...)`, `cancel_event(uuid)`, `get_managed_event(uuid)`, `list_managed_events(uuid,int,int)` | M2 functions, mostly SECURITY DEFINER                                             | Club-head/admin event checks, event lifecycle and audit/notification side effects.                                                                                                                                                                                                       |
| `list_student_events(...)`, `get_student_event(uuid)`                                                                                                                                                                                    | M2 read RPCs                                                                      | Read published/postponed/cancelled/completed discoverable events.                                                                                                                                                                                                                        |
| `assert_active_event_student()`, `register_for_event(uuid)`, `cancel_event_registration(uuid)`, `list_my_event_registrations(...)`                                                                                                       | M2 SECURITY DEFINER                                                               | Own-row registration workflow. Registration and cancellation lock the event row before capacity/state decisions, preventing over-capacity races.                                                                                                                                         |
| `list_event_participants(uuid)`                                                                                                                                                                                                          | M3 SECURITY DEFINER                                                               | Club-manager-only participant details.                                                                                                                                                                                                                                                   |
| `mark_event_attendance(...)`, `finalize_event_attendance(uuid)`                                                                                                                                                                          | M3 SECURITY DEFINER                                                               | Club-manager attendance writes/finalization; finalized sessions cannot be edited.                                                                                                                                                                                                        |
| `list_my_event_participation()`                                                                                                                                                                                                          | M3 SECURITY DEFINER                                                               | Own participation and attendance history.                                                                                                                                                                                                                                                |
| `generate_od_sheet(...)`                                                                                                                                                                                                                 | M3 SECURITY DEFINER                                                               | Club-manager OD generation; server-side SQL output data is returned to the client.                                                                                                                                                                                                       |
| `list_attendance_dashboard(uuid,int,int)`                                                                                                                                                                                                | M3 SECURITY DEFINER                                                               | Club-scoped attendance aggregate with registration/attendance counts.                                                                                                                                                                                                                    |
| `postpone_event_with_confirmation(...)`, `update_event_with_confirmation(...)`                                                                                                                                                           | M2 SECURITY DEFINER                                                               | Schedule changes require an explicit transaction-local confirmation setting when active registrations exist.                                                                                                                                                                             |

Known action names in source include `profile.updated`, `club.created`, `club.updated`,
`club.activated`, `club.deactivated`, `club_head.assigned`, `club_head.revoked`,
`user_role.changed`, `role.assigned`, `role.revoked`, `role.created`, `role.updated`,
`role.permissions_updated`, `role.deleted`, plus M2/M3 event/registration/attendance actions.
The two `club_head.*` and `user_role.changed` names are legacy compatibility names and are
not dot-separated `entity.verb` consistently with the rest; they are retained in this inventory.

## RLS policy summary

RLS is enabled for all original M1 tables and the M2/M3 tables. Later policies replace earlier
ones, so this is the effective intent rather than every historical duplicate declaration:

- `profiles`: self-read/self-update; admin or explicitly permitted role-management reads; API role policy is permissive.
- `roles`, `permissions`, `role_permissions`: authenticated read according to the current permission policies; browser writes denied.
- `user_roles`: self or authorized role-manager read; browser writes denied; API role policy is permissive.
- `clubs`: authenticated users read active clubs; admins and assigned heads can read inactive clubs; direct browser writes denied.
- `club_memberships`: own rows or permitted club-manager rows in legacy policy.
- `notifications`: own-row read only; direct insert/update/delete denied to browser roles; read-state RPCs are the write path.
- `audit_logs`: direct browser read/write denied except retained legacy policy history; admin audit RPC and API role are the read paths; append-only triggers reject update/delete.
- `allowed_signup_email_domains`: browser access revoked; domain RPCs are the path.
- `events` and `event_registrations`: M2 published/manager/own-row policies; registration writes are RPC-controlled.
- `event_attendance_sessions`, `event_attendance`, `od_sheets`, `od_sheet_students`: M3 club-manager/own-history policies; writes are RPC-controlled.
- Removed scaffold tables: no effective table/policy after `20261015001400`.

The new whole-schema API grant migration adds a `club_api` policy to every public table while
keeping `audit_logs` select/insert only. This is intentionally permissive because TypeScript
services become the authorization boundary.

## Edge Functions, Storage, Realtime and triggers

- Edge Function: `supabase/functions/notifications/index.ts`; it is a notification skeleton and logs when no email provider is configured. It is not used by the new in-app API path.
- Storage: no `supabase.storage` calls or storage migrations found.
- Realtime: `20261014001000_m1_notifications_realtime.sql` conditionally adds notifications to `supabase_realtime`; the new frontend path removes its channel and polls instead.
- Triggers: auth signup/profile and student-role trigger; updated-at triggers; profile audit trigger; club active-state and no-delete triggers; user-role state trigger; notification read-state trigger; audit append-only triggers; M2 ended-event and schedule-confirmation triggers; M3 roll-number validation trigger.

## Frontend direct Supabase call sites

No frontend data call sites remain. `context/AuthContext.tsx` keeps only the permitted
Supabase Auth calls for login, signup, logout, password reset, password update and session
subscription. `features/api/client.ts` calls only `supabase.auth.getSession()` and
`refreshSession()` to attach/renew a bearer token; it does not access tables, RPCs, Realtime,
Storage or Edge Functions. All application pages, including M2/M3 pages, use the API client.

No frontend `supabase.storage`, `supabase.functions.invoke` or `supabase.channel` call sites
were found. The notification bell now polls every 30 seconds and refetches on focus.

## Browser-side logic moved to the API

Event discovery, capacity enforcement, lifecycle transitions, registration history,
participant reads, attendance calculations/finalization, and OD-sheet snapshot generation
now run in API services/repositories. The browser still renders the resulting data and may
later request server-generated CSV/Excel/PDF representations from an API export endpoint;
that export endpoint is intentionally not invented in this step because the existing UI only
renders the generated OD data.

## Proposed REST endpoints

All endpoints use `/api`, bearer authentication, the shared error envelope and the middleware
conventions in `docs/api.md`.

### M1

| Method/path                                                                     | Auth and permission                                     | Data source                           |
| ------------------------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------- |
| `GET/PATCH /users/me`                                                           | authenticated; own row                                  | profiles query/update + audit service |
| `GET /me/permissions`                                                           | authenticated                                           | user_roles/roles/permissions query    |
| `GET /clubs`, `GET /clubs/:id`, `GET /me/clubs`                                 | authenticated; inactive detail only admin/assigned head | clubs and active-head query           |
| `POST/PATCH /admin/clubs`, `POST /admin/clubs/:id/{activate,deactivate}`        | admin                                                   | club service + audit                  |
| `GET /admin/clubs/:id/heads`, `POST/DELETE /admin/clubs/:id/heads/:userId`      | admin                                                   | user_roles + audit/notification       |
| `GET /admin/users?query=`                                                       | admin                                                   | profile search                        |
| `GET /notifications`, `GET /notifications/unread-count`                         | authenticated; own rows                                 | notifications repository              |
| `PATCH /notifications/:id/read`, `POST /notifications/read-all`                 | authenticated; own rows                                 | notification service                  |
| `GET /admin/audit-logs`                                                         | admin                                                   | audit query, 100 cap                  |
| `GET /dashboard`                                                                | authenticated; admin branch restricted                  | aggregate repository queries          |
| `GET /admin/roles`, `GET /admin/role-assignments`, `POST /admin/users/:id/role` | admin                                                   | roles/user_roles + guards             |

### M2

`GET /events`, `GET /events/:id`, `GET /admin/events`, `GET /admin/events/:id`,
`POST /admin/events`, `PATCH /admin/events/:id`, `POST /admin/events/:id/{publish,postpone,cancel}`,
`POST/DELETE /events/:id/registrations`, and `GET /me/registrations`. These map to the M2
RPC behavior, with capacity checks and registration audit/notification rows in one transaction.

### M3

`GET /admin/events/:id/participants`, `GET /admin/events/:id/attendance`,
`POST /admin/events/:id/attendance`, `POST /admin/events/:id/attendance/finalize`,
`GET /me/participation`, `GET /admin/attendance`, `POST /admin/events/:id/od-sheets`,
`GET /admin/od-sheets`, and `GET /admin/od-sheets/:id`. The API owns attendance calculations
and finalized OD snapshot generation; document export can be added as a later API slice.

## Risks and gotchas

1. The configured pooler was unreachable during Prisma introspection (`P1001`); the Prisma schema is not yet proof that the merged remote schema matches migrations.
2. The initial migration creates legacy scaffold tables and a later migration drops them. A partially applied remote history may leave a different object set.
3. `notifications.type` is constrained to event notification types, while legacy role-assignment SQL tries to send `club_head.*` and `user_role.changed`. This is an existing behavior mismatch; the API migration must not silently broaden the contract.
4. `audit_logs` changed `actor_user_id`/`metadata` to `actor`/`details`; stale generated clients or remote history can produce misleading audit failures.
5. M2 originally used bigint event ids and later converts them to UUIDs; all API contracts must use the final UUID shape.
6. M2 registration logic correctly locks the event row for capacity enforcement; a TypeScript port must preserve that transaction/locking behavior.
7. Existing SQL RPCs and their browser grants remain for compatibility until the lock-down migration; they are no longer called by the frontend or API.
8. API-side permissive `club_api` policies bypass browser RLS intent only for the dedicated role, so the services and repository tests are the real authorization layer.
9. The merged schema contains an older event-id conversion history; the final API contract uses UUID event ids, but Prisma introspection must be rerun against a reachable project to verify the generated schema.
