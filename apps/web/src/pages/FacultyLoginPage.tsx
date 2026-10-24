import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, apiErrorMessage } from '../features/api/client';
import { useAuth } from '../context/AuthContext';
import {
  loginSchema,
  authErrorMessage,
  issuesToFieldErrors,
  type FieldErrors,
} from '../lib/validation';
import { FormField } from '../components/FormField';

type PermissionSnapshot = { roles: { code: string; clubId: string | null }[] };
const inputClass =
  'w-full rounded-xl border border-mutedSlate/50 bg-white px-4 py-3 text-slateDark shadow-sm outline-none focus:border-aqua focus:ring-4 focus:ring-aqua/35';

export function FacultyLoginPage() {
  const { signIn, signOut } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setErrors(issuesToFieldErrors(parsed.error.issues));
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const result = await signIn(parsed.data.email, parsed.data.password);
      if (result.error) {
        setFormError(authErrorMessage(result.error));
        return;
      }
      const snapshot = await api.get<PermissionSnapshot>('/me/permissions');
      if (!snapshot.roles.some((role) => role.code === 'faculty_coordinator' && role.clubId)) {
        await signOut();
        setFormError(
          'This account has no active Faculty Coordinator assignment. Ask an administrator to assign a club.',
        );
        return;
      }
      navigate('/faculty/od-reviews', { replace: true });
    } catch (error) {
      await signOut();
      setFormError(
        error instanceof Error && 'status' in error
          ? apiErrorMessage(error)
          : authErrorMessage(error),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-3xl border border-mutedSlate/30 bg-white p-6 shadow-xl sm:p-8">
      <p className="text-sm font-semibold text-slateDark/75">Faculty access</p>
      <h2 className="mt-1 text-2xl font-bold">Faculty Coordinator login</h2>
      <p className="mt-2 text-sm text-slateDark/70">
        Sign in with your assigned account to review closed participation lists.
      </p>
      {formError && (
        <p
          className="mt-5 rounded-xl border border-rose-200 bg-pink px-4 py-3 text-sm text-rose-900"
          role="alert"
        >
          {formError}
        </p>
      )}
      <form className="mt-6 space-y-5" onSubmit={handleSubmit} noValidate>
        <FormField label="Faculty email" htmlFor="faculty-email" error={errors.email}>
          <input
            id="faculty-email"
            className={inputClass}
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={Boolean(errors.email)}
          />
        </FormField>
        <FormField label="Password" htmlFor="faculty-password" error={errors.password}>
          <input
            id="faculty-password"
            className={inputClass}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={Boolean(errors.password)}
          />
        </FormField>
        <button
          className="w-full rounded-xl bg-aqua px-4 py-3 font-bold disabled:opacity-60"
          disabled={submitting}
          type="submit"
        >
          {submitting ? 'Checking access…' : 'Log in as faculty'}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-slateDark/70">
        <Link className="font-bold underline" to="/login">
          Return to student login
        </Link>
      </p>
    </section>
  );
}
