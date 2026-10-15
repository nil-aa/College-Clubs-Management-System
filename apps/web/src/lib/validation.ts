import { z } from 'zod';

export const passwordRequirements =
  'At least 8 characters with an uppercase letter, a lowercase letter, and a number.';

export const emailSchema = z.string().trim().email('Enter a valid email address.');

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

export function authErrorMessage(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes('invalid login credentials')) return 'Email or password is incorrect.';
  if (normalized.includes('already registered') || normalized.includes('already been registered')) {
    return 'An account with this email already exists.';
  }
  if (normalized.includes('password'))
    return 'That password was not accepted. Check the password rules.';
  return message || 'Something went wrong. Please try again.';
}
