import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from './client';

const auth = vi.hoisted(() => ({
  getSession: vi.fn(),
  refreshSession: vi.fn(),
}));

vi.mock('../../lib/supabase', () => ({ supabase: { auth } }));

describe('API client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.getSession.mockResolvedValue({ data: { session: { access_token: 'old-token' } } });
    auth.refreshSession.mockResolvedValue({
      data: { session: { access_token: 'new-token' } },
      error: null,
    });
  });

  it('refreshes once and retries after a 401', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { code: 'UNAUTHENTICATED', message: 'expired' } }), {
          status: 401,
        }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    await expect(api.get('/users/me')).resolves.toEqual({ ok: true });
    expect(auth.refreshSession).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ headers: expect.any(Headers) });
    expect((fetchMock.mock.calls[1][1]!.headers as Headers).get('Authorization')).toBe(
      'Bearer new-token',
    );
  });

  it('maps API errors to ApiError without exposing response internals', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { code: 'FORBIDDEN', message: 'No access', details: { field: 'x' } },
        }),
        { status: 403 },
      ),
    );
    await expect(api.get('/admin/clubs')).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
      message: 'No access',
    });
  });
});
