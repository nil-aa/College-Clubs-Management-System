import { Link } from 'react-router-dom';
import {
  formatRelativeTime,
  getNotificationMeta,
  resolveNotificationHref,
  type AppNotification,
} from './types';

type NotificationItemProps = {
  notification: AppNotification;
  onRead: () => void;
  compact?: boolean;
  registeredRoutes?: readonly string[];
};

export function NotificationItem({
  notification,
  onRead,
  compact = false,
  registeredRoutes = [],
}: NotificationItemProps) {
  const meta = getNotificationMeta(notification.type);
  const href = resolveNotificationHref(notification, registeredRoutes);
  const content = (
    <>
      <div className="flex min-w-0 items-start gap-3">
        <span aria-hidden="true" className="text-xl">
          {meta.icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="truncate font-bold text-slateDark">
              {meta.label}: {notification.title}
            </p>
            <time className="shrink-0 text-xs text-slateDark/60" dateTime={notification.created_at}>
              {formatRelativeTime(notification.created_at)}
            </time>
          </div>
          <p className={`mt-1 text-sm text-slateDark/75 ${compact ? 'line-clamp-2' : ''}`}>
            {notification.message}
          </p>
        </div>
        {!notification.is_read && (
          <span aria-label="Unread" className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-aqua" />
        )}
      </div>
    </>
  );
  const className = `block rounded-2xl border px-4 py-3 text-left transition focus:outline-none focus:ring-4 focus:ring-aqua/40 ${notification.is_read ? 'border-mutedSlate/20 bg-white' : 'border-aqua/70 bg-mint/65'} ${compact ? 'hover:bg-mint' : 'hover:border-aqua'}`;
  if (href)
    return (
      <Link className={className} onClick={onRead} to={href}>
        {content}
      </Link>
    );
  return (
    <button className={`${className} w-full`} onClick={onRead} type="button">
      {content}
    </button>
  );
}
