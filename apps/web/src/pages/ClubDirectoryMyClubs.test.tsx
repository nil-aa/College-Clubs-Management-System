import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClubDirectoryPage } from './ClubDirectoryPage';

const fromMock = vi.hoisted(() => vi.fn());
vi.mock('../lib/supabase', () => ({ supabase: { from: fromMock } }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }));
vi.mock('../hooks/usePermission', () => ({ useRole: () => ({ allowed: true, loading: false }) }));

const clubs = [
  {
    id: 'club-1',
    name: 'My Inactive Club',
    slug: 'mine',
    description: null,
    category: 'Arts',
    contact_email: null,
    status: 'archived',
    is_active: false,
    created_by: null,
    created_at: '',
    updated_at: '',
  },
  {
    id: 'club-2',
    name: 'Other Club',
    slug: 'other',
    description: null,
    category: 'Tech',
    contact_email: null,
    status: 'active',
    is_active: true,
    created_by: null,
    created_at: '',
    updated_at: '',
  },
];

describe('ClubDirectoryPage My Clubs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fromMock.mockImplementation((table: string) => {
      if (table === 'clubs')
        return { select: () => ({ order: async () => ({ data: clubs, error: null }) }) };
      if (table === 'roles')
        return {
          select: () => ({
            eq: () => ({ single: async () => ({ data: { id: 'role-head' }, error: null }) }),
          }),
        };
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({ eq: async () => ({ data: [{ club_id: 'club-1' }], error: null }) }),
          }),
        }),
      };
    });
  });

  it('shows assigned inactive clubs in My Clubs', async () => {
    render(
      <MemoryRouter>
        <ClubDirectoryPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText('My Inactive Club')).toBeInTheDocument();
    expect(screen.getByText('My Clubs')).toBeInTheDocument();
  });
});
