import { useEffect, useState, type FormEvent } from 'react';
import { FormField } from '../components/FormField';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { issuesToFieldErrors, profileSchema, type FieldErrors } from '../lib/validation';

const inputClass =
  'w-full rounded-xl border border-mutedSlate/50 bg-white px-4 py-3 text-slateDark shadow-sm outline-none transition placeholder:text-slateDark/45 focus:border-aqua focus:ring-4 focus:ring-aqua/35';

export function ProfilePage() {
  const { user, profile, profileLoading, profileError, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState('');
  const [department, setDepartment] = useState('');
  const [yearOfStudy, setYearOfStudy] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name);
    setDepartment(profile.department ?? '');
    setYearOfStudy(profile.year_of_study?.toString() ?? '');
    setPhone(profile.phone ?? '');
  }, [
    profile?.id,
    profile?.full_name,
    profile?.department,
    profile?.year_of_study,
    profile?.phone,
  ]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');
    setSuccess('');
    const parsed = profileSchema.safeParse({ fullName, department, yearOfStudy, phone });
    if (!parsed.success) {
      setErrors(issuesToFieldErrors(parsed.error.issues));
      return;
    }
    if (!user) {
      setFormError('Your session has expired. Please log in again.');
      return;
    }
    setErrors({});
    setSubmitting(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: parsed.data.fullName,
        department: parsed.data.department || null,
        year_of_study: parsed.data.yearOfStudy ? Number(parsed.data.yearOfStudy) : null,
        phone: parsed.data.phone || null,
      })
      .eq('id', user.id);
    setSubmitting(false);
    if (error) {
      setFormError(error.message || 'We could not update your profile.');
      return;
    }
    try {
      await refreshProfile();
      setSuccess('Profile updated successfully.');
    } catch {
      setFormError(
        'Your profile was saved, but it could not be reloaded. Refresh the page to see it.',
      );
    }
  }

  if (profileLoading && !profile) {
    return (
      <div className="rounded-3xl border border-mutedSlate/30 bg-white p-8 text-slateDark">
        Loading your profile…
      </div>
    );
  }

  return (
    <section className="max-w-3xl rounded-3xl border border-mutedSlate/30 bg-white p-6 shadow-xl shadow-slateDark/10 sm:p-8">
      <div className="mb-8">
        <p className="text-sm font-semibold text-slateDark/75">Your account</p>
        <h1 className="mt-1 text-3xl font-bold text-slateDark">Profile</h1>
        <p className="mt-2 text-sm text-slateDark/75">
          Keep your personal and academic details up to date.
        </p>
      </div>
      {profileError && (
        <div
          className="mb-5 rounded-xl border border-rose-200 bg-pink px-4 py-3 text-sm font-medium text-rose-900"
          role="alert"
        >
          {profileError.message}
        </div>
      )}
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
      <div className="mb-7 rounded-2xl bg-mint/60 p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-slateDark/75">Login email</p>
        <p className="mt-1 font-semibold text-slateDark">{user?.email ?? 'Unavailable'}</p>
        <p className="mt-1 text-xs text-slateDark/70">
          Email and account identity are managed by Supabase Auth.
        </p>
      </div>
      <form className="space-y-5" onSubmit={handleSubmit} noValidate>
        <FormField label="Full name" htmlFor="profile-name" error={errors.fullName}>
          <input
            id="profile-name"
            className={inputClass}
            type="text"
            autoComplete="name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            aria-invalid={Boolean(errors.fullName)}
          />
        </FormField>
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="Department" htmlFor="profile-department" error={errors.department}>
            <input
              id="profile-department"
              className={inputClass}
              type="text"
              autoComplete="organization-title"
              value={department}
              onChange={(event) => setDepartment(event.target.value)}
              aria-invalid={Boolean(errors.department)}
            />
          </FormField>
          <FormField
            label="Year of study"
            htmlFor="profile-year"
            error={errors.yearOfStudy}
            hint="Enter a number from 1 to 10."
          >
            <input
              id="profile-year"
              className={inputClass}
              type="number"
              min="1"
              max="10"
              inputMode="numeric"
              value={yearOfStudy}
              onChange={(event) => setYearOfStudy(event.target.value)}
              aria-invalid={Boolean(errors.yearOfStudy)}
            />
          </FormField>
        </div>
        <FormField label="Phone" htmlFor="profile-phone" error={errors.phone}>
          <input
            id="profile-phone"
            className={inputClass}
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            aria-invalid={Boolean(errors.phone)}
          />
        </FormField>
        <div className="flex justify-end">
          <button
            className="rounded-xl bg-aqua px-6 py-3 font-bold text-slateDark shadow-lg shadow-aqua/30 transition hover:bg-aqua/80 focus:outline-none focus:ring-4 focus:ring-aqua/50 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={submitting || !profile}
            type="submit"
          >
            {submitting ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </section>
  );
}
