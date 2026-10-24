import { z } from 'zod';

export const roleChangeSchema = z
  .object({
    role: z.enum(['student', 'club_head', 'admin']),
  })
  .strict();

export const facultyAssignmentSchema = z.object({ club_id: z.string().uuid() }).strict();

export const facultyAssignmentParamsSchema = z.object({ userId: z.string().uuid() });
export const facultyRevokeParamsSchema = z.object({
  userId: z.string().uuid(),
  clubId: z.string().uuid(),
});
