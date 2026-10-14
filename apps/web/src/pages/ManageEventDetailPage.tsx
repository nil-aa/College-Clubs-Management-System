import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { cancelEvent, getManagedEvent, publishEvent, postponeEvent, type ManagedEvent } from '@club-management/shared';
import { errorMessage } from '../features/clubs/types';
import { eventStatusLabel, fieldClass, formatEventDate, localInputToIso, panelClass, primaryButtonClass, secondaryButtonClass, toDateTimeLocal } from '../features/events/eventUtils';
import { supabase } from '../lib/supabase';

export function ManageEventDetailPage() {
  const { eventId = '' } = useParams();
  const [event, setEvent] = useState<ManagedEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [postponeOpen, setPostponeOpen] = useState(false);
  const [schedule, setSchedule] = useState({ start: '', end: '', deadline: '' });

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const result = await getManagedEvent(supabase, eventId) as ManagedEvent | null;
      if (!result) throw new Error('Event not found or you are not authorized to manage it.');
      setEvent(result);
      setSchedule({ start: toDateTimeLocal(result.start_time), end: toDateTimeLocal(result.end_time), deadline: toDateTimeLocal(result.registration_deadline) });
    } catch (loadError) { setError(errorMessage(loadError)); setEvent(null); }
    finally { setLoading(false); }
  }, [eventId]);
  useEffect(() => { void load(); }, [load]);

  async function perform(action: 'publish' | 'cancel') {
    if (!event) return;
    if (action === 'cancel' && !window.confirm(`Cancel “${event.title}”? Registered participants will be notified.`)) return;
    setWorking(true); setError(''); setSuccess('');
    try {
      if (action === 'publish') { await publishEvent(supabase, event.event_id); setSuccess('Event published.'); }
      else { await cancelEvent(supabase, event.event_id); setSuccess('Event cancelled.'); }
      await load();
    } catch (actionError) { setError(errorMessage(actionError)); }
    finally { setWorking(false); }
  }

  async function submitPostpone(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!event) return;
    const start = new Date(schedule.start).getTime(); const end = new Date(schedule.end).getTime(); const deadline = new Date(schedule.deadline).getTime();
    if (![start, end, deadline].every(Number.isFinite)) return setError('Enter valid replacement dates and times.');
    if (end <= start) return setError('The new end time must be later than the new start time.');
    if (deadline > start) return setError('The new registration deadline must be no later than the new start time.');
    setWorking(true); setError(''); setSuccess('');
    try {
      await postponeEvent(supabase, event.event_id, { startTime: localInputToIso(schedule.start), endTime: localInputToIso(schedule.end), registrationDeadline: localInputToIso(schedule.deadline) });
      setPostponeOpen(false); setSuccess('Event postponed and participants notified.'); await load();
    } catch (actionError) { setError(errorMessage(actionError)); }
    finally { setWorking(false); }
  }

  if (loading) return <p role="status" className="py-8 text-center">Loading event…</p>;
  if (!event) return <div className="space-y-4"><p role="alert" className="rounded-2xl bg-rose-50 p-4 text-rose-800">{error || 'Event not found.'}</p><Link className={secondaryButtonClass} to="/manage-events">Back to managed events</Link></div>;
  const canEdit = ['DRAFT', 'PUBLISHED', 'POSTPONED'].includes(event.status);
  return <div className="mx-auto max-w-4xl space-y-5">
    <Link className="text-sm font-bold underline decoration-aqua decoration-2 underline-offset-4" to="/manage-events">← Manage events</Link>
    <section className={panelClass}>
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-semibold text-slateDark/65">Club Head event management</p><h1 className="mt-1 text-3xl font-bold">{event.title}</h1></div><span className="rounded-full bg-mint px-3 py-1.5 text-sm font-bold">{eventStatusLabel(event.status)}</span></div>
      {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
      {success && <p role="status" className="mt-4 rounded-xl bg-mint p-3 text-sm">{success}</p>}
      <p className="mt-4 whitespace-pre-wrap text-slateDark/75">{event.description || 'No description provided.'}</p>
      <dl className="mt-6 grid gap-4 border-t border-mutedSlate/25 pt-5 sm:grid-cols-2"><Detail label="Venue" value={event.venue} /><Detail label="Starts" value={formatEventDate(event.start_time)} /><Detail label="Ends" value={formatEventDate(event.end_time)} /><Detail label="Registration deadline" value={formatEventDate(event.registration_deadline)} /><Detail label="Capacity" value={String(event.capacity)} /><Detail label="Registered" value={`${event.registration_count} / ${event.capacity}`} /></dl>
      <div className="mt-6 flex flex-wrap gap-3">
        {canEdit && <Link className={secondaryButtonClass} to={`/manage-events/${event.event_id}/edit`}>Edit event</Link>}
        {['DRAFT', 'POSTPONED'].includes(event.status) && <button className={primaryButtonClass} disabled={working} onClick={() => void perform('publish')} type="button">{working ? 'Working…' : 'Publish event'}</button>}
        {event.status === 'PUBLISHED' && <button className={secondaryButtonClass} disabled={working} onClick={() => setPostponeOpen(true)} type="button">Postpone</button>}
        {['PUBLISHED', 'POSTPONED'].includes(event.status) && <button className="rounded-xl bg-rose-700 px-4 py-2.5 text-sm font-bold text-white focus:outline-none focus:ring-4 focus:ring-rose-300 disabled:opacity-60" disabled={working} onClick={() => void perform('cancel')} type="button">Cancel event</button>}
        {event.published_at && <Link className={secondaryButtonClass} to={`/events/${event.event_id}`}>Student view</Link>}
      </div>
      <p className="mt-5 rounded-2xl bg-lavender p-4 text-sm text-slateDark/75">Participant names are not available yet because the attendance module’s authorized participant-list API has not been added. The count above is from the managed-event API.</p>
    </section>
    {postponeOpen && <div className="fixed inset-0 z-50 grid place-items-center bg-slateDark/50 p-4"><section aria-labelledby="postpone-heading" aria-modal="true" className={`${panelClass} w-full max-w-xl`} role="dialog"><h2 id="postpone-heading" className="text-xl font-bold">Postpone event</h2><p className="mt-1 text-sm text-slateDark/70">Choose the replacement schedule. Registered participants will be notified.</p><form className="mt-5 space-y-4" onSubmit={(e) => void submitPostpone(e)}><label className="block space-y-2 text-sm font-semibold" htmlFor="new-start">New start<input id="new-start" type="datetime-local" required className={fieldClass} value={schedule.start} onChange={(e) => setSchedule({ ...schedule, start: e.target.value })} /></label><label className="block space-y-2 text-sm font-semibold" htmlFor="new-end">New end<input id="new-end" type="datetime-local" required className={fieldClass} value={schedule.end} onChange={(e) => setSchedule({ ...schedule, end: e.target.value })} /></label><label className="block space-y-2 text-sm font-semibold" htmlFor="new-deadline">New registration deadline<input id="new-deadline" type="datetime-local" required className={fieldClass} value={schedule.deadline} onChange={(e) => setSchedule({ ...schedule, deadline: e.target.value })} /></label><div className="flex gap-3"><button className={primaryButtonClass} disabled={working} type="submit">{working ? 'Postponing…' : 'Confirm postponement'}</button><button className={secondaryButtonClass} disabled={working} onClick={() => setPostponeOpen(false)} type="button">Close</button></div></form></section></div>}
  </div>;
}

function Detail({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs font-bold uppercase tracking-wide text-slateDark/60">{label}</dt><dd className="mt-1 font-semibold">{value}</dd></div>; }
