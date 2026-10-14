import { describe, expect, it } from 'vitest';
import { resolveNotificationHref } from './types';

describe('notification link resolver', () => {
  it('hides event links when the event route is not registered', () => {
    expect(resolveNotificationHref({ related_event_id: 'event-1' })).toBeNull();
  });

  it('creates an event link only when the owning route is registered', () => {
    expect(resolveNotificationHref({ related_event_id: 'event-1' }, ['/events/:id'])).toBe(
      '/events/event-1',
    );
  });
});
