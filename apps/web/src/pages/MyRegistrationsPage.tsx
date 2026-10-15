import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listMyEventRegistrations, type MyEventRegistration } from '@club-management/shared';
import type { Database } from '@club-management/shared';
import { useRole } from '../hooks/usePermission';
import { errorMessage } from '../features/clubs/types';
import { eventStatusLabel, formatEventDate, panelClass, secondaryButtonClass } from '../features/events/eventUtils';
import { supabase } from '../lib/supabase';

export function MyRegistrationsPage() {
  const [registrations, setRegistrations] = useState<MyEventRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attendanceByEvent, setAttendanceByEvent] = useState<Record<string, { status: string | null; finalized: boolean }>>({});
  const { allowed: isStudent } = useRole('student');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [registrationRows, participationResult] = await Promise.all([
        listMyEventRegistrations(supabase, { limit: 100 }),
        supabase.rpc('list_my_event_participation'),
      ]);
      setRegistrations(registrationRows);
      if (participationResult.error) throw participationResult.error;
      const participation = (participationResult.data ?? []) as Database['public']['Functions']['list_my_event_participation']['Returns'];
      setAttendanceByEvent(Object.fromEntries(participation.map((row) => [row.event_id, {
        status: row.attendance_status,
        finalized: row.attendance_finalized,
      }])));
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const now = Date.now();
  const cancelledEvents = registrations.filter((row) => row.event_status === 'CANCELLED');
  const upcoming = registrations.filter((row) => row.event_status !== 'CANCELLED' && row.registration_status === 'REGISTERED' && new Date(row.start_time).getTime() > now);
  const completed = registrations.filter((row) => row.event_status !== 'CANCELLED' && row.registration_status === 'REGISTERED' && new Date(row.start_time).getTime() <= now);
  const past = registrations.filter((row) => !upcoming.includes(row) && !cancelledEvents.includes(row) && !completed.includes(row));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-semibold text-slateDark/70">Your events</p><h1 className="mt-1 text-3xl font-bold">My registrations</h1><p className="mt-2 text-sm text-slateDark/75">Upcoming events and your registration history.</p></div><button onClick={() => void load()} className={secondaryButtonClass} type="button" disabled={loading}>Refresh</button></header>
      {!isStudent && <p className="rounded-2xl bg-aqua/15 p-3 text-sm">Club Heads can also register for events outside their assigned clubs.</p>}
      {error && <p role="alert" className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-800">{error}</p>}
      {loading ? <p role="status" className="py-8 text-center">Loading registrations…</p> : <>
        <RegistrationSection title="Upcoming" items={upcoming} empty="You have no upcoming registrations." />
        <RegistrationSection title="Cancelled events" items={cancelledEvents} empty="You have no cancelled events." />
        <RegistrationSection title="Completed events" items={completed} empty="You have no completed events." attendanceByEvent={attendanceByEvent} />
        <RegistrationSection title="Registration history" items={past} empty="Past and cancelled registrations will appear here." />
      </>}
    </div>
  );
}

function RegistrationSection({ title, items, empty, attendanceByEvent }: {
  title: string;
  items: MyEventRegistration[];
  empty: string;
  attendanceByEvent?: Record<string, { status: string | null; finalized: boolean }>;
}) {
  return <section className="space-y-3"><h2 className="text-xl font-bold">{title}</h2>{items.length === 0 ? <p className={`${panelClass} text-sm text-slateDark/70`}>{empty}</p> : items.map((item) => (
    <article className={`${panelClass} flex flex-wrap items-center justify-between gap-4`} key={item.registration_id}>
      <div><p className="text-sm font-semibold text-slateDark/65">{item.club_name} · {formatEventDate(item.start_time)}</p><h3 className="mt-1 text-lg font-bold">{item.title}</h3><p className="mt-1 text-sm">{item.venue} · {eventStatusLabel(item.event_status)}</p>{attendanceByEvent && <p className="mt-1 text-sm font-semibold">{attendanceByEvent[item.event_id]?.finalized && attendanceByEvent[item.event_id]?.status === 'PRESENT' ? 'Attended' : 'Not attended'}</p>}</div>
      <div className="flex items-center gap-3"><span className={`rounded-full px-3 py-1 text-xs font-bold ${item.registration_status === 'REGISTERED' ? 'bg-mint' : 'bg-pink'}`}>{eventStatusLabel(item.registration_status)}</span><Link className={secondaryButtonClass} to={`/events/${item.event_id}`}>Details</Link></div>
    </article>
  ))}</section>;
}
