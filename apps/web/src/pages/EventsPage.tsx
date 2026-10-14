import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { listStudentEvents, type StudentEvent } from '@club-management/shared';
import { useRole } from '../hooks/usePermission';
import { supabase } from '../lib/supabase';
import { errorMessage, type Club } from '../features/clubs/types';
import {
  eventStatusLabel,
  fieldClass,
  formatEventDate,
  panelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from '../features/events/eventUtils';
import { useManagedClubs } from '../features/events/useManagedClubs';

type Filters = { search: string; clubId: string; category: string; from: string; to: string };
const emptyFilters: Filters = { search: '', clubId: '', category: '', from: '', to: '' };
const pageSize = 50;

export function EventsPage() {
  const [filters, setFilters] = useState(emptyFilters);
  const [applied, setApplied] = useState(emptyFilters);
  const [events, setEvents] = useState<StudentEvent[]>([]);
  const [clubs, setClubs] = useState<Pick<Club, 'id' | 'name'>[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const { allowed: isStudent } = useRole('student');
  const { clubs: managedClubs } = useManagedClubs();
  const { allowed: isAdmin } = useRole('admin');
  const canRegister = isStudent || managedClubs.length > 0;

  useEffect(() => {
    let active = true;
    void supabase
      .from('clubs')
      .select('id, name')
      .eq('is_active', true)
      .order('name')
      .then(({ data, error: resultError }) => {
        if (!active) return;
        if (resultError) setError(errorMessage(resultError));
        else setClubs(data ?? []);
      });
    return () => {
      active = false;
    };
  }, []);

  const loadPage = useCallback(async (nextFilters: Filters, offset: number, append: boolean) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError('');
    try {
      const rows = await listStudentEvents(supabase, {
        search: nextFilters.search.trim() || null,
        clubId: nextFilters.clubId || null,
        category: nextFilters.category || null,
        startFrom: nextFilters.from ? new Date(`${nextFilters.from}T00:00:00`).toISOString() : null,
        startTo: nextFilters.to
          ? new Date(new Date(`${nextFilters.to}T00:00:00`).getTime() + 86_400_000).toISOString()
          : null,
        limit: pageSize,
        offset,
      });
      setEvents((current) => (append ? [...current, ...rows] : rows));
      setHasMore(rows.length === pageSize);
    } catch (loadError) {
      setError(errorMessage(loadError));
      if (!append) setEvents([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    void loadPage(applied, 0, false);
  }, [applied, loadPage]);

  const categories = useMemo(
    () => [...new Set(events.map((event) => event.category).filter((v): v is string => !!v))].sort(),
    [events],
  );

  function submitFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (filters.from && filters.to && filters.to < filters.from) {
      setError('The end date must be the same as or later than the start date.');
      return;
    }
    setApplied({ ...filters });
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slateDark/70">Discover</p>
          <h1 className="mt-1 text-3xl font-bold">Campus events</h1>
          <p className="mt-2 text-sm text-slateDark/75">
            Browse published events across active clubs.
          </p>
        </div>
        {managedClubs.length > 0 && (
          <Link className={primaryButtonClass} to="/manage-events">
            Manage my events
          </Link>
        )}
        {isAdmin && managedClubs.length === 0 && (
          <span className="text-sm text-slateDark/65">Administrator view</span>
        )}
      </header>

      <form className={`${panelClass} grid gap-4 md:grid-cols-2 xl:grid-cols-5`} onSubmit={submitFilters}>
        <label className="space-y-2 text-sm font-semibold" htmlFor="event-search">
          Search events
          <input id="event-search" className={fieldClass} value={filters.search} maxLength={200}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })} placeholder="Title or description" />
        </label>
        <label className="space-y-2 text-sm font-semibold" htmlFor="event-club">
          Club
          <select id="event-club" className={fieldClass} value={filters.clubId}
            onChange={(e) => setFilters({ ...filters, clubId: e.target.value })}>
            <option value="">All clubs</option>
            {clubs.map((club) => <option key={club.id} value={club.id}>{club.name}</option>)}
          </select>
        </label>
        <label className="space-y-2 text-sm font-semibold" htmlFor="event-category">
          Category
          <input id="event-category" list="event-category-options" className={fieldClass} value={filters.category}
            onChange={(e) => setFilters({ ...filters, category: e.target.value })} placeholder="All categories" />
          <datalist id="event-category-options">{categories.map((category) => <option key={category}>{category}</option>)}</datalist>
        </label>
        <label className="space-y-2 text-sm font-semibold" htmlFor="event-from">
          Starts from
          <input id="event-from" type="date" className={fieldClass} value={filters.from}
            onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
        </label>
        <label className="space-y-2 text-sm font-semibold" htmlFor="event-to">
          Starts by
          <input id="event-to" type="date" className={fieldClass} value={filters.to}
            onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
        </label>
        <div className="flex gap-2 md:col-span-2 xl:col-span-5">
          <button className={primaryButtonClass} type="submit">Apply filters</button>
          <button className={secondaryButtonClass} type="button" onClick={() => { setFilters(emptyFilters); setApplied(emptyFilters); }}>
            Clear
          </button>
          {!canRegister && <span className="self-center text-xs text-slateDark/65">Registration is available to students and active club heads.</span>}
        </div>
      </form>

      {error && <p role="alert" className="rounded-2xl bg-rose-50 p-4 text-sm font-medium text-rose-800">{error}</p>}
      {loading ? <p role="status" className="py-8 text-center text-slateDark/70">Loading events…</p> : events.length === 0 ? (
        <div className={`${panelClass} text-center`}><h2 className="font-bold">No events found</h2><p className="mt-1 text-sm text-slateDark/70">Try changing your search or filters.</p></div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {events.map((event) => <EventCard event={event} key={event.event_id} />)}
        </div>
      )}
      {!loading && hasMore && <div className="text-center"><button className={secondaryButtonClass} disabled={loadingMore} onClick={() => void loadPage(applied, events.length, true)} type="button">{loadingMore ? 'Loading…' : 'Load more events'}</button></div>}
    </div>
  );
}

export function EventCard({ event }: { event: StudentEvent }) {
  return (
    <article className={`${panelClass} flex flex-col`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-slateDark/65">{event.club_name}</p>
        <span className="rounded-full bg-mint px-2.5 py-1 text-xs font-bold">{eventStatusLabel(event.status)}</span>
      </div>
      <h2 className="mt-3 text-xl font-bold">{event.title}</h2>
      <p className="mt-2 line-clamp-3 flex-1 text-sm text-slateDark/75">{event.description || 'No description provided.'}</p>
      <dl className="mt-5 space-y-2 text-sm">
        <div><dt className="inline font-semibold">When: </dt><dd className="inline">{formatEventDate(event.start_time)}</dd></div>
        <div><dt className="inline font-semibold">Where: </dt><dd className="inline">{event.venue}</dd></div>
        <div><dt className="inline font-semibold">Availability: </dt><dd className="inline">{event.registration_availability === 'FULL' ? 'Full' : event.registration_availability === 'CLOSED' ? 'Closed' : `${event.registration_count} / ${event.capacity} registered`}</dd></div>
      </dl>
      <Link className={`${secondaryButtonClass} mt-5`} to={`/events/${event.event_id}`}>View details</Link>
    </article>
  );
}
