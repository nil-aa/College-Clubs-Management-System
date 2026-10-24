import { api } from './client';
import type {
  EventInput,
  MyEventRegistrationOptions,
  StudentEventOptions,
} from '@club-management/shared';

const query = (values: Record<string, string | number | boolean | null | undefined>) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values))
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  return params.toString();
};

export function createEvent(input: EventInput) {
  return api.post<{ event_id: string }>('/admin/events', {
    club_id: input.clubId,
    title: input.title,
    description: input.description ?? null,
    venue: input.venue,
    category: input.category ?? null,
    start_time: input.startTime,
    end_time: input.endTime,
    registration_deadline: input.registrationDeadline,
    capacity: input.capacity,
  });
}
export function listManagedEvents(
  options: { clubId?: string | null; limit?: number; offset?: number } = {},
) {
  return api.get<any[]>(
    `/admin/events?${query({ club_id: options.clubId, limit: options.limit ?? 50, offset: options.offset ?? 0 })}`,
  );
}
export function listStudentEvents(options: StudentEventOptions = {}) {
  return api.get<any[]>(
    `/events?${query({ search: options.search, club_id: options.clubId, category: options.category, start_from: options.startFrom, start_to: options.startTo, limit: options.limit ?? 50, offset: options.offset ?? 0 })}`,
  );
}
export function getStudentEvent(eventId: string) {
  return api.get<any>(`/events/${eventId}`);
}
export function registerForEvent(eventId: string) {
  return api.post<any>(`/events/${eventId}/registrations`);
}
export function cancelEventRegistration(eventId: string) {
  return api.delete<any>(`/events/${eventId}/registrations`);
}
export function listMyEventRegistrations(options: MyEventRegistrationOptions = {}) {
  return api.get<any[]>(
    `/me/registrations?${query({ upcoming: options.upcomingOnly ?? false, limit: options.limit ?? 50, offset: options.offset ?? 0 })}`,
  );
}
export function getManagedEvent(eventId: string) {
  return api.get<any>(`/admin/events/${eventId}`);
}
export function updateEvent(
  eventId: string,
  input: Omit<EventInput, 'clubId'>,
  confirmRegisteredScheduleChange = false,
) {
  return api.patch<{ event_id: string }>(`/admin/events/${eventId}`, {
    title: input.title,
    description: input.description ?? null,
    venue: input.venue,
    category: input.category ?? null,
    start_time: input.startTime,
    end_time: input.endTime,
    registration_deadline: input.registrationDeadline,
    capacity: input.capacity,
    confirm_registered_schedule_change: confirmRegisteredScheduleChange,
  });
}
export function publishEvent(eventId: string) {
  return api.post(`/admin/events/${eventId}/publish`);
}
export function postponeEvent(
  eventId: string,
  schedule?: { startTime: string; endTime: string; registrationDeadline: string },
  confirmRegisteredScheduleChange = false,
) {
  return api.post(
    `/admin/events/${eventId}/postpone`,
    schedule
      ? {
          start_time: schedule.startTime,
          end_time: schedule.endTime,
          registration_deadline: schedule.registrationDeadline,
          confirm_registered_schedule_change: confirmRegisteredScheduleChange,
        }
      : { confirm_registered_schedule_change: confirmRegisteredScheduleChange },
  );
}
export function cancelEvent(eventId: string) {
  return api.post(`/admin/events/${eventId}/cancel`);
}
export function listEventParticipants(eventId: string) {
  return api.get<any[]>(`/admin/events/${eventId}/participants`);
}
export function getAttendance(eventId: string) {
  return api.get<{ session: { status: string; finalized_at: string | null } | null; rows: any[] }>(
    `/admin/events/${eventId}/attendance`,
  );
}
export function markEventAttendance(
  eventId: string,
  studentId: string,
  status: string,
  notes?: string | null,
) {
  return api.post(`/admin/events/${eventId}/attendance`, {
    student_id: studentId,
    status,
    notes: notes ?? null,
  });
}
export function finalizeEventAttendance(eventId: string) {
  return api.post(`/admin/events/${eventId}/attendance/finalize`);
}
export function listMyParticipation() {
  return api.get<any[]>('/me/participation');
}
export function listAttendanceDashboard(clubId?: string | null) {
  return api.get<any[]>(`/admin/attendance?${query({ club_id: clubId, limit: 500, offset: 0 })}`);
}
export function generateOdSheet(
  eventId: string,
  input: { title: string; student_fields: string[]; event_fields: string[] },
) {
  return api.post<any>(`/admin/events/${eventId}/od-sheets`, input);
}
export function listOdSheets() {
  return api.get<{ sessions: any[]; sheets: any[] }>('/admin/od-sheets');
}
export function getOdSheet(id: string) {
  return api.get<any>(`/admin/od-sheets/${id}`);
}

export function closeOdSheet(id: string) {
  return api.post<any>(`/admin/od-sheets/${id}/close`);
}

export function listFacultyOdSheets() {
  return api.get<any[]>('/faculty/od-sheets');
}

export function getFacultyOdSheet(id: string) {
  return api.get<any>(`/faculty/od-sheets/${id}`);
}

export function approveOdSheet(id: string) {
  return api.post<any>(`/faculty/od-sheets/${id}/approve`);
}
