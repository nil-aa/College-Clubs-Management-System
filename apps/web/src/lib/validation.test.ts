import { describe, expect, it } from 'vitest';
import { authErrorMessage, emailSchema } from './validation';

describe('email validation', () => {
  it('trims and normalizes email case', () => {
    expect(emailSchema.parse('  Student@SSN.EDU.IN  ')).toBe('student@ssn.edu.in');
  });

  it('shows a friendly message for a denied signup domain', () => {
    expect(authErrorMessage('This email domain is not approved for sign-up.'))
      .toBe('This email domain is not approved for sign-up. Use an approved college email address.');
  });

  it('does not expose unknown backend error details', () => {
    expect(authErrorMessage('SQLSTATE 42501: private database detail'))
      .toBe('Something went wrong. Please try again.');
  });

  it('explains when Supabase cannot save a new signup', () => {
    expect(authErrorMessage({ message: 'Database error saving new user', status: 500, code: 'unexpected_failure' }, 'signup'))
      .toContain('check Supabase Auth logs');
  });

  it('distinguishes an unavailable Auth endpoint from a rejected signup', () => {
    expect(authErrorMessage({ name: 'AuthRetryableFetchError', message: 'Failed to fetch', status: 0 }, 'signup'))
      .toBe('Could not reach the account service. Check your connection and try again.');
  });

  it('uses the Auth error code for duplicate accounts', () => {
    expect(authErrorMessage({ message: 'User already registered', code: 'user_already_exists', status: 422 }, 'signup'))
      .toBe('An account with this email already exists.');
  });
});
