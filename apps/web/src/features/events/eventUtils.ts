export function formatEventDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function toDateTimeLocal(value: string) {
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function localInputToIso(value: string) {
  return new Date(value).toISOString();
}

export const eventStatusLabel = (status: string) =>
  status.charAt(0) + status.slice(1).toLowerCase();

export const panelClass = 'rounded-3xl border border-mutedSlate/25 bg-white p-5 shadow-sm sm:p-6';
export const primaryButtonClass =
  'inline-flex items-center justify-center rounded-xl bg-slateDark px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slateDark/90 focus:outline-none focus:ring-4 focus:ring-aqua/40 disabled:cursor-not-allowed disabled:opacity-60';
export const secondaryButtonClass =
  'inline-flex items-center justify-center rounded-xl border border-mutedSlate/50 bg-white px-4 py-2.5 text-sm font-bold text-slateDark transition hover:bg-lavender focus:outline-none focus:ring-4 focus:ring-aqua/40 disabled:cursor-not-allowed disabled:opacity-60';
export const fieldClass =
  'w-full rounded-xl border border-mutedSlate/50 bg-white px-3 py-2.5 text-sm text-slateDark outline-none focus:border-aqua focus:ring-4 focus:ring-aqua/35';
