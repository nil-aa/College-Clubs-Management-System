/* eslint-disable no-unused-vars, no-undef */
import { supabase } from '../../lib/supabase';
export type { ApiPermissionSnapshot, ApiProfile } from '@club-management/shared';

const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  retried = false,
  accessTokenOverride?: string,
): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body) headers.set('Content-Type', 'application/json');
  if (accessTokenOverride || data.session?.access_token)
    headers.set('Authorization', `Bearer ${accessTokenOverride ?? data.session?.access_token}`);
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
  if (response.status === 401 && !retried) {
    const refreshed = await supabase.auth.refreshSession();
    if (!refreshed.error && refreshed.data.session)
      return request<T>(path, init, true, refreshed.data.session.access_token);
  }
  const body = (await response.json().catch(() => null)) as {
    error?: { code?: string; message?: string; details?: unknown };
  } | null;
  if (!response.ok)
    throw new ApiError(
      response.status,
      body?.error?.code ?? 'API_ERROR',
      body?.error?.message ?? 'The request failed.',
      body?.error?.details,
    );
  return body as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'DELETE',
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
};

export function apiErrorMessage(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : 'Could not reach the API. Check your connection and try again.';
}
