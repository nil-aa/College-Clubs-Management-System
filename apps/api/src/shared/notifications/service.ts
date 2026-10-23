/* eslint-disable no-unused-vars */
import { z } from 'zod';
import type { M1Repository } from '../db/repository.js';

export const notificationTypes = [
  'event_published',
  'registration_confirmed',
  'registration_cancelled',
  'event_postponed',
  'event_cancelled',
  'event_schedule_updated',
] as const;
export type NotificationType = (typeof notificationTypes)[number];
const notificationInput = z.object({
  userId: z.string().uuid(),
  type: z.enum(notificationTypes),
  title: z.string().trim().min(1),
  message: z.string().trim().min(1),
  relatedEventId: z.string().uuid().optional(),
});

export class NotificationService {
  constructor(private readonly repository: M1Repository) {}
  send(input: z.input<typeof notificationInput>) {
    const value = notificationInput.parse(input);
    return this.repository.insertNotification(value);
  }
  sendBulk(input: {
    userIds: Array<string | null | undefined>;
    type: NotificationType;
    title: string;
    message: string;
    relatedEventId?: string;
  }) {
    const userIds = [...new Set(input.userIds.filter((id): id is string => Boolean(id)))];
    const value = notificationInput.omit({ userId: true }).parse({
      type: input.type,
      title: input.title,
      message: input.message,
      relatedEventId: input.relatedEventId,
    });
    return this.repository.insertNotifications({ ...value, userIds });
  }
  getActiveStudentIds() {
    return this.repository.getActiveStudentIds();
  }

  /** Compatibility-only notification path for the existing M1 head-assignment contract. */
  sendInternal(input: {
    userId: string;
    type: 'club_head.assigned' | 'club_head.revoked' | 'user_role.changed';
    title: string;
    message: string;
  }) {
    return this.repository.insertNotification(input);
  }
}
