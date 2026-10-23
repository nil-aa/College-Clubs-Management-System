import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClubDirectoryPage } from './ClubDirectoryPage';

const getMock = vi.hoisted(() => vi.fn());

vi.mock('../features/api/client', () => ({
  apiErrorMessage: () => 'API error',
}));
vi.mock('../features/api/clubs', () => ({ getActiveClubs: getMock }));

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
    getMock.mockResolvedValue(clubs);
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
