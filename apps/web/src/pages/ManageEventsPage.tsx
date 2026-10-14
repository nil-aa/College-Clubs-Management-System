import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listManagedEvents, type ManagedEvent } from '@club-management/shared';
import { useManagedClubs } from '../features/events/useManagedClubs';
import { errorMessage } from '../features/clubs/types';
import { eventStatusLabel, formatEventDate, panelClass, primaryButtonClass, secondaryButtonClass } from '../features/events/eventUtils';
import { supabase } from '../lib/supabase';

export function ManageEventsPage() {
  const { clubs, loading: clubsLoading, error: clubsError } = useManagedClubs();
  const [events, setEvents] = useState<ManagedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try { setEvents(await listManagedEvents(supabase, { limit: 100 })); }
    catch (loadError) { setError(errorMessage(loadError)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  return <div className="space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-semibold text-slateDark/70">Club Head workspace</p><h1 className="mt-1 text-3xl font-bold">Manage events</h1><p className="mt-2 text-sm text-slateDark/75">Create and manage events for clubs assigned to you.</p></div><Link className={primaryButtonClass} to="/manage-events/new" aria-disabled={clubs.length === 0}>Create event</Link></header>
    {clubsError && <p role="alert" className="rounded-2xl bg-rose-50 p-4 text-rose-800">{clubsError}</p>}
    {error && <p role="alert" className="rounded-2xl bg-rose-50 p-4 text-rose-800">{error}</p>}
    <section className="space-y-3"><h2 className="text-xl font-bold">Your events</h2>{loading || clubsLoading ? <p role="status">Loading your events…</p> : events.length === 0 ? <div className={`${panelClass} text-sm text-slateDark/70`}>{clubs.length ? 'No events yet. Create a draft to get started.' : 'No active club assignments are available for event management.'}</div> : events.map((event) => (
      <article className={`${panelClass} flex flex-wrap items-center justify-between gap-4`} key={event.event_id}>
        <div><p className="text-sm font-semibold text-slateDark/65">{clubs.find((club) => club.id === event.club_id)?.name ?? 'Assigned club'} · {formatEventDate(event.start_time)}</p><h3 className="mt-1 text-lg font-bold">{event.title}</h3><p className="mt-1 text-sm">{eventStatusLabel(event.status)} · {event.registration_count} / {event.capacity} registered</p></div>
        <Link className={secondaryButtonClass} to={`/manage-events/${event.event_id}`}>Manage</Link>
      </article>
    ))}</section>
  </div>;
}
