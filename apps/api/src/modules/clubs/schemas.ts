import { z } from 'zod';

export const clubIdSchema = z.object({ id: z.string().uuid() });
export const clubQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  category: z.string().trim().max(80).optional(),
});
export const clubWriteSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(2000).nullable().optional(),
    category: z.string().trim().max(80).nullable().optional(),
    contact_email: z
      .union([z.literal(''), z.string().email()])
      .nullable()
      .optional(),
  })
  .strict();
export const headSchema = z.object({ userId: z.string().uuid() }).strict();
