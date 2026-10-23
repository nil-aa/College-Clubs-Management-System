import { z } from 'zod';

export const passwordRequirements =
  'At least 8 characters with an uppercase letter, a lowercase letter, and a number.';

export const emailSchema = z
  .string()
  .trim()
  .email('Enter a valid email address.')
  .transform((email) => email.toLowerCase());

export const passwordSchema = z
  .string()
  .min(8, passwordRequirements)
  .regex(/[A-Z]/, passwordRequirements)
  .regex(/[a-z]/, passwordRequirements)
  .regex(/[0-9]/, passwordRequirements);

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password.'),
});

export const signupSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Enter your full name.'),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Confirm your password.'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match.',
  });

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Confirm your password.'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match.',
  });

export const profileSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter your full name.'),
  department: z.string().trim().max(120, 'Department must be 120 characters or fewer.'),
  rollNumber: z
    .string()
    .trim()
    .regex(/^(?:[0-9]{10})?$/, 'Register number must contain exactly 10 digits.'),
  yearOfStudy: z
    .string()
    .refine((value) => value === '' || /^[1-5]$/.test(value), 'Enter a year from 1 to 5.'),
  phone: z
    .string()
    .trim()
    .max(32, 'Phone number must be 32 characters or fewer.')
    .regex(/^[+()\-\s\d]*$/, 'Enter a valid phone number.'),
});

export const clubSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Enter a club name.')
    .max(120, 'Club name must be 120 characters or fewer.'),
  description: z.string().trim().max(2000, 'Description must be 2000 characters or fewer.'),
  category: z.string().trim().max(80, 'Category must be 80 characters or fewer.'),
  contactEmail: z.union([z.literal(''), emailSchema]),
});

export type FieldErrors = Record<string, string>;

export function issuesToFieldErrors(issues: z.ZodIssue[]): FieldErrors {
  return issues.reduce<FieldErrors>((errors, issue) => {
    const field = String(issue.path[0] ?? 'form');
    if (!errors[field]) errors[field] = issue.message;
    return errors;
  }, {});
}

export function authErrorMessage(error: unknown, context: 'auth' | 'signup' = 'auth') {
  const fields: Array<{ message: string; code: string; status?: number; name: string }> = [];
  const collect = (value: unknown, depth = 0) => {
    if (depth > 2) return;
    if (typeof value === 'string') {
      fields.push({ message: value, code: '', name: '' });
      return;
    }
    if (!value || typeof value !== 'object') return;
    const item = value as Record<string, unknown>;
    fields.push({
      message: typeof item.message === 'string' ? item.message : '',
      code: typeof item.code === 'string' ? item.code.toLowerCase() : '',
      status: typeof item.status === 'number' ? item.status : undefined,
      name: typeof item.name === 'string' ? item.name.toLowerCase() : '',
    });
    collect(item.cause, depth + 1);
    collect(item.originalError, depth + 1);
  };
  collect(error);
  const normalized = fields.map((field) => field.message.toLowerCase()).join(' ');
  const codes = fields.map((field) => field.code);
  const status = fields.find((field) => field.status !== undefined)?.status;
  const name = fields.map((field) => field.name).join(' ');

  if (codes.includes('email_address_not_authorized') || codes.includes('signup_domain_not_allowed') ||
      (normalized.includes('domain') && (normalized.includes('approved') || normalized.includes('signup')))) {
    return 'This email domain is not approved for sign-up. Use an approved college email address.';
  }
  if (codes.includes('email_exists') || codes.includes('user_already_exists') ||
      normalized.includes('already registered') || normalized.includes('already been registered')) {
    return 'An account with this email already exists.';
  }
  if (codes.includes('weak_password') || normalized.includes('password'))
    return 'That password was not accepted. Check the password rules.';
  if (codes.includes('signup_disabled')) return 'New account creation is currently disabled. Contact the administrator.';
  if (codes.includes('email_provider_disabled')) return 'Email sign-up is currently unavailable. Contact the administrator.';
  if (codes.includes('over_request_rate_limit') || codes.includes('over_email_send_rate_limit'))
    return 'Too many signup attempts were made. Wait a few minutes and try again.';
  if (codes.includes('email_address_invalid') || (normalized.includes('email') && normalized.includes('valid')))
    return 'Enter a valid email address.';
  if (status === 0 || name.includes('authretryablefetcherror') || /failed to fetch|networkerror|network request failed|load failed/.test(normalized))
    return 'Could not reach the account service. Check your connection and try again.';
  if (context === 'signup' && (status === 500 || codes.includes('unexpected_failure') || normalized.includes('database error saving new user'))) {
    return 'The account service could not save this signup. Ask an administrator to check Supabase Auth logs and confirm the latest database migration is applied.';
  }
  if (codes.includes('request_timeout') || status === 408 || status === 504)
    return 'The account service took too long to respond. Please try again.';
  if (context === 'signup' && status === 404)
    return 'The signup endpoint was not found. Ask an administrator to check the Supabase project URL.';
  if (context === 'signup' && status === 400)
    return 'The signup request was rejected. Check that the email and password meet the requirements.';
  if (normalized.includes('database error saving new user'))
    return 'The account service could not save the request. Please try again later.';
  if (normalized.includes('invalid login credentials')) return 'Email or password is incorrect.';
  if (context === 'signup')
    return 'Could not complete signup. Check your connection and try again; if it continues, ask an administrator to check Supabase Auth logs.';
  return 'Something went wrong. Please try again.';
}
