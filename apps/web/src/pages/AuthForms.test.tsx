import { MemoryRouter } from 'react-router-dom';
import type { ReactElement } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginPage } from './LoginPage';
import { SignupPage } from './SignupPage';

const auth = vi.hoisted(() => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => auth,
}));

function renderPage(page: ReactElement) {
  return render(<MemoryRouter initialEntries={['/']}>{page}</MemoryRouter>);
}

describe('authentication forms', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.signIn.mockResolvedValue({ data: { user: null, session: null }, error: null });
    auth.signUp.mockResolvedValue({ data: { user: null, session: null }, error: null });
  });

  it('shows login validation messages before calling Supabase', async () => {
    const user = userEvent.setup();
    renderPage(<LoginPage />);

    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument();
    expect(screen.getByText('Enter your password.')).toBeInTheDocument();
    expect(auth.signIn).not.toHaveBeenCalled();
  });

  it('shows a clear login error from Supabase', async () => {
    auth.signIn.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { message: 'Invalid login credentials' },
    });
    const user = userEvent.setup();
    renderPage(<LoginPage />);

    await user.type(screen.getByLabelText('Email'), 'member@example.test');
    await user.type(screen.getByLabelText('Password'), 'WrongPass1');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect.');
  });

  it('submits a valid login form', async () => {
    const user = userEvent.setup();
    renderPage(<LoginPage />);

    await user.type(screen.getByLabelText('Email'), 'member@example.test');
    await user.type(screen.getByLabelText('Password'), 'CorrectPass1');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(auth.signIn).toHaveBeenCalledWith('member@example.test', 'CorrectPass1');
  });

  it('validates signup password rules and confirmation', async () => {
    const user = userEvent.setup();
    renderPage(<SignupPage />);

    await user.type(screen.getByLabelText('Full name'), 'New Member');
    await user.type(screen.getByLabelText('Email'), 'new@example.test');
    await user.type(screen.getByLabelText('Password'), 'weak');
    await user.type(screen.getByLabelText('Confirm password'), 'different');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(screen.getAllByText(/at least 8 characters/i).length).toBeGreaterThan(0);
    expect(screen.getByText('Passwords do not match.')).toBeInTheDocument();
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it('shows signup success when email confirmation is required', async () => {
    const user = userEvent.setup();
    renderPage(<SignupPage />);

    await user.type(screen.getByLabelText('Full name'), 'New Member');
    await user.type(screen.getByLabelText('Email'), 'new@example.test');
    await user.type(screen.getByLabelText('Password'), 'StrongPass1');
    await user.type(screen.getByLabelText('Confirm password'), 'StrongPass1');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(auth.signUp).toHaveBeenCalledWith('New Member', 'new@example.test', 'StrongPass1');
    expect(await screen.findByRole('status')).toHaveTextContent('Check your email');
  });
});
