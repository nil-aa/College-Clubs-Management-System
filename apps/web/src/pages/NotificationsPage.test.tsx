import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationsPage } from './NotificationsPage';

const fromMock = vi.hoisted(() => vi.fn());
const notificationState = vi.hoisted(() => ({
  unreadCount: 1,
  markAsRead: vi.fn(),
  markAllAsRead: vi.fn(),
}));
vi.mock('../lib/supabase', () => ({ supabase: { from: fromMock } }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }));
vi.mock('../context/NotificationContext', () => ({ useNotifications: () => notificationState }));

const rows = [
  {
    id: 'read',
    user_id: 'user-1',
    type: 'event_published',
    title: 'Read event',
    message: 'Read message',
    related_event_id: null,
    is_read: true,
    channels: ['in_app'],
    metadata: {},
    status: 'read',
    read_at: null,
    created_at: new Date().toISOString(),
  },
  {
    id: 'unread',
    user_id: 'user-1',
    type: 'event_postponed',
    title: 'Unread event',
    message: 'Unread message',
    related_event_id: null,
    is_read: false,
    channels: ['in_app'],
    metadata: {},
    status: 'unread',
    read_at: null,
    created_at: new Date().toISOString(),
  },
];

describe('NotificationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fromMock.mockReturnValue({
      select: () => ({
        order: () => ({
          range: () => {
            const result = Promise.resolve({ data: rows, error: null });
            return Object.assign(result, {
              eq: async () => ({ data: rows.filter((row) => !row.is_read), error: null }),
            });
          },
        }),
      }),
    });
  });

  it('supports unread filtering and an empty-state message', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <NotificationsPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText(/Read event/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Mark all as read' }));
    expect(notificationState.markAllAsRead).toHaveBeenCalled();
    await user.click(screen.getByRole('tab', { name: /Unread/ }));
    expect(await screen.findByText(/Unread event/)).toBeInTheDocument();
    expect(screen.queryByText(/Read event/)).not.toBeInTheDocument();
  });

  it('shows the empty state when history has no rows', async () => {
    fromMock.mockReturnValue({
      select: () => ({
        order: () => ({
          range: () =>
            Object.assign(Promise.resolve({ data: [], error: null }), {
              eq: async () => ({ data: [], error: null }),
            }),
        }),
      }),
    });
    render(
      <MemoryRouter>
        <NotificationsPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText('You are all caught up')).toBeInTheDocument();
  });
});
