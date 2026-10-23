import { z } from 'zod';

export const auditQuerySchema = z.object({
  action: z.string().trim().max(120).optional(),
  entity_type: z.string().trim().max(120).optional(),
  actor: z.string().uuid().optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
