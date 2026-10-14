/* eslint-disable no-unused-vars */
import { useEffect, useState, type FormEvent } from 'react';
import { FormField } from '../../components/FormField';
import { clubSchema, issuesToFieldErrors, type FieldErrors } from '../../lib/validation';
import { inputClass, type Club } from './types';

type ClubFormValues = {
  name: string;
  description: string;
  category: string;
  contactEmail: string;
};

type ClubFormProps = {
  initialClub?: Club | null;
  submitting?: boolean;
  serverError?: string;
  onSubmit: (values: ClubFormValues) => Promise<void>;
  onCancel?: () => void;
};

function valuesFromClub(club?: Club | null): ClubFormValues {
  return {
    name: club?.name ?? '',
    description: club?.description ?? '',
    category: club?.category ?? '',
    contactEmail: club?.contact_email ?? '',
  };
}

export function ClubForm({
  initialClub,
  submitting = false,
  serverError = '',
  onSubmit,
  onCancel,
}: ClubFormProps) {
  const [values, setValues] = useState(() => valuesFromClub(initialClub));
  const [errors, setErrors] = useState<FieldErrors>({});

  useEffect(() => {
    setValues(valuesFromClub(initialClub));
    setErrors({});
  }, [initialClub?.id]);

  function setValue(field: keyof ClubFormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = clubSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(issuesToFieldErrors(parsed.error.issues));
      return;
    }
    setErrors({});
    await onSubmit(parsed.data);
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit} noValidate>
      {serverError && (
        <p
          className="rounded-xl border border-rose-200 bg-pink px-4 py-3 text-sm font-medium text-rose-900"
          role="alert"
        >
          {serverError}
        </p>
      )}
      <FormField label="Name" htmlFor="club-name" error={errors.name}>
        <input
          id="club-name"
          className={inputClass}
          value={values.name}
          onChange={(e) => setValue('name', e.target.value)}
          aria-invalid={Boolean(errors.name)}
        />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Category" htmlFor="club-category" error={errors.category}>
          <input
            id="club-category"
            className={inputClass}
            value={values.category}
            onChange={(e) => setValue('category', e.target.value)}
            aria-invalid={Boolean(errors.category)}
          />
        </FormField>
        <FormField label="Contact email" htmlFor="club-contact-email" error={errors.contactEmail}>
          <input
            id="club-contact-email"
            className={inputClass}
            type="email"
            value={values.contactEmail}
            onChange={(e) => setValue('contactEmail', e.target.value)}
            aria-invalid={Boolean(errors.contactEmail)}
          />
        </FormField>
      </div>
      <FormField label="Description" htmlFor="club-description" error={errors.description}>
        <textarea
          id="club-description"
          className={`${inputClass} min-h-28`}
          value={values.description}
          onChange={(e) => setValue('description', e.target.value)}
          aria-invalid={Boolean(errors.description)}
        />
      </FormField>
      <div className="flex flex-wrap justify-end gap-3">
        {onCancel && (
          <button
            className="rounded-xl border border-mutedSlate/50 px-4 py-2.5 text-sm font-bold text-slateDark hover:bg-pink focus:outline-none focus:ring-4 focus:ring-aqua/40"
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
        )}
        <button
          className="rounded-xl bg-aqua px-5 py-2.5 text-sm font-bold text-slateDark hover:bg-aqua/80 focus:outline-none focus:ring-4 focus:ring-aqua/45 disabled:opacity-60"
          disabled={submitting}
          type="submit"
        >
          {submitting ? 'Saving…' : initialClub ? 'Save changes' : 'Create club'}
        </button>
      </div>
    </form>
  );
}

export type { ClubFormValues };
