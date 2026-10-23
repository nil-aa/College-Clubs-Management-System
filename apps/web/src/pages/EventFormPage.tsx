import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { createEvent, getManagedEvent, updateEvent, type EventInput, type ManagedEvent } from '@club-management/shared';
import { FormField } from '../components/FormField';
import { errorMessage } from '../features/clubs/types';
import { fieldClass, localInputToIso, panelClass, primaryButtonClass, secondaryButtonClass, toDateTimeLocal } from '../features/events/eventUtils';
import { useManagedClubs } from '../features/events/useManagedClubs';
import { supabase } from '../lib/supabase';

type FormState = { clubId: string; title: string; description: string; venue: string; category: string; startTime: string; endTime: string; registrationDeadline: string; capacity: string };
const emptyForm: FormState = { clubId: '', title: '', description: '', venue: '', category: '', startTime: '', endTime: '', registrationDeadline: '', capacity: '1' };

export function EventFormPage() {
  const { eventId } = useParams();
  const editing = Boolean(eventId);
  const navigate = useNavigate();
  const { clubs, loading: clubsLoading, error: clubsError } = useManagedClubs();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [existingEvent, setExistingEvent] = useState<ManagedEvent | null>(null);
  const [scheduleChangeInput, setScheduleChangeInput] = useState<EventInput | null>(null);
  const [loadingEvent, setLoadingEvent] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    if (!eventId) return;
    setLoadingEvent(true);
    try {
      const event = await getManagedEvent(supabase, eventId) as ManagedEvent | null;
      if (!event) throw new Error('Event not found or you are not authorized to manage it.');
      setExistingEvent(event);
      setForm({ clubId: event.club_id, title: event.title, description: event.description ?? '', venue: event.venue, category: event.category ?? '', startTime: toDateTimeLocal(event.start_time), endTime: toDateTimeLocal(event.end_time), registrationDeadline: toDateTimeLocal(event.registration_deadline), capacity: String(event.capacity) });
    } catch (loadError) { setError(errorMessage(loadError)); }
    finally { setLoadingEvent(false); }
  }, [eventId]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (!editing && !form.clubId && clubs.length) setForm((v) => ({ ...v, clubId: clubs[0].id })); }, [clubs, editing, form.clubId]);

  function change(key: keyof FormState, value: string) { setForm((v) => ({ ...v, [key]: value })); }

  async function save(input: EventInput, confirmRegisteredScheduleChange: boolean) {
    setSaving(true);
    setError(''); setSuccess('');
    try {
      if (editing && eventId) {
        await updateEvent(supabase, eventId, input, confirmRegisteredScheduleChange);
        setScheduleChangeInput(null);
        setSuccess('Event details saved.');
        navigate(`/manage-events/${eventId}`, { replace: true });
      } else {
        const created = await createEvent(supabase, input);
        const newId = Array.isArray(created) ? created[0] : created;
        navigate(`/manage-events/${newId}`, { replace: true });
      }
    } catch (saveError) {
      const message = errorMessage(saveError);
      if (editing && eventId && message.includes('registered participants')) {
        try {
          const freshEvent = await getManagedEvent(supabase, eventId) as ManagedEvent | null;
          if (freshEvent) {
            setExistingEvent(freshEvent);
            setScheduleChangeInput(input);
            setError('');
          } else setError(message);
        } catch { setError(message); }
      } else setError(message);
    }
    finally { setSaving(false); }
  }

  function confirmScheduleChange() {
    if (!scheduleChangeInput) return;
    const input = scheduleChangeInput;
    setScheduleChangeInput(null);
    void save(input, true);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(''); setSuccess('');
    const start = new Date(form.startTime).getTime();
    const end = new Date(form.endTime).getTime();
    const deadline = new Date(form.registrationDeadline).getTime();
    const capacity = Number(form.capacity);
    if (!editing && !form.clubId) return setError('Choose a club you manage.');
    if (!Number.isInteger(capacity) || capacity < 1) return setError('Capacity must be a positive whole number.');
    if (![start, end, deadline].every(Number.isFinite)) return setError('Enter valid event dates and times.');
    if (end <= start) return setError('The end time must be later than the start time.');
    if (deadline > end) return setError('The registration deadline must be no later than the event end.');
    if (!editing && end <= Date.now()) return setError('The event end time must be in the future. Choose a later end time.');
    const input: EventInput = { clubId: form.clubId, title: form.title.trim(), description: form.description.trim() || null, venue: form.venue.trim(), category: form.category.trim() || null, startTime: localInputToIso(form.startTime), endTime: localInputToIso(form.endTime), registrationDeadline: localInputToIso(form.registrationDeadline), capacity };
    const scheduleChanged = existingEvent && (
      new Date(existingEvent.start_time).getTime() !== start
      || new Date(existingEvent.end_time).getTime() !== end
      || new Date(existingEvent.registration_deadline).getTime() !== deadline
    );
    if (editing && existingEvent && existingEvent.registration_count > 0 && scheduleChanged) {
      setScheduleChangeInput(input);
      return;
    }
    await save(input, false);
  }

  if (clubsLoading || loadingEvent) return <p role="status" className="py-8 text-center">Loading event form…</p>;
  return <div className="mx-auto max-w-3xl space-y-5"><Link className="text-sm font-bold underline decoration-aqua decoration-2 underline-offset-4" to="/manage-events">← Manage events</Link><section className={panelClass}>
    <h1 className="text-2xl font-bold">{editing ? 'Edit event' : 'Create event'}</h1>
    <p className="mt-1 text-sm text-slateDark/70">New events are saved as drafts until you publish them.</p>
    {clubsError && <p role="alert" className="mt-4 text-sm text-rose-800">{clubsError}</p>}
    {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
    {success && <p role="status" className="mt-4 rounded-xl bg-mint p-3 text-sm">{success}</p>}
    <form className="mt-6 grid gap-5 sm:grid-cols-2" onSubmit={(e) => void submit(e)}>
      {!editing && <FormField label="Club" htmlFor="club"><select id="club" required className={fieldClass} value={form.clubId} onChange={(e) => change('clubId', e.target.value)}><option value="">Select a club</option>{clubs.map((club) => <option value={club.id} key={club.id}>{club.name}</option>)}</select></FormField>}
      <FormField label="Event title" htmlFor="title"><input id="title" required maxLength={200} className={fieldClass} value={form.title} onChange={(e) => change('title', e.target.value)} /></FormField>
      <FormField label="Venue" htmlFor="venue"><input id="venue" required maxLength={300} className={fieldClass} value={form.venue} onChange={(e) => change('venue', e.target.value)} /></FormField>
      <FormField label="Category" htmlFor="category"><input id="category" maxLength={80} className={fieldClass} value={form.category} onChange={(e) => change('category', e.target.value)} /></FormField>
      <FormField label="Capacity" htmlFor="capacity"><input id="capacity" type="number" min={1} step={1} required className={fieldClass} value={form.capacity} onChange={(e) => change('capacity', e.target.value)} /></FormField>
      <FormField label="Starts" htmlFor="start"><input id="start" type="datetime-local" required className={fieldClass} value={form.startTime} onChange={(e) => change('startTime', e.target.value)} /></FormField>
      <FormField label="Ends" htmlFor="end"><input id="end" type="datetime-local" required className={fieldClass} value={form.endTime} onChange={(e) => change('endTime', e.target.value)} /></FormField>
      <FormField label="Registration deadline" htmlFor="deadline"><input id="deadline" type="datetime-local" required className={fieldClass} value={form.registrationDeadline} onChange={(e) => change('registrationDeadline', e.target.value)} /></FormField>
      <div className="sm:col-span-2"><FormField label="Description" htmlFor="description"><textarea id="description" rows={5} className={fieldClass} value={form.description} onChange={(e) => change('description', e.target.value)} /></FormField></div>
      <div className="flex flex-wrap gap-3 sm:col-span-2"><button className={primaryButtonClass} disabled={saving || (!editing && clubs.length === 0)} type="submit">{saving ? 'Saving…' : editing ? 'Save changes' : 'Create draft'}</button><Link className={secondaryButtonClass} to="/manage-events">Cancel</Link></div>
    </form>
  </section>
    {scheduleChangeInput && existingEvent && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slateDark/60 p-4"><section aria-labelledby="edit-schedule-confirm-title" aria-modal="true" className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl" role="dialog"><h2 className="text-xl font-bold" id="edit-schedule-confirm-title">Confirm event schedule change</h2><p className="mt-3 text-sm leading-6 text-slateDark/80">This event has {existingEvent.registration_count} active {existingEvent.registration_count === 1 ? 'registration' : 'registrations'}. Changing its schedule may create conflicts for participants. They will be notified if you continue.</p><div className="mt-6 flex justify-end gap-3"><button className={secondaryButtonClass} disabled={saving} onClick={() => setScheduleChangeInput(null)} type="button">Cancel</button><button className={primaryButtonClass} disabled={saving} onClick={confirmScheduleChange} type="button">{saving ? 'Saving…' : 'Save and notify'}</button></div></section></div>}
  </div>;
}
