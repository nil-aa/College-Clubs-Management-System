import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FormField } from '../components/FormField';
import { useAuth } from '../context/AuthContext';
import {
  authErrorMessage,
  issuesToFieldErrors,
  loginSchema,
  type FieldErrors,
} from '../lib/validation';

const inputClass =
  'w-full rounded-xl border border-mutedSlate/50 bg-white px-4 py-3 text-slateDark shadow-sm outline-none transition placeholder:text-slateDark/45 focus:border-aqua focus:ring-4 focus:ring-aqua/35';

export function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
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
      const { error } = await signIn(parsed.data.email, parsed.data.password);
      if (error) {
        setFormError(authErrorMessage(error));
        return;
      }
      const from = typeof location.state?.from === 'string' ? location.state.from : '/';
      navigate(from, { replace: true });
    } catch (error) {
      setFormError(authErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-3xl border border-mutedSlate/30 bg-white p-6 shadow-xl shadow-slateDark/10 sm:p-8">
      <div className="mb-7">
        <p className="text-sm font-semibold text-slateDark/75">Welcome back</p>
        <h2 className="mt-1 text-2xl font-bold text-slateDark">Log in to your account</h2>
      </div>
      {formError && (
        <div
          className="mb-5 rounded-xl border border-rose-200 bg-pink px-4 py-3 text-sm font-medium text-rose-900"
          role="alert"
        >
          {formError}
        </div>
      )}
      <form className="space-y-5" onSubmit={handleSubmit} noValidate>
        <FormField label="Email" htmlFor="login-email" error={errors.email}>
          <input
            id="login-email"
            className={inputClass}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={Boolean(errors.email)}
          />
        </FormField>
        <FormField label="Password" htmlFor="login-password" error={errors.password}>
          <input
            id="login-password"
            className={inputClass}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={Boolean(errors.password)}
          />
        </FormField>
        <div className="flex justify-end">
          <Link
            className="text-sm font-semibold text-slateDark underline decoration-lilac decoration-2 underline-offset-4 hover:text-slateDark/75"
            to="/forgot-password"
          >
            Forgot password?
          </Link>
        </div>
        <button
          className="w-full rounded-xl bg-aqua px-4 py-3 font-bold text-slateDark shadow-lg shadow-aqua/30 transition hover:bg-aqua/80 focus:outline-none focus:ring-4 focus:ring-aqua/50 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={submitting}
          type="submit"
        >
          {submitting ? 'Logging in…' : 'Log in'}
        </button>
      </form>
      <p className="mt-7 text-center text-sm text-slateDark/75">
        New here?{' '}
        <Link
          className="font-bold text-slateDark underline decoration-lilac decoration-2 underline-offset-4"
          to="/signup"
        >
          Create an account
        </Link>
      </p>
    </section>
  );
}
