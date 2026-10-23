import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  cancelEventRegistration,
  getStudentEvent,
  listMyEventRegistrations,
  registerForEvent,
  type StudentEvent,
} from '@club-management/shared';
import { useAuth } from '../context/AuthContext';
import { useRole } from '../hooks/usePermission';
import { useManagedClubs } from '../features/events/useManagedClubs';
import { errorMessage } from '../features/clubs/types';
import {
  eventStatusLabel,
  formatEventDate,
  panelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from '../features/events/eventUtils';
import { supabase } from '../lib/supabase';

export function EventDetailPage() {
  const { eventId = '' } = useParams();
  const { user } = useAuth();
  const { allowed: isStudent } = useRole('student');
  const { clubs: managedClubs } = useManagedClubs();
  const [event, setEvent] = useState<StudentEvent | null>(null);
  const [registrationStatus, setRegistrationStatus] = useState<'REGISTERED' | 'CANCELLED' | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [overlapWarning, setOverlapWarning] = useState<{ count: number; sampleTitle: string } | null>(null);
  const registrationInFlight = useRef(false);
  const canRegister = isStudent || managedClubs.length > 0;
  const canManage = event ? managedClubs.some((club) => club.id === event.club_id) : false;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await getStudentEvent(supabase, eventId);
      setEvent(result);
      if (result && user) {
        const own = await supabase.from('event_registrations')
          .select('status')
          .eq('event_id', eventId)
          .eq('student_id', user.id)
          .maybeSingle();
        if (own.error) throw own.error;
        setRegistrationStatus((own.data?.status as 'REGISTERED' | 'CANCELLED' | undefined) ?? null);
      }
    } catch (loadError) {
      setError(errorMessage(loadError));
      setEvent(null);
    } finally {
      setLoading(false);
    }
  }, [eventId, user]);

  useEffect(() => { void load(); }, [load]);

  async function changeRegistration(skipOverlapCheck = false) {
    if (!event || registrationInFlight.current) return;
    registrationInFlight.current = true;
    setWorking(true);
    setError('');
    setSuccess('');
    try {
      if (registrationStatus === 'REGISTERED') {
        if (!window.confirm(`Cancel your registration for “${event.title}”?`)) return;
        await cancelEventRegistration(supabase, event.event_id);
        setSuccess('Your registration was cancelled.');
        setRegistrationStatus('CANCELLED');
      } else {
        if (!skipOverlapCheck) {
          const registrations = await listMyEventRegistrations(supabase, { limit: 100, offset: 0 });
          let allRegistrations = registrations;
          for (let offset = 100; registrations.length === 100; offset += 100) {
            const page = await listMyEventRegistrations(supabase, { limit: 100, offset });
            allRegistrations = allRegistrations.concat(page);
            if (page.length < 100) break;
          }
          const overlaps = allRegistrations.filter((registration) =>
            registration.registration_status === 'REGISTERED'
            && ['PUBLISHED', 'POSTPONED'].includes(registration.event_status)
            && registration.event_id !== event.event_id
            && new Date(registration.start_time).getTime() < new Date(event.end_time).getTime()
            && new Date(registration.end_time).getTime() > new Date(event.start_time).getTime(),
          );
          if (overlaps.length) {
            setOverlapWarning({ count: overlaps.length, sampleTitle: overlaps[0].title });
            return;
          }
        }
        setOverlapWarning(null);
        await registerForEvent(supabase, event.event_id);
        setSuccess('You are registered for this event.');
        setRegistrationStatus('REGISTERED');
      }
      await load();
    } catch (changeError) {
      setError(errorMessage(changeError));
    } finally {
      registrationInFlight.current = false;
      setWorking(false);
    }
  }

  if (loading) return <p role="status" className="py-8 text-center">Loading event…</p>;
  if (error && !event) return <div className="space-y-4"><p role="alert" className="rounded-2xl bg-rose-50 p-4 text-rose-800">{error}</p><Link to="/events" className={secondaryButtonClass}>Back to events</Link></div>;
  if (!event) return <p className={`${panelClass} text-sm`}>Event not found or is not available.</p>;

  const registrationClosed = event.registration_availability === 'CLOSED' || event.status !== 'PUBLISHED';
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link className="text-sm font-bold text-slateDark underline decoration-aqua decoration-2 underline-offset-4" to="/events">← All events</Link>
      <article className={panelClass}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><p className="text-sm font-semibold text-slateDark/65">{event.club_name}</p><h1 className="mt-1 text-3xl font-bold">{event.title}</h1></div>
          <span className="rounded-full bg-mint px-3 py-1.5 text-sm font-bold">{eventStatusLabel(event.status)}</span>
        </div>
        <p className="mt-5 whitespace-pre-wrap text-slateDark/80">{event.description || 'No description provided.'}</p>
        <dl className="mt-7 grid gap-4 border-t border-mutedSlate/25 pt-5 sm:grid-cols-2">
          <Detail label="Venue" value={event.venue} />
          <Detail label="Category" value={event.category || 'Uncategorized'} />
          <Detail label="Starts" value={formatEventDate(event.start_time)} />
          <Detail label="Ends" value={formatEventDate(event.end_time)} />
          <Detail label="Registration deadline" value={formatEventDate(event.registration_deadline)} />
          <Detail label="Capacity" value={`${event.registration_count} registered of ${event.capacity}`} />
          <Detail label="Availability" value={event.registration_availability === 'AVAILABLE' ? 'Open' : event.registration_availability === 'FULL' ? 'Full' : 'Closed'} />
        </dl>
        {error && <p role="alert" className="mt-5 rounded-2xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
        {success && <p role="status" className="mt-5 rounded-2xl bg-mint p-3 text-sm font-medium">{success}</p>}
        <div className="mt-6 flex flex-wrap gap-3">
          {canRegister && (registrationStatus === 'REGISTERED' ? (
            <button className={secondaryButtonClass} disabled={working} onClick={() => void changeRegistration()} type="button">{working ? 'Updating…' : 'Cancel registration'}</button>
          ) : (
            <button className={primaryButtonClass} disabled={working || registrationClosed || event.registration_availability === 'FULL'} onClick={() => void changeRegistration()} type="button">
              {working ? 'Registering…' : registrationClosed ? 'Registration closed' : event.registration_availability === 'FULL' ? 'Event full' : registrationStatus === 'CANCELLED' ? 'Register again' : 'Register'}
            </button>
          ))}
          {canManage && <Link className={secondaryButtonClass} to={`/manage-events/${event.event_id}`}>Manage this event</Link>}
          <Link className={secondaryButtonClass} to="/my-registrations">My registrations</Link>
        </div>
      </article>
      {overlapWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slateDark/60 p-4" onKeyDown={(e) => { if (e.key === 'Escape') setOverlapWarning(null); }}>
          <section
            aria-labelledby="registration-overlap-title"
            aria-modal="true"
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
            role="dialog"
          >
            <h2 className="text-xl font-bold" id="registration-overlap-title">Overlapping event registration</h2>
            <p className="mt-3 text-sm leading-6 text-slateDark/80">
              {overlapWarning.count === 1
                ? <>You are already registered for <strong>{overlapWarning.sampleTitle}</strong> at a time that overlaps this event.</>
                : <>You are already registered for <strong>{overlapWarning.count} events</strong> that overlap this event, including <strong>{overlapWarning.sampleTitle}</strong>.</>}
              {' '}Would you like to continue registering for <strong>{event.title}</strong>?
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button autoFocus className={secondaryButtonClass} onClick={() => setOverlapWarning(null)} type="button">Cancel</button>
              <button className={primaryButtonClass} onClick={() => { setOverlapWarning(null); void changeRegistration(true); }} type="button">Continue</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs font-bold uppercase tracking-wide text-slateDark/60">{label}</dt><dd className="mt-1 font-semibold">{value}</dd></div>;
}
