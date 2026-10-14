import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';

type FormFieldProps = {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: ReactNode;
};

export function FormField({ label, htmlFor, error, hint, children }: FormFieldProps) {
  const describedBy =
    [hint && `${htmlFor}-hint`, error && `${htmlFor}-error`].filter(Boolean).join(' ') || undefined;
  const field = isValidElement(children)
    ? cloneElement(children as ReactElement<{ 'aria-describedby'?: string }>, {
        'aria-describedby': describedBy,
      })
    : children;
  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-slateDark" htmlFor={htmlFor}>
        {label}
      </label>
      {field}
      {hint && (
        <p className="text-xs text-slateDark/75" id={`${htmlFor}-hint`}>
          {hint}
        </p>
      )}
      {error && (
        <p className="text-sm font-medium text-rose-800" id={`${htmlFor}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}
