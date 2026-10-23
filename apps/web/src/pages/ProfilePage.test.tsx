import { MemoryRouter } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfilePage } from './ProfilePage';

const mocks = vi.hoisted(() => ({
  refreshProfile: vi.fn(),
  from: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  select: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'member@example.test' },
    profile: {
      id: 'user-1',
      full_name: 'Regular Member',
      avatar_url: null,
      phone: null,
      department: null,
      year_of_study: null,
      bio: null,
      status: 'active',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
    profileLoading: false,
    profileError: null,
    refreshProfile: mocks.refreshProfile,
  }),
}));

vi.mock('../lib/supabase', () => ({
  supabase: { from: mocks.from },
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <ProfilePage />
    </MemoryRouter>,
  );
}

describe('profile form', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.maybeSingle.mockResolvedValue({ data: { id: 'user-1' }, error: null });
    mocks.select.mockReturnValue({ maybeSingle: mocks.maybeSingle });
    mocks.eq.mockReturnValue({ select: mocks.select });
    mocks.update.mockReturnValue({ eq: mocks.eq });
    mocks.from.mockReturnValue({ update: mocks.update });
    mocks.refreshProfile.mockResolvedValue(null);
  });

  it('shows validation errors without updating', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.clear(screen.getByLabelText('Full name'));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(screen.getByText('Enter your full name.')).toBeInTheDocument();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('updates editable profile fields and refreshes the profile', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.clear(screen.getByLabelText('Full name'));
    await user.type(screen.getByLabelText('Full name'), 'Updated Member');
    await user.type(screen.getByLabelText('Department'), 'Computing');
    await user.type(screen.getByLabelText('Year of study'), '2');
    await user.type(screen.getByLabelText('Phone'), '+1 555 0100');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(mocks.update).toHaveBeenCalledWith({
        full_name: 'Updated Member',
        department: 'Computing',
        roll_number: null,
        year_of_study: 2,
        phone: '+1 555 0100',
      }),
    );
    expect(mocks.eq).toHaveBeenCalledWith('id', 'user-1');
    expect(mocks.refreshProfile).toHaveBeenCalled();
    expect(await screen.findByRole('status')).toHaveTextContent('Profile updated successfully.');
  });

  it('shows a safe database error when the update fails', async () => {
    mocks.maybeSingle.mockResolvedValueOnce({
      error: { code: '42501', message: 'Profile update denied with internal detail' },
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Something went wrong. Please try again.',
    );
    expect(screen.queryByText(/internal detail/)).not.toBeInTheDocument();
    expect(mocks.refreshProfile).not.toHaveBeenCalled();
  });

  it('does not report success when RLS returns no updated row', async () => {
    mocks.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Your profile was not updated.');
    expect(screen.queryByText('Profile updated successfully.')).not.toBeInTheDocument();
  });
});
