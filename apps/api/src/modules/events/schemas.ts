import { z } from 'zod';

const uuid = z.string().uuid();
export const eventIdSchema = z.object({ eventId: uuid });
export const sheetIdSchema = z.object({ sheetId: uuid });
export const eventQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  club_id: uuid.optional(),
  category: z.string().trim().max(120).optional(),
  start_from: z.string().datetime({ offset: true }).optional(),
  start_to: z.string().datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
export const managedEventQuerySchema = z.object({
  club_id: uuid.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
export const eventWriteSchema = z
  .object({
    club_id: uuid,
    title: z.string().trim().min(1).max(200),
    description: z.string().nullable().optional(),
    venue: z.string().trim().min(1).max(300),
    category: z.string().nullable().optional(),
    start_time: z.string().datetime({ offset: true }),
    end_time: z.string().datetime({ offset: true }),
    registration_deadline: z.string().datetime({ offset: true }),
    capacity: z.number().int().positive(),
  })
  .strict();
export const eventUpdateSchema = eventWriteSchema.omit({ club_id: true }).extend({
  confirm_registered_schedule_change: z.boolean().optional(),
});
export const postponeSchema = z
  .object({
    start_time: z.string().datetime({ offset: true }),
    end_time: z.string().datetime({ offset: true }),
    registration_deadline: z.string().datetime({ offset: true }),
    confirm_registered_schedule_change: z.boolean().optional(),
  })
  .strict()
  .optional();
export const registrationQuerySchema = z.object({
  upcoming: z.enum(['true', 'false']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
export const attendanceSchema = z
  .object({
    student_id: uuid,
    status: z.enum(['PRESENT', 'ABSENT', 'EXCUSED']),
    notes: z.string().max(1000).nullable().optional(),
  })
  .strict();
export const odSheetSchema = z
  .object({
    title: z.string().trim().min(2).max(200),
    student_fields: z
      .array(z.enum(['full_name', 'roll_number', 'department', 'year_of_study', 'email', 'phone']))
      .min(1),
    event_fields: z
      .array(
        z.enum([
          'title',
          'club_name',
          'venue',
          'category',
          'start_time',
          'end_time',
          'registration_deadline',
          'description',
        ]),
      )
      .default([]),
  })
  .strict();
