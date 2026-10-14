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
      setForm({ clubId: event.club_id, title: event.title, description: event.description ?? '', venue: event.venue, category: event.category ?? '', startTime: toDateTimeLocal(event.start_time), endTime: toDateTimeLocal(event.end_time), registrationDeadline: toDateTimeLocal(event.registration_deadline), capacity: String(event.capacity) });
    } catch (loadError) { setError(errorMessage(loadError)); }
    finally { setLoadingEvent(false); }
  }, [eventId]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (!editing && !form.clubId && clubs.length) setForm((v) => ({ ...v, clubId: clubs[0].id })); }, [clubs, editing, form.clubId]);

  function change(key: keyof FormState, value: string) { setForm((v) => ({ ...v, [key]: value })); }
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
    if (deadline > start) return setError('The registration deadline must be no later than the event start.');
    const input: EventInput = { clubId: form.clubId, title: form.title.trim(), description: form.description.trim() || null, venue: form.venue.trim(), category: form.category.trim() || null, startTime: localInputToIso(form.startTime), endTime: localInputToIso(form.endTime), registrationDeadline: localInputToIso(form.registrationDeadline), capacity };
    setSaving(true);
    try {
      if (editing && eventId) {
        await updateEvent(supabase, eventId, input);
        setSuccess('Event details saved.');
        navigate(`/manage-events/${eventId}`, { replace: true });
      } else {
        const created = await createEvent(supabase, input);
        const newId = Array.isArray(created) ? created[0] : created;
        navigate(`/manage-events/${newId}`, { replace: true });
      }
    } catch (saveError) { setError(errorMessage(saveError)); }
    finally { setSaving(false); }
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
  </section></div>;
}
