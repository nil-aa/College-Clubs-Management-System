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
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error && 'message' in error) return String(error.message);
  return 'Something went wrong. Please try again.';
}

export function isDuplicateClubError(error: unknown) {
  const message = errorMessage(error).toLowerCase();
  return (
    message.includes('already exists') || message.includes('duplicate') || message.includes('23505')
  );
}
