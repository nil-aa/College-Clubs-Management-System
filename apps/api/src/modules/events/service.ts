/* eslint-disable no-unused-vars */
import { badRequest, conflict, forbidden, notFound } from '../../shared/errors/http.js';
import { z } from 'zod';
import type { EventRepository, M1Repository } from '../../shared/db/repository.js';
import { AuthorizationService } from '../../shared/authz/service.js';
import { AuditService } from '../../shared/audit/service.js';
import { NotificationService } from '../../shared/notifications/service.js';

export class EventService {
  constructor(
    private readonly repository: M1Repository & EventRepository,
    private readonly authz: AuthorizationService,
  ) {}

  list(input: Parameters<EventRepository['listStudentEvents']>[0]) {
    return this.repository.listStudentEvents(input);
  }
  async detail(userId: string, eventId: string) {
    const event = await this.repository.getStudentEvent(eventId);
    if (!event) throw notFound('Event not found.');
    return event;
  }
  async managedList(userId: string, input: { clubId?: string; limit: number; offset: number }) {
    return this.repository.listManagedEvents({
      userId,
      admin: await this.authz.isAdmin(userId),
      clubId: input.clubId,
      limit: input.limit,
      offset: input.offset,
    });
  }
  async managedDetail(userId: string, eventId: string) {
    const event = await this.repository.getManagedEvent(eventId);
    if (!event) throw notFound('Event not found.');
    const club = await this.repository.getClub(event.club_id);
    if (!club?.is_active) throw notFound('Event not found.');
    if (!(await this.authz.canManageClub(userId, event.club_id))) throw forbidden();
    return event;
  }
  private validateTimes(input: {
    title: string;
    venue: string;
    start_time: string;
    end_time: string;
    registration_deadline: string;
    capacity: number;
  }) {
    const start = new Date(input.start_time);
    const end = new Date(input.end_time);
    const deadline = new Date(input.registration_deadline);
    if (end <= start) throw badRequest('Event end time must be later than start time.');
    if (deadline > start)
      throw badRequest('Registration deadline must be no later than event start.');
    if (input.capacity <= 0) throw badRequest('Event capacity must be positive.');
  }
  async create(actorId: string, input: any) {
    this.validateTimes(input);
    if (!(await this.authz.canManageClub(actorId, input.club_id))) throw forbidden();
    const club = await this.repository.getClub(input.club_id);
    if (!club?.is_active) throw notFound('Active club not found.');
    try {
      return await this.repository.transaction(async (tx) => {
        const id = await (tx as M1Repository & EventRepository).createEvent({
          actorId,
          clubId: input.club_id,
          title: input.title,
          description: input.description,
          venue: input.venue,
          category: input.category,
          startTime: new Date(input.start_time),
          endTime: new Date(input.end_time),
          registrationDeadline: new Date(input.registration_deadline),
          capacity: input.capacity,
        });
        await new AuditService(tx).log({
          actorId,
          action: 'event.created',
          entityType: 'events',
          entityId: id,
          details: { club_id: input.club_id },
        });
        return { event_id: id };
      });
    } catch (error) {
      if ((error as any)?.code === '23505')
        throw conflict('An event with these details already exists.');
      throw error;
    }
  }
  async update(actorId: string, eventId: string, input: any) {
    const event = await this.repository.getManagedEvent(eventId);
    if (!event) throw notFound('Event not found.');
    const club = await this.repository.getClub(event.club_id);
    if (!club?.is_active) throw notFound('Event not found.');
    if (!(await this.authz.canManageClub(actorId, event.club_id))) throw forbidden();
    this.validateTimes({ ...input, title: input.title, venue: input.venue });
    const id = await this.repository.transaction(async (tx) => {
      const result = await (tx as M1Repository & EventRepository).updateEvent({
        actorId,
        eventId,
        title: input.title,
        description: input.description,
        venue: input.venue,
        category: input.category,
        startTime: new Date(input.start_time),
        endTime: new Date(input.end_time),
        registrationDeadline: new Date(input.registration_deadline),
        capacity: input.capacity,
        confirmRegisteredScheduleChange: input.confirm_registered_schedule_change,
      });
      await new AuditService(tx).log({
        actorId,
        action: 'event.updated',
        entityType: 'events',
        entityId: eventId,
        details: { club_id: event.club_id },
      });
      if (input.confirm_registered_schedule_change && event.registration_count > 0) {
        await new NotificationService(tx).sendBulk({
          userIds: await (tx as M1Repository & EventRepository).listRegisteredUserIds(eventId),
          type: 'event_schedule_updated',
          title: 'Event schedule updated',
          message: `The schedule for "${event.title}" has changed.`,
          relatedEventId: eventId,
        });
      }
      return result;
    });
    return { event_id: id };
  }
  async transition(
    actorId: string,
    eventId: string,
    action: 'publish' | 'postpone' | 'cancel',
    schedule?: any,
  ) {
    const event = await this.repository.getManagedEvent(eventId);
    if (!event) throw notFound('Event not found.');
    if (!(await this.authz.canManageClub(actorId, event.club_id))) throw forbidden();
    if (action === 'postpone' && schedule)
      this.validateTimes({
        ...schedule,
        title: event.title,
        venue: event.venue,
        capacity: event.capacity,
      });
    return this.repository.transaction(async (tx) => {
      const id = await (tx as M1Repository & EventRepository).transitionEvent(
        eventId,
        action,
        actorId,
        schedule && {
          startTime: new Date(schedule.start_time),
          endTime: new Date(schedule.end_time),
          registrationDeadline: new Date(schedule.registration_deadline),
        },
        Boolean(schedule?.confirm_registered_schedule_change),
      );
      await new AuditService(tx).log({
        actorId,
        action: `event.${action === 'publish' ? 'published' : action === 'postpone' ? 'postponed' : 'cancelled'}`,
        entityType: 'events',
        entityId: eventId,
        details: { club_id: event.club_id },
      });
      const notifications = new NotificationService(tx);
      if (action === 'publish') {
        await notifications.sendBulk({
          userIds: await notifications.getActiveStudentIds(),
          type: 'event_published',
          title: 'Event published',
          message: `A new event is available: ${event.title}.`,
          relatedEventId: eventId,
        });
      } else {
        await notifications.sendBulk({
          userIds: await (tx as M1Repository & EventRepository).listRegisteredUserIds(eventId),
          type: action === 'postpone' ? 'event_postponed' : 'event_cancelled',
          title: action === 'postpone' ? 'Event postponed' : 'Event cancelled',
          message: `The event "${event.title}" has been ${action === 'postpone' ? 'postponed' : 'cancelled'}.`,
          relatedEventId: eventId,
        });
      }
      return { event_id: id };
    });
  }
  async register(userId: string, eventId: string) {
    const snapshot = await this.repository.getPermissionSnapshot(userId);
    const canParticipate =
      snapshot.roles.some((role) => role.code === 'student') ||
      snapshot.roles.some((role) => role.code === 'club_head' && role.clubId !== null);
    if (!canParticipate)
      throw forbidden('Only students and active club heads can register for events.');
    return this.repository.transaction(async (tx) => {
      const result = await (tx as M1Repository & EventRepository).registerForEvent(userId, eventId);
      await new AuditService(tx).log({
        actorId: userId,
        action: result.reactivated
          ? 'event.registration.reactivated'
          : 'event.registration.created',
        entityType: 'event_registrations',
        entityId: result.registration_id,
        details: { event_id: eventId, student_id: userId },
      });
      await new NotificationService(tx).send({
        userId,
        type: 'registration_confirmed',
        title: 'Registration confirmed',
        message: `Your registration for "${result.event_title}" was confirmed.`,
        relatedEventId: eventId,
      });
      return result;
    });
  }
  async cancelRegistration(userId: string, eventId: string) {
    return this.repository.transaction(async (tx) => {
      const result = await (tx as M1Repository & EventRepository).cancelEventRegistration(
        userId,
        eventId,
      );
      if (result.changed) {
        await new AuditService(tx).log({
          actorId: userId,
          action: 'event.registration.cancelled',
          entityType: 'event_registrations',
          entityId: result.registration_id,
          details: { event_id: eventId, student_id: userId },
        });
        await new NotificationService(tx).send({
          userId,
          type: 'registration_cancelled',
          title: 'Registration cancelled',
          message: `Your registration for "${result.event_title}" was cancelled.`,
          relatedEventId: eventId,
        });
      }
      return result;
    });
  }
  async registrations(userId: string, input: any) {
    return this.repository.listMyEventRegistrations(userId, input);
  }
  async participants(userId: string, eventId: string) {
    const event = await this.managedDetail(userId, eventId);
    return this.repository.listEventParticipants(event.event_id);
  }
  async attendance(userId: string, eventId: string) {
    await this.managedDetail(userId, eventId);
    return this.repository.getAttendance(eventId);
  }
  async markAttendance(actorId: string, input: any) {
    const event = await this.managedDetail(actorId, input.event_id);
    return this.repository.transaction(async (tx) => {
      const result = await (tx as M1Repository & EventRepository).markAttendance({
        actorId,
        eventId: event.event_id,
        studentId: input.student_id,
        status: input.status,
        notes: input.notes,
      });
      await new AuditService(tx).log({
        actorId,
        action: 'attendance.marked',
        entityType: 'event_attendance',
        entityId: result.id,
        details: { event_id: event.event_id, student_id: input.student_id, status: input.status },
      });
      return result;
    });
  }
  async finalizeAttendance(actorId: string, eventId: string) {
    await this.managedDetail(actorId, eventId);
    return this.repository.transaction(async (tx) => {
      const result = await (tx as M1Repository & EventRepository).finalizeAttendance(
        actorId,
        eventId,
      );
      await new AuditService(tx).log({
        actorId,
        action: 'attendance.finalized',
        entityType: 'event_attendance_session',
        entityId: result.id,
        details: { event_id: eventId },
      });
      return result;
    });
  }
  async participation(userId: string) {
    return this.repository.listMyParticipation(userId);
  }
  async attendanceDashboard(userId: string, input: any) {
    return this.repository.listAttendanceDashboard({
      userId,
      admin: await this.authz.isAdmin(userId),
      ...input,
    });
  }
  async odSheet(actorId: string, eventId: string, input: any) {
    await this.managedDetail(actorId, eventId);
    return this.repository.transaction(async (tx) => {
      const result = await (tx as M1Repository & EventRepository).generateOdSheet({
        actorId,
        eventId,
        title: input.title,
        studentFields: input.student_fields,
        eventFields: input.event_fields,
      });
      await new AuditService(tx).log({
        actorId,
        action: 'od_sheet.generated',
        entityType: 'od_sheet',
        entityId: result.id,
        details: { event_id: eventId },
      });
      return result;
    });
  }
  async odSheets(userId: string) {
    return {
      sessions: await this.repository.listFinalizedAttendanceSessions(
        userId,
        await this.authz.isAdmin(userId),
      ),
      sheets: await this.repository.listOdSheets(userId, await this.authz.isAdmin(userId)),
    };
  }
  async odSheetDetail(userId: string, id: string) {
    const result = await this.repository.getOdSheet(id);
    if (!result.sheet) throw notFound('OD sheet not found.');
    const club = await this.repository.getClub(result.sheet.club_id);
    if (!club?.is_active) throw notFound('OD sheet not found.');
    if (!(await this.authz.canManageClub(userId, result.sheet.club_id))) throw forbidden();
    return result;
  }

  async closeOdSheet(actorId: string, id: string) {
    const { sheet } = await this.odSheetDetail(actorId, id);
    if (sheet.status !== 'OPEN') throw conflict('Only an open participation list can be closed.');
    return this.repository.transaction(async (tx) => {
      const result = await (tx as M1Repository & EventRepository).closeOdSheet(actorId, id);
      await new AuditService(tx).log({
        actorId,
        action: 'od_sheet.closed',
        entityType: 'od_sheet',
        entityId: id,
        details: { event_id: sheet.event_id, club_id: sheet.club_id },
      });
      return result;
    });
  }

  async facultyOdSheets(userId: string) {
    if (!(await this.authz.hasRole(userId, 'faculty_coordinator'))) throw forbidden();
    return this.repository.listFacultyOdSheets(userId);
  }

  async facultyOdSheetDetail(userId: string, id: string) {
    const result = await this.repository.getOdSheet(id);
    if (!result.sheet || !['CLOSED', 'APPROVED'].includes(result.sheet.status))
      throw notFound('Closed OD participation list not found.');
    const club = await this.repository.getClub(result.sheet.club_id);
    if (!club?.is_active) throw notFound('Closed OD participation list not found.');
    if (!(await this.authz.hasRole(userId, 'faculty_coordinator', result.sheet.club_id)))
      throw notFound('Closed OD participation list not found.');
    return result;
  }

  async approveOdSheet(reviewerId: string, id: string) {
    const { sheet } = await this.facultyOdSheetDetail(reviewerId, id);
    if (sheet.status !== 'CLOSED')
      throw conflict('Only a closed participation list can be approved.');
    return this.repository.transaction(async (tx) => {
      const result = await (tx as M1Repository & EventRepository).approveOdSheet(reviewerId, id);
      await new AuditService(tx).log({
        actorId: reviewerId,
        action: 'od_sheet.approved',
        entityType: 'od_sheet',
        entityId: id,
        details: { event_id: sheet.event_id, club_id: sheet.club_id },
      });
      return result;
    });
  }
}

export function mapEventError(error: unknown): unknown {
  if (error instanceof z.ZodError) return badRequest('Request validation failed.', error.flatten());
  if (error && typeof error === 'object' && (error as { code?: string }).code === 'P2002')
    return conflict('The event conflicts with an existing record.');
  const message = error instanceof Error ? error.message : '';
  if (/already registered|at capacity|duplicate/i.test(message)) return conflict(message);
  if (
    /only an open participation list|only a closed participation list|status transition/i.test(
      message,
    )
  )
    return conflict(message);
  if (/not found/i.test(message)) return notFound(message);
  if (
    /already registered|at capacity|cannot be changed|deadline|invalid|required|finalized|registered participant|OD sheets/i.test(
      message,
    )
  )
    return badRequest(message);
  return error;
}
