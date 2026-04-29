import { z } from 'zod'

export const HabitCreateSchema = z.object({
  name: z.string().min(1).max(100),
  categoryId: z.string().min(1),
  trackingType: z.enum(['boolean', 'count', 'duration']).default('boolean'),
  targetValue: z.number().min(1).optional().default(1),
  targetUnit: z.string().max(20).optional(),
  frequency: z.enum(['daily', 'weekdays', 'weekends', 'custom']).default('daily'),
  customDays: z.array(z.number().int().min(0).max(6)).optional().default([]),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional().default('medium'),
  icon: z.string().optional().default('✅'),
  description: z.string().max(300).optional(),
  reminderTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
})

export type HabitCreateInput = z.infer<typeof HabitCreateSchema>

export const HabitUpdateSchema = HabitCreateSchema.partial().superRefine((val, ctx) => {
  if (Object.keys(val).length === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'At least one field required' })
  }
})

export type HabitUpdateInput = z.infer<typeof HabitUpdateSchema>

export const HabitLogSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  completed: z.boolean(),
  value: z.number().min(0).optional().default(0),
  note: z.string().max(200).optional(),
})

export type HabitLogInput = z.infer<typeof HabitLogSchema>

export const CategoryCreateSchema = z.object({
  name: z.string().min(1).max(50),
  icon: z.string().default('🎯'),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#7c6aff'),
})

export type CategoryCreateInput = z.infer<typeof CategoryCreateSchema>

export const LogsQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

export type LogsQuery = z.infer<typeof LogsQuerySchema>

export const HabitsQuerySchema = z.object({
  categoryId: z.string().optional(),
  isArchived: z.coerce.boolean().optional().default(false),
  includeToday: z.coerce.boolean().optional().default(false),
})

export type HabitsQuery = z.infer<typeof HabitsQuerySchema>

export const HabitOrderSchema = z.array(
  z.object({
    id: z.string().min(1),
    order: z.number().int().min(0),
  }),
)
