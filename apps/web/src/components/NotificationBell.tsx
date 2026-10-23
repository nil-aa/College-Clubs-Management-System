import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useNotifications } from '../context/NotificationContext';
import { NotificationItem } from '../features/notifications/NotificationItem';

export function NotificationBell() {
  const { latest, unreadCount, error, markAsRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  const badge = unreadCount > 9 ? '9+' : String(unreadCount);
  return (
    <div className="relative">
      <button
        ref={buttonRef}
        aria-expanded={open}
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
        className="relative rounded-xl border border-mutedSlate/50 px-3 py-2 text-lg text-slateDark transition hover:bg-pink focus:outline-none focus:ring-4 focus:ring-aqua/40"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        🔔
        {unreadCount > 0 && (
          <span
            aria-label={`${unreadCount} unread`}
            className="absolute -right-1 -top-1 rounded-full bg-lilac px-1.5 text-[10px] font-extrabold leading-5 text-slateDark"
          >
            {badge}
          </span>
        )}
      </button>
      {open && (
        <div
          aria-label="Recent notifications"
          className="absolute right-0 z-20 mt-3 w-[min(22rem,calc(100vw-2rem))] rounded-3xl border border-mutedSlate/25 bg-lavender p-3 shadow-2xl shadow-slateDark/20"
        >
          <div className="flex items-center justify-between gap-3 px-2 pb-2">
            <h2 className="font-bold text-slateDark">Notifications</h2>
            <Link
              className="text-xs font-bold text-slateDark underline decoration-aqua decoration-2 underline-offset-4 focus:outline-none focus:ring-4 focus:ring-aqua/40"
              onClick={() => setOpen(false)}
              to="/notifications"
            >
              View all
            </Link>
          </div>
          {error && (
            <p className="rounded-xl bg-pink px-3 py-2 text-xs text-rose-900" role="alert">
              {error}
            </p>
          )}
          {latest.length === 0 ? (
            <p className="rounded-2xl bg-white px-3 py-5 text-center text-sm text-slateDark/70">
              You are all caught up.
            </p>
          ) : (
            <div className="space-y-2">
              {latest.map((notification) => (
                <NotificationItem
                  compact
                  key={notification.id}
                  notification={notification}
                  onRead={() =>
                    void markAsRead(notification.id, notification.is_read).catch(() => undefined)
                  }
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
