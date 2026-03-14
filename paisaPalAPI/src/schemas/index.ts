import { z } from 'zod';

// Custom date parser for DD-MM-YYYY format
const parseDDMMYYYY = (val: string | Date): Date => {
  if (val instanceof Date) return val;
  
  // Try DD-MM-YYYY format first
  const ddmmyyyy = val.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (ddmmyyyy) {
    const [, day, month, year] = ddmmyyyy;
    const date = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00`);
    if (!isNaN(date.getTime())) return date;
  }
  
  // Fallback to ISO format YYYY-MM-DD
  const isoMatch = val.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    const date = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00`);
    if (!isNaN(date.getTime())) return date;
  }
  
  // Final fallback - let Date parse
  const parsed = new Date(val);
  if (isNaN(parsed.getTime())) {
    throw new Error('Invalid date format. Use DD-MM-YYYY or YYYY-MM-DD');
  }
  return parsed;
};

const DDMMYYYYDateSchema = z.string().or(z.date()).transform((val) => parseDDMMYYYY(val));

export const CategorySchema = z.string().min(1).max(50);

export type Category = z.infer<typeof CategorySchema>;

export const ModeSchema = z.enum(['Online', 'Cash']);

export const FrequencySchema = z.enum(['daily', 'weekly', 'monthly', 'yearly']);

export const TransactionSchema = z.object({
  date: DDMMYYYYDateSchema,
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

export const BulkDeleteTransactionsSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(500),
});

export type BulkDeleteTransactionsInput = z.infer<
  typeof BulkDeleteTransactionsSchema
>;

export type TransactionUpdateInput = z.infer<typeof TransactionUpdateSchema>;

export const RemapCategorySchema = z.object({
  fromCategory: CategorySchema,
  toCategory: CategorySchema,
}).superRefine((value, ctx) => {
  if (value.fromCategory === value.toCategory) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'fromCategory and toCategory must be different',
      path: ['toCategory'],
    });
  }
});

export type RemapCategoryInput = z.infer<typeof RemapCategorySchema>;

export const SettingsSchema = z.object({
  stipend: z.number().min(0).optional(),
  extra: z.number().min(0).optional(),
  categoryConfig: z
    .array(
      z.object({
        name: z.string().min(1).max(50),
        color: z
          .string()
          .regex(/^#([0-9a-fA-F]{6})$/, 'Color must be a hex like #ff00aa'),
      }),
    )
    .optional(),
});

export type SettingsInput = z.infer<typeof SettingsSchema>;

export const QueryParamsSchema = z.object({
  search: z.string().optional().default(''),
  category: CategorySchema.optional(),
  mode: ModeSchema.optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  minAmount: z.coerce.number().min(0).optional(),
  maxAmount: z.coerce.number().min(0).optional(),
  hasNotes: z.coerce.boolean().optional(),
  sort: z.enum(['date', 'amount', 'category', 'createdAt', 'updatedAt']).default('date'),
  order: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type QueryParams = z.infer<typeof QueryParamsSchema>;

export const RecurringRuleSchema = z.object({
  name: z.string().min(1).max(100),
  particulars: z.string().min(1).max(200),
  amount: z.number().min(0),
  category: CategorySchema,
  mode: ModeSchema.default('Online'),
  notes: z.string().max(500).default(''),
  frequency: FrequencySchema,
  dayOfMonth: z.number().int().min(1).max(31).optional(),
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  startDate: DDMMYYYYDateSchema,
  endDate: DDMMYYYYDateSchema.optional(),
  isActive: z.boolean().default(true),
});

export type RecurringRuleInput = z.infer<typeof RecurringRuleSchema>;

export const RecurringRuleUpdateSchema = RecurringRuleSchema.partial().superRefine(
  (value: Partial<RecurringRuleInput>, ctx: z.RefinementCtx) => {
    const hasAtLeastOne = Object.keys(value).length > 0;
    if (!hasAtLeastOne) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one field must be provided',
      });
    }
  },
);

export type RecurringRuleUpdateInput = z.infer<typeof RecurringRuleUpdateSchema>;

export const BudgetSchema = z.object({
  category: CategorySchema,
  monthlyLimit: z.number().min(0),
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Month must be in YYYY-MM format'),
});

export type BudgetInput = z.infer<typeof BudgetSchema>;

export const BudgetUpdateSchema = z.object({
  monthlyLimit: z.number().min(0).optional(),
});

export type BudgetUpdateInput = z.infer<typeof BudgetUpdateSchema>;
