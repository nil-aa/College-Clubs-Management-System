import { notFound } from '../../shared/errors/http.js';
/* eslint-disable no-unused-vars */
import type { M1Repository } from '../../shared/db/repository.js';

export class NotificationQueryService {
  constructor(private readonly repository: M1Repository) {}

  list(userId: string, input: { unread?: boolean; limit: number; offset: number }) {
    return this.repository.listNotifications({
      userId,
      unreadOnly: input.unread === true,
      limit: Math.min(input.limit, 100),
      offset: input.offset,
    });
  }

  unreadCount(userId: string) {
    return this.repository.countUnreadNotifications(userId);
  }

  async markRead(userId: string, notificationId: string) {
    const changed = await this.repository.markNotificationRead(userId, notificationId);
    if (!changed) throw notFound('Notification not found or already read.');
    return { updated: true };
  }

  async markAll(userId: string) {
    const count = await this.repository.markAllNotificationsRead(userId);
    return { updated: count };
  }
}
