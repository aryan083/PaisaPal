import { z } from 'zod';

export const CategorySchema = z.enum([
  'Rapido',
  'Bus/GSRTC',
  'Food & Drinks',
  'Shopping',
  'Social',
  'Recharge/Bills',
  'Self Care',
  'Transfer/Sent',
  'Other',
]);

export const ModeSchema = z.enum(['Online', 'Cash']);

export const TransactionSchema = z.object({
  date: z.coerce.date(),
  particulars: z.string().min(1).max(200),
  amount: z.number().min(0),
  category: CategorySchema,
  mode: ModeSchema.default('Online'),
  notes: z.string().max(500).default(''),
});

export type TransactionInput = z.infer<typeof TransactionSchema>;

export const TransactionUpdateSchema = TransactionSchema.partial().superRefine(
  (value: Partial<TransactionInput>, ctx: z.RefinementCtx) => {
    const hasAtLeastOne = Object.keys(value).length > 0;
    if (!hasAtLeastOne) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one field must be provided',
      });
    }
  },
);

export type TransactionUpdateInput = z.infer<typeof TransactionUpdateSchema>;

export const SettingsSchema = z.object({
  stipend: z.number().min(0).optional(),
  extra: z.number().min(0).optional(),
});

export type SettingsInput = z.infer<typeof SettingsSchema>;

export const QueryParamsSchema = z.object({
  search: z.string().optional().default(''),
  category: CategorySchema.optional(),
  sort: z.enum(['date', 'amount', 'category', 'createdAt', 'updatedAt']).default('date'),
  order: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type QueryParams = z.infer<typeof QueryParamsSchema>;
