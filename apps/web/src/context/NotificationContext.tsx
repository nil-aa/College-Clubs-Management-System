/* eslint-disable no-unused-vars */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { markAllNotificationsRead, markNotificationRead } from '@club-management/shared';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';
import type { AppNotification } from '../features/notifications/types';
import { errorMessage } from '../features/clubs/types';

type NotificationContextValue = {
  latest: AppNotification[];
  unreadCount: number;
  loading: boolean;
  error: string;
  realtimeConnected: boolean;
  refresh: () => Promise<void>;
  markAsRead: (notificationId: string, currentlyRead?: boolean) => Promise<void>;
  markAllAsRead: () => Promise<void>;
};

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

function notificationSelect() {
  return 'id, user_id, type, title, message, related_event_id, is_read, channels, metadata, status, read_at, created_at';
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [latest, setLatest] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [realtimeConnected, setRealtimeConnected] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setLatest([]);
      setUnreadCount(0);
      setError('');
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [latestResult, unreadResult] = await Promise.all([
        supabase
          .from('notifications')
          .select(notificationSelect())
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('is_read', false),
      ]);
      const failure = latestResult.error ?? unreadResult.error;
      if (failure) throw failure;
      setError('');
      setLatest((latestResult.data ?? []) as unknown as AppNotification[]);
      setUnreadCount(unreadResult.count ?? 0);
    } catch (failure) {
      setError(`Notifications could not be refreshed. ${errorMessage(failure)}`);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const notification = payload.new as AppNotification;
          setLatest((current) =>
            [notification, ...current.filter((item) => item.id !== notification.id)].slice(0, 5),
          );
          if (!notification.is_read) setUnreadCount((count) => count + 1);
        },
      )
      .subscribe((status) => {
        setRealtimeConnected(status === 'SUBSCRIBED');
      });
    const handleFocus = () => void refresh();
    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
      setRealtimeConnected(false);
      void supabase.removeChannel(channel);
    };
  }, [refresh, user]);

  const markAsRead = useCallback(
    async (notificationId: string, currentlyRead = false) => {
      if (currentlyRead) return;
      const previousLatest = latest;
      const previousCount = unreadCount;
      setLatest((current) =>
        current.map((item) => (item.id === notificationId ? { ...item, is_read: true } : item)),
      );
      setUnreadCount((count) => Math.max(0, count - 1));
      try {
        const changed = await markNotificationRead(supabase, notificationId);
        if (!changed) throw new Error('This notification could not be marked as read.');
      } catch (markError) {
        setLatest(previousLatest);
        setUnreadCount(previousCount);
        setError(`Could not update this notification. ${errorMessage(markError)}`);
        throw markError;
      }
    },
    [latest, unreadCount],
  );

  const markAllAsRead = useCallback(async () => {
    const previousLatest = latest;
    const previousCount = unreadCount;
    setLatest((current) => current.map((item) => ({ ...item, is_read: true })));
    setUnreadCount(0);
    try {
      await markAllNotificationsRead(supabase);
    } catch (markError) {
      setLatest(previousLatest);
      setUnreadCount(previousCount);
      setError(`Could not update notifications. ${errorMessage(markError)}`);
      throw markError;
    }
  }, [latest, unreadCount]);

  const value = useMemo(
    () => ({
      latest,
      unreadCount,
      loading,
      error,
      realtimeConnected,
      refresh,
      markAsRead,
      markAllAsRead,
    }),
    [latest, unreadCount, loading, error, realtimeConnected, refresh, markAsRead, markAllAsRead],
  );
  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const value = useContext(NotificationContext);
  if (!value) throw new Error('useNotifications must be used inside NotificationsProvider');
  return value;
}
