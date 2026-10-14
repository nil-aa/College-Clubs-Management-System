import { MemoryRouter } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventsPage } from './EventsPage';

const listStudentEventsMock = vi.hoisted(() => vi.fn());
const fromMock = vi.hoisted(() => vi.fn());
vi.mock('@club-management/shared', () => ({ listStudentEvents: listStudentEventsMock }));
vi.mock('../lib/supabase', () => ({ supabase: { from: fromMock } }));
vi.mock('../hooks/usePermission', () => ({ useRole: (role: string) => ({ allowed: role === 'student', loading: false }) }));
vi.mock('../features/events/useManagedClubs', () => ({ useManagedClubs: () => ({ clubs: [], loading: false, error: '' }) }));

const event = {
  event_id: 'evt-1', club_id: 'club-1', club_name: 'Robotics Club',
  title: 'Robot Showcase', description: 'Student robot demos', venue: 'Main Hall',
  category: 'Technology', start_time: '2030-02-03T10:00:00Z', end_time: '2030-02-03T12:00:00Z',
  registration_deadline: '2030-02-02T10:00:00Z', capacity: 40, status: 'PUBLISHED',
  published_at: '2030-01-01T00:00:00Z', registration_count: 12,
  registration_availability: 'AVAILABLE' as const,
};

describe('EventsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listStudentEventsMock.mockResolvedValue([event]);
    fromMock.mockReturnValue({ select: () => ({ eq: () => ({ order: async () => ({ data: [{ id: 'club-1', name: 'Robotics Club' }], error: null }) }) }) });
  });

  it('lists published events and applies search and club filters through the discovery RPC', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><EventsPage /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Robot Showcase' })).toBeInTheDocument();
    expect(screen.getByText('12 / 40 registered')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Search events'), 'robot');
    await user.selectOptions(screen.getByLabelText('Club'), 'club-1');
    await user.click(screen.getByRole('button', { name: 'Apply filters' }));
    await waitFor(() => expect(listStudentEventsMock).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ search: 'robot', clubId: 'club-1' })));
  });

  it('shows a useful empty state when no events match', async () => {
    listStudentEventsMock.mockResolvedValue([]);
    render(<MemoryRouter><EventsPage /></MemoryRouter>);
    expect(await screen.findByText('No events found')).toBeInTheDocument();
  });
});
