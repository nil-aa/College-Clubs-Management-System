import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardPage } from './DashboardPage';

const getAdminDashboardStatsMock = vi.hoisted(() => vi.fn());
const fromMock = vi.hoisted(() => vi.fn());
const permissionState = vi.hoisted(() => ({ allowed: false, loading: false }));
const roleState = vi.hoisted(() => ({ allowed: false, loading: false }));

vi.mock('@club-management/shared', () => ({ getAdminDashboardStats: getAdminDashboardStatsMock }));
vi.mock('../lib/supabase', () => ({ supabase: { from: fromMock } }));
vi.mock('../hooks/usePermission', () => ({
  usePermission: () => permissionState,
  useRole: () => roleState,
}));
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'student@example.test', user_metadata: {} },
    profile: { full_name: 'Test Student' },
  }),
}));
vi.mock('../context/NotificationContext', () => ({
  useNotifications: () => ({ latest: [], unreadCount: 0, markAsRead: vi.fn() }),
}));

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    permissionState.allowed = false;
    roleState.allowed = false;
    getAdminDashboardStatsMock.mockResolvedValue({
      active_club_count: 2,
      inactive_club_count: 1,
      clubs_without_head_count: 1,
      users_by_role: [{ role: 'student', count: 4 }],
      recent_audit_logs: [],
    });
    fromMock.mockReturnValue({});
  });

  it('renders the admin dashboard from one stats RPC', async () => {
    permissionState.allowed = true;
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText('Admin dashboard')).toBeInTheDocument();
    expect(screen.getByText('Active clubs')).toBeInTheDocument();
    expect(getAdminDashboardStatsMock).toHaveBeenCalledTimes(1);
  });

  it('renders the student dashboard and its empty notification state', () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );
    expect(screen.getByText('Welcome, Test Student')).toBeInTheDocument();
    expect(screen.getByText('You have no notifications yet.')).toBeInTheDocument();
    expect(screen.getByText('Events workspace')).toBeInTheDocument();
  });

  it('renders the Club Head dashboard with assigned clubs', async () => {
    roleState.allowed = true;
    fromMock.mockImplementation((table: string) => {
      if (table === 'roles') {
        return {
          select: () => ({
            eq: () => ({ single: async () => ({ data: { id: 'club-head-role' }, error: null }) }),
          }),
        };
      }
      if (table === 'user_roles') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  not: async () => ({ data: [{ club_id: 'club-1' }], error: null }),
                }),
              }),
            }),
          }),
        };
      }
      return {
        select: () => ({
          in: () => ({
            order: async () => ({
              data: [
                {
                  id: 'club-1',
                  name: 'Assigned Club',
                  slug: 'assigned-club',
                  description: null,
                  category: 'Technology',
                  contact_email: null,
                  status: 'active',
                  is_active: true,
                  created_by: null,
                  created_at: '',
                  updated_at: '',
                },
              ],
              error: null,
            }),
          }),
        }),
      };
    });
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText('Club Head workspace')).toBeInTheDocument();
    expect(await screen.findByText('Assigned Club')).toBeInTheDocument();
  });
});
