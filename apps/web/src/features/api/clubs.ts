import { api } from './client';
import type { Club } from '../clubs/types';

const CACHE_WINDOW_MS = 10_000;
let cachedClubs: Club[] | null = null;
let cachedUntil = 0;
let inFlight: Promise<Club[]> | null = null;

/**
 * Loads the active directory with request de-duplication and a short-lived
 * cache. This avoids duplicate requests from React development remounts and
 * makes returning to the directory feel instant without persisting stale data.
 */
export function getActiveClubs(force = false): Promise<Club[]> {
  const now = Date.now();
  if (!force && cachedClubs && cachedUntil > now) return Promise.resolve(cachedClubs);
  if (inFlight) return inFlight;

  inFlight = api
    .get<Club[]>('/clubs')
    .then((clubs) => {
      cachedClubs = clubs;
      cachedUntil = Date.now() + CACHE_WINDOW_MS;
      return clubs;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

export function clearActiveClubsCache() {
  cachedClubs = null;
  cachedUntil = 0;
}
