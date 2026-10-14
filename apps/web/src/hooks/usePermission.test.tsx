import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePermission } from './usePermission';

const auth = vi.hoisted(() => ({ user: { id: 'user-1' } }));
const hasPermissionMock = vi.hoisted(() => vi.fn());

vi.mock('../context/AuthContext', () => ({
  useAuth: () => auth,
}));
vi.mock('@club-management/shared', () => ({
  hasPermission: hasPermissionMock,
  hasRole: vi.fn(),
}));

describe('usePermission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('checks the requested permission and club scope', async () => {
    hasPermissionMock.mockResolvedValue(true);
    const { result } = renderHook(() => usePermission('clubs.read', 'club-1'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.allowed).toBe(true);
    expect(hasPermissionMock).toHaveBeenCalledWith(expect.anything(), 'clubs.read', 'club-1');
  });

  it('denies access when the RPC rejects', async () => {
    hasPermissionMock.mockRejectedValue(new Error('permission check failed'));
    const { result } = renderHook(() => usePermission('roles.manage'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.allowed).toBe(false);
  });
});
