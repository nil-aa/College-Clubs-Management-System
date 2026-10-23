import { describe, expect, it } from 'vitest';
import { errorMessage } from './types';

describe('safe error messages', () => {
  it('maps common database outcomes to actionable messages', () => {
    expect(errorMessage({ code: '23505', message: 'duplicate secret' })).toMatch(/already exists/);
    expect(errorMessage({ code: 'PGRST116' })).toMatch(/could not be found/);
    expect(errorMessage({ code: '42501', message: 'internal schema detail' })).toBe(
      'Something went wrong. Please try again.',
    );
  });

  it('does not expose raw network or database errors', () => {
    expect(errorMessage({ message: 'password=secret failed to fetch' })).not.toContain('secret');
    expect(errorMessage(new Error('relation private_table does not exist'))).toBe(
      'Something went wrong. Please try again.',
    );
  });
});
