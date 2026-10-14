import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationBell } from './NotificationBell';

const state = vi.hoisted(() => ({
  latest: [],
  unreadCount: 12,
  error: '',
  markAsRead: vi.fn(),
}));

vi.mock('../context/NotificationContext', () => ({ useNotifications: () => state }));

describe('NotificationBell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.latest = [];
    state.unreadCount = 12;
  });

  it('caps the unread badge at 9+', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>,
    );
    expect(screen.getByLabelText('12 unread')).toHaveTextContent('9+');
    await user.click(screen.getByRole('button', { name: /notifications/i }));
    expect(screen.getByRole('link', { name: 'View all' })).toBeInTheDocument();
  });
});
