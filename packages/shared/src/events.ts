import type { AppSupabaseClient } from './helpers';
import type { Database } from './database.types';

export type ManagedEvent =
  Database['public']['Functions']['list_managed_events']['Returns'][number];

export type RegistrationAvailability = 'AVAILABLE' | 'FULL' | 'CLOSED';

export type StudentEvent = Omit<
  Database['public']['Functions']['list_student_events']['Returns'][number],
  'registration_availability'
> & { registration_availability: RegistrationAvailability };

export type StudentEventOptions = {
  search?: string | null;
  clubId?: string | null;
  category?: string | null;
  startFrom?: string | null;
  startTo?: string | null;
  limit?: number;
  offset?: number;
};

export type EventInput = {
  clubId: string;
  title: string;
  description?: string | null;
  venue: string;
  category?: string | null;
  startTime: string;
  endTime: string;
  registrationDeadline: string;
  capacity: number;
};

export async function createEvent(client: AppSupabaseClient, input: EventInput) {
  const { data, error } = await client.rpc('create_event', {
    p_club_id: input.clubId,
    p_title: input.title,
    p_description: input.description ?? null,
    p_venue: input.venue,
    p_category: input.category ?? null,
    p_start_time: input.startTime,
    p_end_time: input.endTime,
    p_registration_deadline: input.registrationDeadline,
    p_capacity: input.capacity,
  });
  if (error) throw error;
  return data;
}

export async function listManagedEvents(
  client: AppSupabaseClient,
  options: { clubId?: string | null; limit?: number; offset?: number } = {},
) {
  const { data, error } = await client.rpc('list_managed_events', {
    p_club_id: options.clubId ?? null,
    p_limit: options.limit ?? 50,
    p_offset: options.offset ?? 0,
  });
  if (error) throw error;
  return data ?? [];
}

export async function listStudentEvents(
  client: AppSupabaseClient,
  options: StudentEventOptions = {},
): Promise<StudentEvent[]> {
  const { data, error } = await client.rpc('list_student_events', {
    p_search: options.search ?? null,
    p_club_id: options.clubId ?? null,
    p_category: options.category ?? null,
    p_start_from: options.startFrom ?? null,
    p_start_to: options.startTo ?? null,
    p_limit: options.limit ?? 50,
    p_offset: options.offset ?? 0,
  });
  if (error) throw error;
  return (data ?? []) as StudentEvent[];
}

export async function getStudentEvent(
  client: AppSupabaseClient,
  eventId: string,
): Promise<StudentEvent | null> {
  const { data, error } = await client.rpc('get_student_event', { p_event_id: eventId });
  if (error) throw error;
  return (data?.[0] as StudentEvent | undefined) ?? null;
}

export async function getManagedEvent(client: AppSupabaseClient, eventId: string) {
  const { data, error } = await client.rpc('get_managed_event', { p_event_id: eventId });
  if (error) throw error;
  return data?.[0] ?? null;
}

export async function updateEvent(
  client: AppSupabaseClient,
  eventId: string,
  input: Omit<EventInput, 'clubId'>,
) {
  const { data, error } = await client.rpc('update_event', {
    p_event_id: eventId,
    p_title: input.title,
    p_description: input.description ?? null,
    p_venue: input.venue,
    p_category: input.category ?? null,
    p_start_time: input.startTime,
    p_end_time: input.endTime,
    p_registration_deadline: input.registrationDeadline,
    p_capacity: input.capacity,
  });
  if (error) throw error;
  return data;
}

export async function publishEvent(client: AppSupabaseClient, eventId: string) {
  const { data, error } = await client.rpc('publish_event', { p_event_id: eventId });
  if (error) throw error;
  return data;
}

export async function postponeEvent(
  client: AppSupabaseClient,
  eventId: string,
  schedule?: { startTime: string; endTime: string; registrationDeadline: string },
) {
  const { data, error } = await client.rpc('postpone_event', {
    p_event_id: eventId,
    p_start_time: schedule?.startTime ?? null,
    p_end_time: schedule?.endTime ?? null,
    p_registration_deadline: schedule?.registrationDeadline ?? null,
  });
  if (error) throw error;
  return data;
}

export async function cancelEvent(client: AppSupabaseClient, eventId: string) {
  const { data, error } = await client.rpc('cancel_event', { p_event_id: eventId });
  if (error) throw error;
  return data;
}

