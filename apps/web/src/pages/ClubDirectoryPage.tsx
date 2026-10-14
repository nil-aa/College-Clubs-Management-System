import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useRole } from '../hooks/usePermission';
import { supabase } from '../lib/supabase';
import { errorMessage, inputClass, type Club } from '../features/clubs/types';

export function ClubDirectoryPage() {
  const { user } = useAuth();
  const { allowed: isClubHead } = useRole('club_head');
  const [clubs, setClubs] = useState<Club[]>([]);
  const [myClubIds, setMyClubIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const clubResult = await supabase.from('clubs').select('*').order('name');
    if (clubResult.error) setError(errorMessage(clubResult.error));
    else setClubs((clubResult.data ?? []) as Club[]);
    if (user && isClubHead) {
      const roleResult = await supabase.from('roles').select('id').eq('code', 'club_head').single();
      if (!roleResult.error) {
        const assignments = await supabase
          .from('user_roles')
          .select('club_id')
          .eq('user_id', user.id)
          .eq('role_id', roleResult.data.id)
          .eq('status', 'active');
        setMyClubIds(
          (assignments.data ?? [])
            .map((row) => row.club_id)
            .filter((id): id is string => Boolean(id)),
        );
      }
    }
    setLoading(false);
  }, [isClubHead, user]);

  useEffect(() => {
    void load();
  }, [load]);
  const categories = useMemo(
    () =>
      [
        ...new Set(
          clubs
            .filter((club) => club.is_active)
            .map((club) => club.category)
            .filter((value): value is string => Boolean(value)),
        ),
      ].sort(),
    [clubs],
  );
  const visible = useMemo(
    () =>
      clubs.filter((club) => {
        const term = search.trim().toLowerCase();
        return (
          club.is_active &&
          (!term || `${club.name} ${club.description ?? ''}`.toLowerCase().includes(term)) &&
          (category === 'all' || club.category === category)
        );
      }),
    [category, clubs, search],
  );
  const mine = useMemo(
    () => clubs.filter((club) => myClubIds.includes(club.id)),
    [clubs, myClubIds],
  );

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-semibold text-slateDark/70">Explore</p>
        <h1 className="mt-1 text-3xl font-bold">Club directory</h1>
        <p className="mt-2 text-sm text-slateDark/75">
          Discover active clubs and learn how to connect with them.
        </p>
      </div>
      {isClubHead && (
        <section>
          <div className="mb-4">
            <h2 className="text-xl font-bold">My Clubs</h2>
            <p className="text-sm text-slateDark/70">Clubs you manage, including inactive clubs.</p>
          </div>
          {mine.length === 0 ? (
            <p className="rounded-2xl bg-white p-5 text-sm text-slateDark/70">
              You have no club assignments yet.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {mine.map((club) => (
                <ClubCard club={club} key={club.id} />
              ))}
            </div>
          )}
        </section>
      )}
      <section className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-[1fr_14rem]">
          <label className="sr-only" htmlFor="directory-search">
            Search clubs
          </label>
          <input
            className={inputClass}
            id="directory-search"
            placeholder="Search active clubs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            aria-label="Filter club category"
            className={inputClass}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="all">All categories</option>
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
        {error && (
          <p
            className="rounded-xl border border-rose-200 bg-pink px-4 py-3 text-sm text-rose-900"
            role="alert"
          >
            {error}
          </p>
        )}
        {loading ? (
          <p className="rounded-2xl bg-white p-6 text-sm">Loading clubs…</p>
        ) : visible.length === 0 ? (
          <p className="rounded-2xl bg-white p-6 text-sm text-slateDark/70">
            No active clubs match your search.
          </p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((club) => (
              <ClubCard club={club} key={club.id} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ClubCard({ club }: { club: Club }) {
  return (
    <Link
      className="group rounded-3xl border border-mutedSlate/25 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-aqua focus:outline-none focus:ring-4 focus:ring-aqua/40"
      to={`/clubs/${club.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg font-bold group-hover:underline">{club.name}</h3>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-bold ${club.is_active ? 'bg-mint' : 'bg-pink'}`}
        >
          {club.is_active ? 'Active' : 'Inactive'}
        </span>
      </div>
      <p className="mt-2 text-sm font-semibold text-slateDark/70">
        {club.category || 'Student club'}
      </p>
      <p className="mt-3 line-clamp-3 text-sm text-slateDark/75">
        {club.description || 'No description yet.'}
      </p>
    </Link>
  );
}
