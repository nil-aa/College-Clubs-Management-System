import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClubDirectoryPage } from './ClubDirectoryPage';

const fromMock = vi.hoisted(() => vi.fn());

vi.mock('../lib/supabase', () => ({ supabase: { from: fromMock } }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('../hooks/usePermission', () => ({ useRole: () => ({ allowed: false, loading: false }) }));

const clubs = [
  {
    id: '1',
    name: 'Computing Club',
    slug: 'computing',
    description: 'Build things',
    category: 'Technology',
    contact_email: null,
    status: 'active',
    is_active: true,
    created_by: null,
    created_at: '',
    updated_at: '',
  },
  {
    id: '2',
    name: 'Drama Club',
    slug: 'drama',
    description: 'Perform',
    category: 'Arts',
    contact_email: null,
    status: 'active',
    is_active: true,
    created_by: null,
    created_at: '',
    updated_at: '',
  },
];

describe('ClubDirectoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fromMock.mockReturnValue({
      select: () => ({ order: async () => ({ data: clubs, error: null }) }),
    });
  });

  it('filters the directory by search and category', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ClubDirectoryPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText('Computing Club')).toBeInTheDocument();
    expect(screen.getByText('Drama Club')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Search clubs'), 'computing');
    expect(screen.getByText('Computing Club')).toBeInTheDocument();
    expect(screen.queryByText('Drama Club')).not.toBeInTheDocument();
  });
});
