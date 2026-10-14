import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getClubHeads } from '@club-management/shared';
import { usePermission } from '../hooks/usePermission';
import { supabase } from '../lib/supabase';
import { EventsSection } from '../features/clubs/EventsSection';
import { errorMessage, type Club, type ClubHead } from '../features/clubs/types';

export function ClubDetailPage() {
  const { clubId } = useParams();
  const { allowed: canAdmin } = usePermission('users.manage');
  const [club, setClub] = useState<Club | null>(null);
  const [heads, setHeads] = useState<ClubHead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!clubId) return;
    void (async () => {
      const result = await supabase.from('clubs').select('*').eq('id', clubId).maybeSingle();
      if (result.error || !result.data)
        setError(result.error ? errorMessage(result.error) : 'Club not found or unavailable.');
      else {
        setClub(result.data as Club);
        try {
          setHeads((await getClubHeads(supabase, clubId)) as ClubHead[]);
        } catch (headError) {
          setError(errorMessage(headError));
        }
      }
      setLoading(false);
    })();
  }, [clubId]);
  if (loading) return <div className="rounded-3xl bg-white p-8">Loading club…</div>;
  if (error || !club)
    return (
      <section className="rounded-3xl border border-rose-200 bg-pink p-8" role="alert">
        <h1 className="text-2xl font-bold">Club unavailable</h1>
        <p className="mt-2">{error || 'This club is not available to your account.'}</p>
      </section>
    );
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            className="text-sm font-bold text-slateDark underline decoration-aqua decoration-2 underline-offset-4"
            to="/clubs"
          >
            ← Club directory
          </Link>
          <h1 className="mt-3 text-3xl font-bold">{club.name}</h1>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full bg-lilac/60 px-3 py-1 text-xs font-bold">
              {club.category || 'Student club'}
            </span>
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ${club.is_active ? 'bg-mint' : 'bg-pink'}`}
            >
              {club.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>
        {canAdmin && (
          <Link
            className="rounded-xl bg-aqua px-4 py-2.5 text-sm font-bold hover:bg-aqua/80 focus:outline-none focus:ring-4 focus:ring-aqua/45"
            to={`/clubs/${club.id}/manage`}
          >
            Manage club
          </Link>
        )}
      </div>
      <section className="rounded-3xl border border-mutedSlate/25 bg-white p-5 shadow-sm sm:p-7">
        <h2 className="text-xl font-bold">About this club</h2>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slateDark/80">
          {club.description || 'No description yet.'}
        </p>
        {club.contact_email && (
          <p className="mt-5 text-sm">
            <span className="font-bold">Contact:</span>{' '}
            <a
              className="text-slateDark underline decoration-aqua decoration-2 underline-offset-4"
              href={`mailto:${club.contact_email}`}
            >
              {club.contact_email}
            </a>
          </p>
        )}
      </section>
      <section className="rounded-3xl border border-mutedSlate/25 bg-white p-5 shadow-sm sm:p-7">
        <h2 className="text-xl font-bold">Club heads</h2>
        {heads.length === 0 ? (
          <p className="mt-3 text-sm text-slateDark/70">No active club heads assigned.</p>
        ) : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {heads.map((head) => (
              <li className="rounded-2xl bg-mint/60 px-4 py-3 text-sm font-semibold" key={head.id}>
                {head.full_name}
              </li>
            ))}
          </ul>
        )}
      </section>
      <EventsSection clubId={club.id} />
    </div>
  );
}
