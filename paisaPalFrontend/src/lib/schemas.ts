import { z } from 'zod'

export const TransactionSchema = z.object({
  date: z.string().min(1, 'Date is required'),
  particulars: z.string().min(1, 'Description is required').max(200),
  amount: z.number({ invalid_type_error: 'Enter a valid amount' }).min(0, 'Amount must be positive'),
  category: z.enum(['Rapido', 'Bus/GSRTC', 'Food & Drinks', 'Shopping', 'Social', 'Recharge/Bills', 'Self Care', 'Transfer/Sent', 'Other']),
  mode: z.enum(['Online', 'Cash']),
  notes: z.string().max(500).optional().default(''),
})

export const SettingsSchema = z.object({
  stipend: z.number().min(0),
  extra: z.number().min(0),
})

export type TransactionInput = z.infer<typeof TransactionSchema>
export type SettingsInput = z.infer<typeof SettingsSchema>
