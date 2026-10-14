import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClub, setClubActive, updateClub } from '@club-management/shared';
import { Can } from '../components/Can';
import { usePermission } from '../hooks/usePermission';
import { supabase } from '../lib/supabase';
import { ClubForm, type ClubFormValues } from '../features/clubs/ClubForm';
import { errorMessage, isDuplicateClubError, type Club, inputClass } from '../features/clubs/types';
import { Link } from 'react-router-dom';

export function ManageClubsPage() {
  const { allowed, loading: permissionLoading } = usePermission('users.manage');
  const [clubs, setClubs] = useState<Club[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [editing, setEditing] = useState<Club | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadClubs = useCallback(async () => {
    setLoading(true);
    const result = await supabase.from('clubs').select('*').order('name');
    if (result.error) setError(errorMessage(result.error));
    else setClubs((result.data ?? []) as Club[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (allowed) void loadClubs();
  }, [allowed, loadClubs]);

  const filteredClubs = useMemo(() => {
    const term = search.trim().toLowerCase();
    return clubs.filter((club) => {
      const matchesTerm =
        !term || `${club.name} ${club.category ?? ''}`.toLowerCase().includes(term);
      const matchesStatus =
        status === 'all' || (status === 'active' ? club.is_active : !club.is_active);
      return matchesTerm && matchesStatus;
    });
  }, [clubs, search, status]);

  async function saveClub(values: ClubFormValues) {
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      if (editing)
        await updateClub(
          supabase,
          editing.id,
          values.name,
          values.description,
          values.category,
          values.contactEmail,
        );
      else
        await createClub(
          supabase,
          values.name,
          values.description,
          values.category,
          values.contactEmail,
        );
      setSuccess(editing ? 'Club updated.' : 'Club created.');
      setEditing(null);
      setShowCreate(false);
      await loadClubs();
    } catch (saveError) {
      setError(
        isDuplicateClubError(saveError)
          ? 'A club with this name already exists.'
          : errorMessage(saveError),
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleClub(club: Club) {
    const next = !club.is_active;
    if (!window.confirm(`${next ? 'Activate' : 'Deactivate'} ${club.name}?`)) return;
    setError('');
    try {
      await setClubActive(supabase, club.id, next);
      setSuccess(`${club.name} is now ${next ? 'active' : 'inactive'}.`);
      await loadClubs();
    } catch (toggleError) {
      setError(errorMessage(toggleError));
    }
  }

  if (permissionLoading)
    return <div className="rounded-3xl bg-white p-8">Checking permissions…</div>;

  return (
    <Can
      permission="users.manage"
      fallback={
        <section className="rounded-3xl border border-rose-200 bg-pink p-8" role="alert">
          <h1 className="text-2xl font-bold">Manage Clubs</h1>
          <p className="mt-2">Only admins can manage clubs.</p>
        </section>
      }
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slateDark/70">Administration</p>
            <h1 className="mt-1 text-3xl font-bold">Manage Clubs</h1>
            <p className="mt-2 text-sm text-slateDark/75">
              Create, update and deactivate clubs without deleting their history.
            </p>
          </div>
          <button
            className="rounded-xl bg-aqua px-4 py-2.5 text-sm font-bold text-slateDark hover:bg-aqua/80 focus:outline-none focus:ring-4 focus:ring-aqua/45"
            onClick={() => {
              setEditing(null);
              setShowCreate(true);
            }}
            type="button"
          >
            Create club
          </button>
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
            className="rounded-xl border border-teal-200 bg-mint px-4 py-3 text-sm font-medium"
            role="status"
          >
            {success}
          </p>
        )}
        {(showCreate || editing) && (
          <section className="rounded-3xl border border-mutedSlate/25 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="mb-5 text-xl font-bold">
              {editing ? `Edit ${editing.name}` : 'Create a club'}
            </h2>
            <ClubForm
              initialClub={editing}
              onSubmit={saveClub}
              onCancel={() => {
                setEditing(null);
                setShowCreate(false);
              }}
              serverError=""
              submitting={submitting}
            />
          </section>
        )}
        <section className="rounded-3xl border border-mutedSlate/25 bg-white p-5 shadow-sm sm:p-6">
          <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
            <label className="sr-only" htmlFor="club-search">
              Search clubs
            </label>
            <input
              className={inputClass}
              id="club-search"
              placeholder="Search by name or category"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className={inputClass}
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
              aria-label="Filter club status"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          {loading ? (
            <p className="mt-6 text-sm text-slateDark/70">Loading clubs…</p>
          ) : filteredClubs.length === 0 ? (
            <p className="mt-6 text-sm text-slateDark/70">No clubs match these filters.</p>
          ) : (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead className="border-b border-mutedSlate/25 text-xs uppercase tracking-wide text-slateDark/65">
                  <tr>
                    <th className="px-3 py-3">Club</th>
                    <th className="px-3 py-3">Category</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClubs.map((club) => (
                    <tr className="border-b border-mutedSlate/15 last:border-0" key={club.id}>
                      <td className="px-3 py-4">
                        <Link
                          className="font-bold text-slateDark underline decoration-lilac decoration-2 underline-offset-4"
                          to={`/clubs/${club.id}`}
                        >
                          {club.name}
                        </Link>
                      </td>
                      <td className="px-3 py-4 text-slateDark/75">{club.category || '—'}</td>
                      <td className="px-3 py-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-bold ${club.is_active ? 'bg-mint text-slateDark' : 'bg-pink text-rose-950'}`}
                        >
                          {club.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-3 py-4 text-right">
                        <Can permission="users.manage">
                          <span className="inline-flex flex-wrap justify-end gap-2">
                            <button
                              className="rounded-lg border border-mutedSlate/40 px-3 py-1.5 text-xs font-bold hover:bg-pink focus:outline-none focus:ring-4 focus:ring-aqua/40"
                              onClick={() => {
                                setEditing(club);
                                setShowCreate(false);
                              }}
                              type="button"
                            >
                              Edit
                            </button>
                            <Link
                              className="rounded-lg border border-lilac px-3 py-1.5 text-xs font-bold hover:bg-lilac/40 focus:outline-none focus:ring-4 focus:ring-lilac/45"
                              to={`/clubs/${club.id}/manage`}
                            >
                              Heads
                            </Link>
                            <button
                              className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-bold text-rose-900 hover:bg-pink focus:outline-none focus:ring-4 focus:ring-pink"
                              onClick={() => void toggleClub(club)}
                              type="button"
                            >
                              {club.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                          </span>
                        </Can>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </Can>
  );
}
