import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuditLogPage } from './AuditLogPage';

const listAuditLogsMock = vi.hoisted(() => vi.fn());
const fromMock = vi.hoisted(() => vi.fn());
const permissionState = vi.hoisted(() => ({ allowed: true, loading: false }));

vi.mock('@club-management/shared', () => ({ listAuditLogs: listAuditLogsMock }));
vi.mock('../lib/supabase', () => ({ supabase: { from: fromMock } }));
vi.mock('../hooks/usePermission', () => ({ usePermission: () => permissionState }));

const row = {
  actor_id: 'admin-1',
  actor_name: 'Global Admin',
  action: 'club.created',
  entity_type: 'clubs',
  entity_id: 'club-1',
  details: { name: 'Computing Club' },
  created_at: '2026-10-14T10:00:00.000Z',
  total_count: 21,
};

describe('AuditLogPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    permissionState.allowed = true;
    fromMock.mockReturnValue({
      select: () => ({
        order: async () => ({
          data: [{ id: 'admin-1', full_name: 'Global Admin', email: 'admin@example.test' }],
          error: null,
        }),
      }),
    });
    listAuditLogsMock.mockResolvedValue([row]);
  });

  it('blocks the page for users without audit permission', () => {
    permissionState.allowed = false;
    render(<AuditLogPage />);
    expect(screen.getByRole('alert')).toHaveTextContent('Only admins can view the audit log.');
    expect(listAuditLogsMock).not.toHaveBeenCalled();
  });

  it('applies filters and expands formatted details', async () => {
    const user = userEvent.setup();
    render(<AuditLogPage />);
    expect(await screen.findByText('Club created')).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Filter by action'), 'club.created');
    await user.click(screen.getByRole('button', { name: 'Apply filters' }));
    await waitFor(() =>
      expect(listAuditLogsMock).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({ action: 'club.created', offset: 0, limit: 20 }),
      ),
    );
    await user.click(screen.getByRole('button', { name: 'View details' }));
    expect(screen.getByText(/"name": "Computing Club"/)).toBeInTheDocument();
  });

  it('moves to the next page when the RPC reports more rows', async () => {
    const user = userEvent.setup();
    listAuditLogsMock.mockResolvedValue(
      Array.from({ length: 20 }, (_, index) => ({ ...row, entity_id: `club-${index}` })),
    );
    render(<AuditLogPage />);
    expect(await screen.findByText('Showing 1–20 of 21')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() =>
      expect(listAuditLogsMock).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({ offset: 20 }),
      ),
    );
  });
});
