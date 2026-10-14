import { describe, expect, it, vi } from 'vitest';
import { hasPermission, hasRole, logAudit, type AppSupabaseClient } from './helpers';

function clientReturning(data: unknown) {
  return { rpc: vi.fn().mockResolvedValue({ data, error: null }) } as unknown as AppSupabaseClient;
}

describe('shared helper wrappers', () => {
  it('passes club scope to hasPermission', async () => {
    const client = clientReturning(true);
    await expect(hasPermission(client, 'clubs.read', 'club-1')).resolves.toBe(true);
    expect(client.rpc as ReturnType<typeof vi.fn>).toHaveBeenCalledWith('has_permission', {
      p_permission: 'clubs.read',
      p_club_id: 'club-1',
    });
  });

  it('passes role scope to hasRole', async () => {
    const client = clientReturning(false);
    await expect(hasRole(client, 'president', 'club-2')).resolves.toBe(false);
    expect(client.rpc as ReturnType<typeof vi.fn>).toHaveBeenCalledWith('has_role', {
      p_role: 'president',
      p_club_id: 'club-2',
    });
  });

  it('returns the database audit id', async () => {
    const client = clientReturning(42);
    await expect(logAudit(client, 'create', 'club', null)).resolves.toBe(42);
  });

  it('propagates RPC errors', async () => {
    const client = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: new Error('RPC failed') }),
    } as unknown as AppSupabaseClient;
    await expect(hasPermission(client, 'clubs.read')).rejects.toThrow('RPC failed');
  });
});
