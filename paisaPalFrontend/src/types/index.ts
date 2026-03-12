export const CATEGORIES = [
  'Rapido', 'Bus/GSRTC', 'Food & Drinks', 'Shopping',
  'Social', 'Recharge/Bills', 'Self Care', 'Transfer/Sent', 'Other'
] as const

export type Category = typeof CATEGORIES[number]
export type PaymentMode = 'Online' | 'Cash'

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

export type TabId = 'dashboard' | 'transactions' | 'insights' | 'settings'

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
