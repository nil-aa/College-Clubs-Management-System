export type Club = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string | null;
  contact_email: string | null;
  status: string;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ClubHead = { id: string; full_name: string };

export const inputClass =
  'w-full rounded-xl border border-mutedSlate/50 bg-white px-3 py-2.5 text-sm text-slateDark outline-none focus:border-aqua focus:ring-4 focus:ring-aqua/35';

export function errorMessage(error: unknown) {
  const value = error && typeof error === 'object' ? (error as Record<string, unknown>) : {};
  const code = typeof value.code === 'string' ? value.code : '';
  const status = typeof value.status === 'number' ? value.status : undefined;
  const message = typeof value.message === 'string' ? value.message.toLowerCase() : '';
  if (code === '23505') return 'This item already exists. Check for a duplicate and try again.';
  if (code === '23503')
    return 'This item is linked to other records and cannot be changed right now.';
  if (code === '23514' || code === '22023' || code === '22P02')
    return 'Some information is invalid. Review your entries and try again.';
  if (code === 'PGRST116') return 'This record could not be found or is no longer available.';
  if (
    status === 401 ||
    status === 403 ||
    /permission denied|not authorized|unauthorized/.test(message)
  ) {
    return status === 401
      ? 'Your session has expired. Please log in again.'
      : 'You do not have permission to perform this action.';
  }
  if (/registered participants/.test(message))
    return 'The schedule cannot be changed while participants are registered without confirming the change.';
  if (
    status === 0 ||
    /failed to fetch|networkerror|network request failed|load failed/.test(message)
  ) {
    return 'Could not reach the service. Check your connection and try again.';
  }
  if (status === 408 || status === 504 || /timeout|timed out/.test(message))
    return 'The request took too long. Please try again.';
  return 'Something went wrong. Please try again.';
}

export function isDuplicateClubError(error: unknown) {
  const message = errorMessage(error).toLowerCase();
  return (
    message.includes('already exists') || message.includes('duplicate') || message.includes('23505')
  );
}
