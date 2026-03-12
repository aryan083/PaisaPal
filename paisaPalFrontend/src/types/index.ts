export const CATEGORIES = [
  'Rapido', 'Bus/GSRTC', 'Food & Drinks', 'Shopping',
  'Social', 'Recharge/Bills', 'Self Care', 'Transfer/Sent', 'Other'
] as const

export type Category = typeof CATEGORIES[number]
export type PaymentMode = 'Online' | 'Cash'
export type Frequency = 'daily' | 'weekly' | 'monthly' | 'yearly'

export interface Transaction {
  id: string
  date: string
  particulars: string
  amount: number
  category: Category
  mode: PaymentMode
  notes: string
  createdAt: string
  updatedAt: string
}

export interface Settings {
  stipend: number
  extra: number
}

export interface Stats {
  totalSpent: number
  byCategory: { category: Category; total: number; count: number }[]
  byDate: { date: string; total: number }[]
  byMode: { Online: number; Cash: number }
  transactionCount: number
  activeDays: number
  dailyAverage: number
  biggestDay: { date: string; total: number }
  biggestTransaction: Transaction | null
  rapidoStats: { total: number; count: number; avgPerRide: number }
}

export interface RecurringRule {
  id: string
  name: string
  particulars: string
  amount: number
  category: Category
  mode: PaymentMode
  notes: string
  frequency: Frequency
  dayOfMonth?: number
  dayOfWeek?: number
  startDate: string
  endDate?: string
  lastGenerated?: string
  nextDue: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface Budget {
  id: string
  category: Category
  monthlyLimit: number
  month: string
  createdAt: string
  updatedAt: string
}

export interface BudgetStat {
  category: Category
  monthlyLimit: number
  spent: number
  remaining: number
  percentage: number
  isOverBudget: boolean
}

export interface BudgetStats {
  month: string
  budgets: BudgetStat[]
  totalBudgeted: number
  totalSpent: number
}

export interface TransactionFilters {
  search?: string
  category?: Category
  mode?: PaymentMode
  startDate?: string
  endDate?: string
  minAmount?: number
  maxAmount?: number
  hasNotes?: boolean
  sort?: 'date' | 'amount' | 'category' | 'createdAt' | 'updatedAt'
  order?: 'asc' | 'desc'
  page?: number
  limit?: number
}

export interface ImportPreview {
  row: number
  data: {
    date: string
    particulars: string
    amount: number
    category: string
    mode: string
    notes: string
  }
  isDuplicate: boolean
}

export interface ImportResult {
  inserted: number
  failed: number
  duplicates: number
  errors: Array<{ row: number; error: string }>
  duplicateDetails?: Array<{
    row: number
    particulars: string
    amount: number
    date: string
    reason: string
  }>
  preview?: ImportPreview[]
}

export type TabId = 'dashboard' | 'transactions' | 'recurring' | 'budgets' | 'insights' | 'settings'

export const CATEGORY_KEY_MAP: Record<Category, string> = {
  'Rapido': 'rapido',
  'Bus/GSRTC': 'bus',
  'Food & Drinks': 'food',
  'Shopping': 'shopping',
  'Social': 'social',
  'Recharge/Bills': 'recharge',
  'Self Care': 'selfcare',
  'Transfer/Sent': 'transfer',
  'Other': 'other',
}

export function getCategoryColorClass(category: Category, type: 'text' | 'bg' | 'bg-soft' = 'text'): string {
  const key = CATEGORY_KEY_MAP[category]
  if (type === 'text') return `category-${key}`
  if (type === 'bg') return `bg-category-${key}`
  return `bg-category-${key}-soft`
}

export const CATEGORY_HEX: Record<Category, string> = {
  'Rapido': '#ff6b35',
  'Bus/GSRTC': '#00d4a4',
  'Food & Drinks': '#ff4f6a',
  'Shopping': '#b06aff',
  'Social': '#ffaa2b',
  'Recharge/Bills': '#4da6ff',
  'Self Care': '#ff80c8',
  'Transfer/Sent': '#ff6080',
  'Other': '#6080a0',
}
