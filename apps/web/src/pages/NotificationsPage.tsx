import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { NotificationItem } from '../features/notifications/NotificationItem';
import type { AppNotification } from '../features/notifications/types';
import { errorMessage } from '../features/clubs/types';
import { supabase } from '../lib/supabase';

const pageSize = 20;
const eventRoutes: readonly string[] = [];

export function NotificationsPage() {
  const { user } = useAuth();
  const { unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [tab, setTab] = useState<'all' | 'unread'>('all');
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(
    async (reset = true) => {
      if (!user) return;
      const offset = reset ? 0 : notifications.length;
      if (reset) setLoading(true);
      else setLoadingMore(true);
      let query = supabase
        .from('notifications')
        .select(
          'id, user_id, type, title, message, related_event_id, is_read, channels, metadata, status, read_at, created_at',
        )
        .order('created_at', { ascending: false })
        .range(offset, offset + pageSize - 1);
      if (tab === 'unread') query = query.eq('is_read', false);
      const page = await query;
      if (page.error) setError(errorMessage(page.error));
      else {
        const rows = (page.data ?? []) as AppNotification[];
        setNotifications((current) => (reset ? rows : [...current, ...rows]));
        setHasMore(rows.length === pageSize);
        setError('');
      }
      setLoading(false);
      setLoadingMore(false);
    },
    [notifications.length, tab, user],
  );

  useEffect(() => {
    void load(true);
  }, [tab, user]);

  async function handleRead(notification: AppNotification) {
    if (notification.is_read) return;
    setNotifications((current) =>
      current.map((item) => (item.id === notification.id ? { ...item, is_read: true } : item)),
    );
    try {
      await markAsRead(notification.id, false);
    } catch (readError) {
      setNotifications((current) =>
        current.map((item) => (item.id === notification.id ? notification : item)),
      );
      setError(errorMessage(readError));
    }
  }

  async function handleMarkAll() {
    const previous = notifications;
    setNotifications((current) => current.map((item) => ({ ...item, is_read: true })));
    try {
      await markAllAsRead();
    } catch (markError) {
      setNotifications(previous);
      setError(errorMessage(markError));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slateDark/70">Your updates</p>
          <h1 className="mt-1 text-3xl font-bold">Notifications</h1>
          <p className="mt-2 text-sm text-slateDark/75">
            Event and registration updates from your clubs.
          </p>
        </div>
        <button
          className="rounded-xl border border-mutedSlate/50 px-4 py-2.5 text-sm font-bold text-slateDark hover:bg-pink focus:outline-none focus:ring-4 focus:ring-aqua/40 disabled:opacity-50"
          disabled={unreadCount === 0}
          onClick={() => void handleMarkAll()}
          type="button"
        >
          Mark all as read
        </button>
      </div>
      <div
        className="flex gap-2 border-b border-mutedSlate/25"
        role="tablist"
        aria-label="Notification filter"
      >
        <button
          aria-selected={tab === 'all'}
          className={`rounded-t-xl px-4 py-2.5 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-aqua/40 ${tab === 'all' ? 'bg-mint text-slateDark' : 'text-slateDark/65 hover:bg-pink'}`}
          onClick={() => setTab('all')}
          role="tab"
          type="button"
        >
          All
        </button>
        <button
          aria-selected={tab === 'unread'}
          className={`rounded-t-xl px-4 py-2.5 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-aqua/40 ${tab === 'unread' ? 'bg-mint text-slateDark' : 'text-slateDark/65 hover:bg-pink'}`}
          onClick={() => setTab('unread')}
          role="tab"
          type="button"
        >
          Unread{' '}
          {unreadCount > 0 && (
            <span className="ml-1 rounded-full bg-lilac px-1.5 text-xs">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </div>
      {error && (
        <p
          className="rounded-xl border border-rose-200 bg-pink px-4 py-3 text-sm text-rose-900"
          role="alert"
        >
          {error}
        </p>
      )}
      {loading ? (
        <p className="rounded-3xl bg-white p-8">Loading notifications…</p>
      ) : notifications.length === 0 ? (
        <section className="rounded-3xl border border-mutedSlate/25 bg-white p-8 text-center">
          <p className="text-3xl">✨</p>
          <h2 className="mt-3 text-xl font-bold">You are all caught up</h2>
          <p className="mt-2 text-sm text-slateDark/70">
            There are no {tab === 'unread' ? 'unread ' : ''}notifications right now.
          </p>
          <Link
            className="mt-5 inline-block font-bold underline decoration-aqua decoration-2 underline-offset-4"
            to="/clubs"
          >
            Explore clubs
          </Link>
        </section>
      ) : (
        <>
          <div className="space-y-3">
            {notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onRead={() => void handleRead(notification)}
                registeredRoutes={eventRoutes}
              />
            ))}
          </div>
          {hasMore && (
            <div className="flex justify-center">
              <button
                className="rounded-xl bg-aqua px-5 py-2.5 text-sm font-bold hover:bg-aqua/80 focus:outline-none focus:ring-4 focus:ring-aqua/45 disabled:opacity-60"
                disabled={loadingMore}
                onClick={() => void load(false)}
                type="button"
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
