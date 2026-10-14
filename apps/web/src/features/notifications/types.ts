import type { Database, NotificationType } from '@club-management/shared';

export type AppNotification = Database['public']['Tables']['notifications']['Row'];

export const notificationTypeMeta: Record<NotificationType, { label: string; icon: string }> = {
  event_published: { label: 'Event published', icon: '📣' },
  registration_confirmed: { label: 'Registration confirmed', icon: '✅' },
  registration_cancelled: { label: 'Registration cancelled', icon: '↩' },
  event_postponed: { label: 'Event postponed', icon: '⏰' },
  event_cancelled: { label: 'Event cancelled', icon: '⚠' },
};

export function getNotificationMeta(type: string) {
  return notificationTypeMeta[type as NotificationType] ?? { label: 'Notification', icon: '🔔' };
}

export function formatRelativeTime(value: string) {
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (elapsedSeconds < 60) return 'Just now';
  const minutes = Math.floor(elapsedSeconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));
}

export const EVENT_DETAIL_ROUTE = '/events/:id';

/** Returns null until the owning module registers the event detail route. */
export function resolveNotificationHref(
  notification: Pick<AppNotification, 'related_event_id'>,
  registeredRoutes: readonly string[] = [],
) {
  if (!notification.related_event_id || !registeredRoutes.includes(EVENT_DETAIL_ROUTE)) return null;
  return `/events/${encodeURIComponent(notification.related_event_id)}`;
}
