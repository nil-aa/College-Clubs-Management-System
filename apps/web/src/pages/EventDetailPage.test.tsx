import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventDetailPage } from './EventDetailPage';

const getStudentEventMock = vi.hoisted(() => vi.fn());
const registerForEventMock = vi.hoisted(() => vi.fn());
const cancelEventRegistrationMock = vi.hoisted(() => vi.fn());
const listMyEventRegistrationsMock = vi.hoisted(() => vi.fn());
const fromMock = vi.hoisted(() => vi.fn());
vi.mock('@club-management/shared', () => ({
  getStudentEvent: getStudentEventMock,
  registerForEvent: registerForEventMock,
  cancelEventRegistration: cancelEventRegistrationMock,
  listMyEventRegistrations: listMyEventRegistrationsMock,
}));
vi.mock('../lib/supabase', () => ({ supabase: { from: fromMock } }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'head-1' } }) }));
vi.mock('../hooks/usePermission', () => ({ useRole: () => ({ allowed: false, loading: false }) }));
vi.mock('../features/events/useManagedClubs', () => ({ useManagedClubs: () => ({ clubs: [{ id: 'club-owned' }], loading: false }) }));

const event = {
  event_id: 'event-other-club', club_id: 'club-other', club_name: 'Other Club',
  title: 'Open Event', description: 'Open to everyone', venue: 'Hall A', category: 'Arts',
  start_time: '2030-02-03T10:00:00Z', end_time: '2030-02-03T12:00:00Z',
  registration_deadline: '2030-02-02T10:00:00Z', capacity: 20, status: 'PUBLISHED',
  published_at: '2030-01-01T00:00:00Z', registration_count: 3,
  registration_availability: 'AVAILABLE' as const,
};

describe('EventDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getStudentEventMock.mockResolvedValue(event);
    registerForEventMock.mockResolvedValue({ status: 'REGISTERED' });
    listMyEventRegistrationsMock.mockResolvedValue([]);
    fromMock.mockReturnValue({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }) });
  });

  it('lets a club head register for an event outside their managed clubs', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={['/events/event-other-club']}><Routes><Route path="/events/:eventId" element={<EventDetailPage />} /></Routes></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Open Event' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Register' }));
    expect(registerForEventMock).toHaveBeenCalledWith(expect.anything(), 'event-other-club');
    expect(await screen.findByText('You are registered for this event.')).toBeInTheDocument();
  });

  it('does not register when the student cancels an overlap warning', async () => {
    listMyEventRegistrationsMock.mockResolvedValue([{
      event_id: 'other-event', title: 'Other Event', registration_status: 'REGISTERED',
      event_status: 'PUBLISHED', start_time: '2030-02-03T11:00:00Z', end_time: '2030-02-03T13:00:00Z',
    }]);
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={['/events/event-other-club']}><Routes><Route path="/events/:eventId" element={<EventDetailPage />} /></Routes></MemoryRouter>);
    await user.click(await screen.findByRole('button', { name: 'Register' }));
    expect(await screen.findByRole('dialog', { name: 'Overlapping event registration' })).toHaveTextContent('Other Event');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(registerForEventMock).not.toHaveBeenCalled();
  });

  it('continues registration after the student confirms an overlap warning', async () => {
    listMyEventRegistrationsMock.mockResolvedValue([
      {
        event_id: 'other-event', title: 'Other Event', registration_status: 'REGISTERED',
        event_status: 'PUBLISHED', start_time: '2030-02-03T11:00:00Z', end_time: '2030-02-03T13:00:00Z',
      },
      {
        event_id: 'another-event', title: 'Another Event', registration_status: 'REGISTERED',
        event_status: 'PUBLISHED', start_time: '2030-02-03T09:00:00Z', end_time: '2030-02-03T11:00:00Z',
      },
    ]);
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={['/events/event-other-club']}><Routes><Route path="/events/:eventId" element={<EventDetailPage />} /></Routes></MemoryRouter>);
    await user.click(await screen.findByRole('button', { name: 'Register' }));
    expect(await screen.findByRole('dialog', { name: 'Overlapping event registration' })).toHaveTextContent('2 events');
    expect(screen.getByRole('dialog')).toHaveTextContent('Other Event');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(registerForEventMock).toHaveBeenCalledWith(expect.anything(), 'event-other-club');
    expect(await screen.findByText('You are registered for this event.')).toBeInTheDocument();
    expect(listMyEventRegistrationsMock).toHaveBeenCalledTimes(1);
  });
});
