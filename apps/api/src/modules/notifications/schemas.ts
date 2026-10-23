import { z } from 'zod';

export const notificationIdSchema = z.object({ id: z.string().uuid() });
export const notificationQuerySchema = z.object({
  unread: z.enum(['true', 'false']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
