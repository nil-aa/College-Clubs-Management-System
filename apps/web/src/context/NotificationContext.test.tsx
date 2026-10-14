/* eslint-disable no-unused-vars */
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationsProvider, useNotifications } from './NotificationContext';

const rpcMock = vi.hoisted(() => vi.fn());
const fromMock = vi.hoisted(() => vi.fn());
const channelMock = vi.hoisted(() => ({ on: vi.fn(), subscribe: vi.fn() }));
const user = vi.hoisted(() => ({ id: 'user-1' }));

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: fromMock,
    rpc: rpcMock,
    channel: vi.fn(() => channelMock),
    removeChannel: vi.fn(),
  },
}));
vi.mock('./AuthContext', () => ({ useAuth: () => ({ user }) }));

const notification = {
  id: 'n1',
  user_id: 'user-1',
  type: 'event_published',
  title: 'Event',
  message: 'New event',
  related_event_id: null,
  is_read: false,
  channels: ['in_app'],
  metadata: {},
  status: 'unread',
  read_at: null,
  created_at: new Date().toISOString(),
};

function wrapper({ children }: { children: ReactNode }) {
  return <NotificationsProvider>{children}</NotificationsProvider>;
}

describe('NotificationsProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    channelMock.on.mockReturnValue(channelMock);
    channelMock.subscribe.mockImplementation((callback: (value: string) => void) => {
      callback('SUBSCRIBED');
      return channelMock;
    });
    fromMock.mockReturnValue({
      select: vi.fn((_: string, options?: { head?: boolean }) =>
        options?.head
          ? { eq: vi.fn().mockResolvedValue({ count: 1, error: null }) }
          : {
              order: vi.fn(() => ({
                limit: vi.fn().mockResolvedValue({ data: [notification], error: null }),
              })),
            },
      ),
    });
    rpcMock.mockResolvedValue({ data: true, error: null });
  });

  it('optimistically marks one notification read and rolls back on error', async () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    rpcMock.mockResolvedValueOnce({ data: true, error: null });
    await act(async () => {
      await result.current.markAsRead('n1');
    });
    expect(result.current.unreadCount).toBe(0);

    await act(async () => {
      await result.current.refresh();
    });
    rpcMock.mockRejectedValueOnce(new Error('read failed'));
    await act(async () => {
      await expect(result.current.markAsRead('n1')).rejects.toThrow('read failed');
    });
    expect(result.current.unreadCount).toBe(1);
  });

  it('optimistically marks all notifications read', async () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.markAllAsRead();
    });
    expect(result.current.unreadCount).toBe(0);
    expect(rpcMock).toHaveBeenCalledWith('mark_all_notifications_read');
  });
});
