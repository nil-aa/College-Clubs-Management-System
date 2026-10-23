import { z } from 'zod';

export const roleChangeSchema = z
  .object({
    role: z.enum(['student', 'club_head', 'admin']),
  })
  .strict();
