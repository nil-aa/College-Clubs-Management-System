import { useCallback, useEffect, useMemo, useState } from 'react';
import { assignClubHead, getClubHeads, revokeClubHead, updateClub } from '@club-management/shared';
import { Link, useParams } from 'react-router-dom';
import { Can } from '../components/Can';
import { ClubForm, type ClubFormValues } from '../features/clubs/ClubForm';
import { errorMessage, type Club, type ClubHead, inputClass } from '../features/clubs/types';
import { usePermission } from '../hooks/usePermission';
import { supabase } from '../lib/supabase';

type User = { id: string; full_name: string; email: string };

export function ManageClubPage() {
  const { clubId } = useParams();
  const { allowed, loading: permissionLoading } = usePermission('users.manage');
  const [club, setClub] = useState<Club | null>(null);
  const [heads, setHeads] = useState<ClubHead[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const load = useCallback(async () => {
    if (!clubId) return;
    setLoading(true);
    const [clubResult, headsResult, usersResult] = await Promise.all([
      supabase.from('clubs').select('*').eq('id', clubId).maybeSingle(),
      getClubHeads(supabase, clubId).catch(() => []),
      supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('is_active', true)
        .order('full_name')
        .limit(100),
    ]);
    if (clubResult.error || !clubResult.data)
      setError(clubResult.error ? errorMessage(clubResult.error) : 'Club not found.');
    else setClub(clubResult.data as Club);
    setHeads(headsResult as ClubHead[]);
    setUsers((usersResult.data ?? []) as User[]);
    setLoading(false);
  }, [clubId]);
  useEffect(() => {
    if (allowed) void load();
  }, [allowed, load]);
  const eligible = useMemo(() => {
    const assigned = new Set(heads.map((head) => head.id));
    const term = search.trim().toLowerCase();
    return users.filter(
      (user) =>
        !assigned.has(user.id) &&
        (!term || `${user.full_name} ${user.email}`.toLowerCase().includes(term)),
    );
  }, [heads, search, users]);
  async function saveClub(values: ClubFormValues) {
    if (!clubId) return;
    setSaving(true);
    setError('');
    try {
      await updateClub(
        supabase,
        clubId,
        values.name,
        values.description,
        values.category,
        values.contactEmail,
      );
      setSuccess('Club details updated.');
      await load();
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }
  async function assign(user: User) {
    if (!clubId) return;
    setSaving(true);
    setError('');
    try {
      await assignClubHead(supabase, user.id, clubId);
      setSuccess(`${user.full_name} is now a Club Head for this club.`);
      setSearch('');
      await load();
    } catch (assignError) {
      setError(errorMessage(assignError));
    } finally {
      setSaving(false);
    }
  }
  async function revoke(head: ClubHead) {
    if (!clubId || !window.confirm(`Revoke ${head.full_name}'s Club Head assignment?`)) return;
    setSaving(true);
    setError('');
    try {
      await revokeClubHead(supabase, head.id, clubId);
      setSuccess(`${head.full_name}'s assignment was revoked.`);
      await load();
    } catch (revokeError) {
      setError(errorMessage(revokeError));
    } finally {
      setSaving(false);
    }
  }
  if (permissionLoading)
    return <div className="rounded-3xl bg-white p-8">Checking permissions…</div>;
  return (
    <Can
      permission="users.manage"
      fallback={
        <section className="rounded-3xl border border-rose-200 bg-pink p-8" role="alert">
          <h1 className="text-2xl font-bold">Manage club</h1>
          <p className="mt-2">Only admins can manage clubs.</p>
        </section>
      }
    >
      <div className="space-y-6">
        <div>
          <Link
            className="text-sm font-bold underline decoration-aqua decoration-2 underline-offset-4"
            to={clubId ? `/clubs/${clubId}` : '/clubs'}
          >
            ← Club details
          </Link>
          <h1 className="mt-3 text-3xl font-bold">
            {club ? `Manage ${club.name}` : 'Manage club'}
          </h1>
        </div>
        {error && (
          <p
            className="rounded-xl border border-rose-200 bg-pink px-4 py-3 text-sm text-rose-900"
            role="alert"
          >
            {error}
          </p>
        )}
        {success && (
          <p className="rounded-xl border border-teal-200 bg-mint px-4 py-3 text-sm" role="status">
            {success}
          </p>
        )}
        {loading ? (
          <p className="rounded-3xl bg-white p-8">Loading club…</p>
        ) : (
          club && (
            <>
              <section className="rounded-3xl border border-mutedSlate/25 bg-white p-5 shadow-sm sm:p-6">
                <h2 className="mb-5 text-xl font-bold">Club details</h2>
                <ClubForm initialClub={club} onSubmit={saveClub} submitting={saving} />
              </section>
              <section className="rounded-3xl border border-mutedSlate/25 bg-white p-5 shadow-sm sm:p-6">
                <h2 className="text-xl font-bold">Club heads</h2>
                <p className="mt-2 text-sm text-slateDark/70">
                  Assign active users to manage this club. Assignment changes are audited and
                  notified.
                </p>
                <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
                  <label className="sr-only" htmlFor="head-search">
                    Search eligible users
                  </label>
                  <input
                    className={inputClass}
                    id="head-search"
                    placeholder="Search users by name or email"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <span className="self-center text-sm text-slateDark/70">
                    {eligible.length} eligible
                  </span>
                </div>
                {search && (
                  <div className="mt-3 space-y-2">
                    {eligible.map((user) => (
                      <button
                        className="block w-full rounded-xl border border-mutedSlate/25 px-4 py-3 text-left text-sm hover:bg-mint focus:outline-none focus:ring-4 focus:ring-aqua/40"
                        disabled={saving}
                        key={user.id}
                        onClick={() => void assign(user)}
                        type="button"
                      >
                        <span className="font-bold">{user.full_name || 'Unnamed user'}</span>
                        <span className="ml-2 text-slateDark/65">{user.email}</span>
                      </button>
                    ))}
                    {eligible.length === 0 && (
                      <p className="text-sm text-slateDark/70">No eligible users found.</p>
                    )}
                  </div>
                )}
                {heads.length === 0 ? (
                  <p className="mt-5 rounded-2xl bg-mint/50 p-4 text-sm text-slateDark/70">
                    No active Club Heads are assigned yet.
                  </p>
                ) : (
                  <ul className="mt-5 space-y-2">
                    {heads.map((head) => (
                      <li
                        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-mutedSlate/20 px-4 py-3"
                        key={head.id}
                      >
                        <span className="font-semibold">{head.full_name}</span>
                        <button
                          className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-bold text-rose-900 hover:bg-pink focus:outline-none focus:ring-4 focus:ring-pink"
                          disabled={saving}
                          onClick={() => void revoke(head)}
                          type="button"
                        >
                          Revoke
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )
        )}
      </div>
    </Can>
  );
}
