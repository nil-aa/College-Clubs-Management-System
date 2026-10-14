import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { FormField } from '../components/FormField';
import { useAuth } from '../context/AuthContext';
import {
  authErrorMessage,
  issuesToFieldErrors,
  passwordRequirements,
  resetPasswordSchema,
  type FieldErrors,
} from '../lib/validation';

const inputClass =
  'w-full rounded-xl border border-mutedSlate/50 bg-white px-4 py-3 text-slateDark shadow-sm outline-none transition placeholder:text-slateDark/45 focus:border-aqua focus:ring-4 focus:ring-aqua/35';

export function ResetPasswordPage() {
  const { session, loading, updatePassword } = useAuth();
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
    const parsed = resetPasswordSchema.safeParse({ password, confirmPassword });
    if (!parsed.success) {
      setErrors(issuesToFieldErrors(parsed.error.issues));
      return;
    }
    if (!session) {
      setFormError('This reset link is missing or has expired. Request a new one.');
      return;
    }
    setErrors({});
    setSubmitting(true);
    const { error } = await updatePassword(parsed.data.password);
    setSubmitting(false);
    if (error) {
      setFormError(authErrorMessage(error.message));
      return;
    }
    setSuccess('Your password has been updated. You can continue to the dashboard.');
    setPassword('');
    setConfirmPassword('');
  }

  if (loading)
    return (
      <div className="rounded-3xl border border-mutedSlate/30 bg-white p-8 text-center text-slateDark">
        Checking reset link…
      </div>
    );

  return (
    <section className="rounded-3xl border border-mutedSlate/30 bg-white p-6 shadow-xl shadow-slateDark/10 sm:p-8">
      <div className="mb-7">
        <p className="text-sm font-semibold text-slateDark/75">Secure recovery</p>
        <h2 className="mt-1 text-2xl font-bold text-slateDark">Choose a new password</h2>
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
      {!session && !success && (
        <div
          className="mb-5 rounded-xl border border-amber-200 bg-pink px-4 py-3 text-sm font-medium text-amber-950"
          role="alert"
        >
          Open this page from the password reset email.
        </div>
      )}
      <form className="space-y-5" onSubmit={handleSubmit} noValidate>
        <FormField
          label="New password"
          htmlFor="reset-password"
          hint={passwordRequirements}
          error={errors.password}
        >
          <input
            id="reset-password"
            className={inputClass}
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={Boolean(errors.password)}
          />
        </FormField>
        <FormField
          label="Confirm new password"
          htmlFor="reset-confirm"
          error={errors.confirmPassword}
        >
          <input
            id="reset-confirm"
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
          disabled={submitting || !session}
          type="submit"
        >
          {submitting ? 'Updating password…' : 'Update password'}
        </button>
      </form>
      <p className="mt-7 text-center text-sm text-slateDark/75">
        <Link
          className="font-bold text-slateDark underline decoration-lilac decoration-2 underline-offset-4"
          to="/"
        >
          Go to dashboard
        </Link>
      </p>
    </section>
  );
}
