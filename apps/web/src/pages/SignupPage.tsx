import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FormField } from '../components/FormField';
import { useAuth } from '../context/AuthContext';
import {
  authErrorMessage,
  issuesToFieldErrors,
  passwordRequirements,
  signupSchema,
  type FieldErrors,
} from '../lib/validation';

const inputClass =
  'w-full rounded-xl border border-mutedSlate/50 bg-white px-4 py-3 text-slateDark shadow-sm outline-none transition placeholder:text-slateDark/45 focus:border-aqua focus:ring-4 focus:ring-aqua/35';

export function SignupPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');
    setSuccess('');
    const parsed = signupSchema.safeParse({ fullName, email, password, confirmPassword });
    if (!parsed.success) {
      setErrors(issuesToFieldErrors(parsed.error.issues));
      return;
    }
    setErrors({});
    setSubmitting(true);
    const { data, error } = await signUp(
      parsed.data.fullName,
      parsed.data.email,
      parsed.data.password,
    );
    setSubmitting(false);
    if (error) {
      setFormError(authErrorMessage(error.message));
      return;
    }
    if (data.session) {
      navigate('/', { replace: true });
    } else {
      setSuccess('Account created. Check your email to confirm your account before logging in.');
    }
  }

  return (
    <section className="rounded-3xl border border-mutedSlate/30 bg-white p-6 shadow-xl shadow-slateDark/10 sm:p-8">
      <div className="mb-7">
        <p className="text-sm font-semibold text-slateDark/75">Start your profile</p>
        <h2 className="mt-1 text-2xl font-bold text-slateDark">Create an account</h2>
      </div>
      {formError && (
        <div
          className="mb-5 rounded-xl border border-rose-200 bg-pink px-4 py-3 text-sm font-medium text-rose-900"
          role="alert"
        >
          {formError}
        </div>
      )}
      {success && (
        <div
          className="mb-5 rounded-xl border border-emerald-200 bg-mint px-4 py-3 text-sm font-medium text-emerald-950"
          role="status"
        >
          {success}
        </div>
      )}
      <form className="space-y-5" onSubmit={handleSubmit} noValidate>
        <FormField label="Full name" htmlFor="signup-name" error={errors.fullName}>
          <input
            id="signup-name"
            className={inputClass}
            type="text"
            autoComplete="name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            aria-invalid={Boolean(errors.fullName)}
          />
        </FormField>
        <FormField label="Email" htmlFor="signup-email" error={errors.email}>
          <input
            id="signup-email"
            className={inputClass}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={Boolean(errors.email)}
          />
        </FormField>
        <FormField
          label="Password"
          htmlFor="signup-password"
          hint={passwordRequirements}
          error={errors.password}
        >
          <input
            id="signup-password"
            className={inputClass}
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={Boolean(errors.password)}
          />
        </FormField>
        <FormField label="Confirm password" htmlFor="signup-confirm" error={errors.confirmPassword}>
          <input
            id="signup-confirm"
            className={inputClass}
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            aria-invalid={Boolean(errors.confirmPassword)}
          />
        </FormField>
        <button
          className="w-full rounded-xl bg-aqua px-4 py-3 font-bold text-slateDark shadow-lg shadow-aqua/30 transition hover:bg-aqua/80 focus:outline-none focus:ring-4 focus:ring-aqua/50 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={submitting}
          type="submit"
        >
          {submitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <p className="mt-7 text-center text-sm text-slateDark/75">
        Already registered?{' '}
        <Link
          className="font-bold text-slateDark underline decoration-lilac decoration-2 underline-offset-4"
          to="/login"
        >
          Log in
        </Link>
      </p>
    </section>
  );
}
