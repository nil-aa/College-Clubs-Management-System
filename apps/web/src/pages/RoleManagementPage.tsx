import { useCallback, useEffect, useMemo, useState } from 'react';
import { assignClubHead, revokeClubHead, setUserRole } from '@club-management/shared';
import { Can } from '../components/Can';
import { usePermission } from '../hooks/usePermission';
import { supabase } from '../lib/supabase';
import { RoleAssignmentForm } from '../features/rbac/RoleAssignmentForm';
import type { ClubOption, Role, UserOption, UserRoleAssignment } from '../features/rbac/types';
import { SignupDomainSettings } from '../features/rbac/SignupDomainSettings';

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error && 'message' in error) return String(error.message);
  return 'Something went wrong. Please try again.';
}

export function RoleManagementPage() {
  const { allowed, loading: permissionLoading } = usePermission('users.manage');
  const [roles, setRoles] = useState<Role[]>([]);
  const [clubs, setClubs] = useState<ClubOption[]>([]);
  const [assignments, setAssignments] = useState<UserRoleAssignment[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [search, setSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    const [rolesResult, clubsResult, assignmentsResult] = await Promise.all([
      supabase
        .from('roles')
        .select('*')
        .in('code', ['student', 'club_head', 'admin'])
        .order('name'),
      supabase.from('clubs').select('id, name, status, is_active').order('name'),
      supabase.from('user_roles').select('*'),
    ]);
    const failed = [rolesResult, clubsResult, assignmentsResult].find((result) => result.error);
    if (failed?.error) {
      setError(errorMessage(failed.error));
      setLoading(false);
      return;
    }
    setRoles((rolesResult.data ?? []) as Role[]);
    setClubs((clubsResult.data ?? []) as ClubOption[]);
    setAssignments((assignmentsResult.data ?? []) as UserRoleAssignment[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (allowed) void loadData();
  }, [allowed, loadData]);

  const selectedUser = users.find((user) => user.id === selectedUserId) ?? null;
  const selectedAssignments = assignments.filter(
    (assignment) => assignment.user_id === selectedUserId,
  );
  const activeRole = selectedAssignments.find(
    (assignment) => assignment.status === 'active' && assignment.club_id === null,
  );
  const currentRole = roles.find((role) => role.id === activeRole?.role_id)?.code ?? 'student';

  const roleCounts = useMemo(() => {
    const counts = new Map<string, Set<string>>();
    assignments
      .filter((assignment) => assignment.status === 'active')
      .forEach((assignment) => {
        const usersForRole = counts.get(assignment.role_id) ?? new Set<string>();
        usersForRole.add(assignment.user_id);
        counts.set(assignment.role_id, usersForRole);
      });
    return counts;
  }, [assignments]);

  async function searchUsers() {
    const term = search.trim();
    if (term.length < 2) {
      setUsers([]);
      setSelectedUserId(null);
      return;
    }
    setError('');
    const { data, error: queryError } = await supabase
      .from('profiles')
      .select('id, full_name')
      .ilike('full_name', `%${term}%`)
      .order('full_name')
      .limit(20);
    if (queryError) {
      setError(errorMessage(queryError));
      return;
    }
    setUsers((data ?? []) as UserOption[]);
    setSelectedUserId(null);
  }

  async function handleRoleChange(role: string) {
    if (!selectedUserId) return;
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      await setUserRole(supabase, selectedUserId, role);
      setSuccess('The user role was updated and the user was notified.');
      await loadData();
    } catch (roleError) {
      setError(errorMessage(roleError));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAssignClubHead(clubId: string) {
    if (!selectedUserId) return;
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      await assignClubHead(supabase, selectedUserId, clubId);
      setSuccess('Club Head assignment saved and the user was notified.');
      await loadData();
    } catch (assignmentError) {
      setError(errorMessage(assignmentError));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRevokeClubHead(clubId: string) {
    if (!selectedUserId) return;
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      await revokeClubHead(supabase, selectedUserId, clubId);
      setSuccess('Club Head assignment revoked and the user was notified.');
      await loadData();
    } catch (revokeError) {
      setError(errorMessage(revokeError));
    } finally {
      setSubmitting(false);
    }
  }

  if (permissionLoading) {
    return <div className="rounded-3xl bg-white p-8 text-slateDark">Checking permissions…</div>;
  }

  return (
    <Can
      permission="users.manage"
      fallback={
        <section
          className="rounded-3xl border border-rose-200 bg-pink p-8 text-rose-950"
          role="alert"
        >
          <h1 className="text-2xl font-bold">Users & Roles</h1>
          <p className="mt-2">You do not have permission to manage users and roles.</p>
        </section>
      }
    >
      <div className="space-y-6">
        <div>
          <p className="text-sm font-semibold text-slateDark/70">Administration</p>
          <h1 className="mt-1 text-3xl font-bold text-slateDark">Users & Roles</h1>
          <p className="mt-2 max-w-3xl text-sm text-slateDark/75">
            Assign the three system roles and manage club-scoped Club Head access.
          </p>
        </div>
        {error && (
          <p
            className="rounded-xl border border-rose-200 bg-pink px-4 py-3 text-sm font-medium text-rose-900"
            role="alert"
          >
            {error}
          </p>
        )}
        {success && (
          <p
            className="rounded-xl border border-teal-200 bg-mint px-4 py-3 text-sm font-medium text-slateDark"
            role="status"
          >
            {success}
          </p>
        )}
        {loading ? (
          <div className="rounded-3xl bg-white p-8 text-slateDark">Loading users and roles…</div>
        ) : (
          <>
            <section className="rounded-3xl border border-mutedSlate/25 bg-white p-5 shadow-sm sm:p-6">
              <SignupDomainSettings />
            </section>
            <section className="rounded-3xl border border-mutedSlate/25 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-wrap gap-3">
                {roles.map((role) => (
                  <div className="min-w-40 rounded-2xl bg-mint/60 px-4 py-3" key={role.id}>
                    <p className="text-xs font-bold uppercase tracking-wide text-slateDark/65">
                      {role.name}
                    </p>
                    <p className="mt-1 text-2xl font-bold text-slateDark">
                      {roleCounts.get(role.id)?.size ?? 0}
                    </p>
                    <p className="text-xs text-slateDark/65">active users</p>
                  </div>
                ))}
              </div>
            </section>
            <section className="rounded-3xl border border-mutedSlate/25 bg-white p-5 shadow-sm sm:p-6">
              <p className="text-sm font-semibold text-slateDark/70">Find a user</p>
              <h2 className="mt-1 text-xl font-bold text-slateDark">Search users</h2>
              <form
                className="mt-4 flex flex-col gap-3 sm:flex-row"
                onSubmit={(event) => {
                  event.preventDefault();
                  void searchUsers();
                }}
              >
                <label className="sr-only" htmlFor="user-search">
                  Search users by name
                </label>
                <input
                  className="w-full rounded-xl border border-mutedSlate/50 bg-white px-3 py-2.5 text-sm text-slateDark outline-none focus:border-aqua focus:ring-4 focus:ring-aqua/35"
                  id="user-search"
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by full name"
                  value={search}
                />
                <button
                  className="rounded-xl bg-aqua px-5 py-2.5 text-sm font-bold text-slateDark transition hover:bg-aqua/80 focus:outline-none focus:ring-4 focus:ring-aqua/45"
                  type="submit"
                >
                  Search
                </button>
              </form>
              {users.length > 0 && (
                <div className="mt-4 grid gap-2 sm:grid-cols-2" aria-label="User search results">
                  {users.map((user) => (
                    <button
                      className={`rounded-xl border px-4 py-3 text-left text-sm transition focus:outline-none focus:ring-4 focus:ring-aqua/40 ${selectedUserId === user.id ? 'border-aqua bg-mint' : 'border-mutedSlate/30 hover:bg-pink'}`}
                      key={user.id}
                      onClick={() => setSelectedUserId(user.id)}
                      type="button"
                    >
                      <span className="block font-bold text-slateDark">
                        {user.full_name || 'Unnamed user'}
                      </span>
                      <span className="mt-1 block break-all text-xs text-slateDark/60">
                        {user.id}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {search.trim().length >= 2 && users.length === 0 && (
                <p className="mt-4 text-sm text-slateDark/70">No matching users found.</p>
              )}
            </section>
            {selectedUser && (
              <RoleAssignmentForm
                assignments={selectedAssignments}
                clubs={clubs}
                currentRole={currentRole}
                error={error}
                onAssignClubHead={handleAssignClubHead}
                onRevokeClubHead={handleRevokeClubHead}
                onRoleChange={handleRoleChange}
                roles={roles}
                submitting={submitting}
                userId={selectedUser.id}
                userName={selectedUser.full_name}
              />
            )}
          </>
        )}
      </div>
    </Can>
  );
}
