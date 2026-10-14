import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { FormField } from '../components/FormField';
import { useAuth } from '../context/AuthContext';
import {
  authErrorMessage,
  forgotPasswordSchema,
  issuesToFieldErrors,
  type FieldErrors,
} from '../lib/validation';

const inputClass =
  'w-full rounded-xl border border-mutedSlate/50 bg-white px-4 py-3 text-slateDark shadow-sm outline-none transition placeholder:text-slateDark/45 focus:border-aqua focus:ring-4 focus:ring-aqua/35';

export function ForgotPasswordPage() {
  const { resetPasswordForEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');
    setSuccess('');
    const parsed = forgotPasswordSchema.safeParse({ email });
    if (!parsed.success) {
      setErrors(issuesToFieldErrors(parsed.error.issues));
      return;
    }
    setErrors({});
    setSubmitting(true);
    const { error } = await resetPasswordForEmail(parsed.data.email);
    setSubmitting(false);
    if (error) {
      setFormError(authErrorMessage(error.message));
      return;
    }
    setSuccess('If an account exists for that email, a password reset link is on its way.');
  }

  return (
    <section className="rounded-3xl border border-mutedSlate/30 bg-white p-6 shadow-xl shadow-slateDark/10 sm:p-8">
      <div className="mb-7">
        <p className="text-sm font-semibold text-slateDark/75">Account recovery</p>
        <h2 className="mt-1 text-2xl font-bold text-slateDark">Reset your password</h2>
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
        <FormField
          label="Email"
          htmlFor="forgot-email"
          error={errors.email}
          hint="We will send a secure reset link if the account exists."
        >
          <input
            id="forgot-email"
            className={inputClass}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={Boolean(errors.email)}
          />
        </FormField>
        <button
          className="w-full rounded-xl bg-aqua px-4 py-3 font-bold text-slateDark shadow-lg shadow-aqua/30 transition hover:bg-aqua/80 focus:outline-none focus:ring-4 focus:ring-aqua/50 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={submitting}
          type="submit"
        >
          {submitting ? 'Sending link…' : 'Send reset link'}
        </button>
      </form>
      <p className="mt-7 text-center text-sm text-slateDark/75">
        <Link
          className="font-bold text-slateDark underline decoration-lilac decoration-2 underline-offset-4"
          to="/login"
        >
          Back to log in
        </Link>
      </p>
    </section>
  );
}
