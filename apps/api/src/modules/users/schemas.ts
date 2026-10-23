import { z } from 'zod';

export const profileUpdateSchema = z
  .object({
    full_name: z.string().trim().min(2).max(200).optional(),
    department: z.string().trim().max(120).nullable().optional(),
    year_of_study: z.number().int().min(1).max(5).nullable().optional(),
    phone: z
      .string()
      .trim()
      .max(32)
      .regex(/^[+()\-\s\d]*$/)
      .nullable()
      .optional(),
    roll_number: z
      .string()
      .trim()
      .regex(/^(?:[0-9]{10})?$/)
      .nullable()
      .optional(),
  })
  .strict();

export const userSearchSchema = z.object({ query: z.string().trim().max(120).default('') });
