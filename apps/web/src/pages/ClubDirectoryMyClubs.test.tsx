import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClubDirectoryPage } from './ClubDirectoryPage';

const getMock = vi.hoisted(() => vi.fn());
vi.mock('../features/api/client', () => ({
  apiErrorMessage: () => 'API error',
}));
vi.mock('../features/api/clubs', () => ({ getActiveClubs: getMock }));

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
    getMock.mockResolvedValue(clubs.filter((club) => club.is_active));
  });

  it('renders a single active directory without a My Clubs section', async () => {
    render(
      <MemoryRouter>
        <ClubDirectoryPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText('Other Club')).toBeInTheDocument();
    expect(screen.queryByText('My Inactive Club')).not.toBeInTheDocument();
    expect(screen.queryByText('My Clubs')).not.toBeInTheDocument();
  });
});
