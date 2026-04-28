export const DEFAULT_CATEGORIES = [
  'Rapido',
  'Bus/GSRTC',
  'Food & Drinks',
  'Shopping',
  'Social',
  'Recharge/Bills',
  'Self Care',
  'Transfer/Sent',
  'Other',
] as const

export const CATEGORIES = DEFAULT_CATEGORIES

export type Category = string
export type PaymentMode = 'Online' | 'Cash' | 'Card'
export type RuleFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly'
export type Frequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly'

export type GoalStatus = 'active' | 'completed' | 'paused' | 'ended'
export type RecurringStatus = 'active' | 'paused' | 'ended'
export type EnvelopeStatus = 'under' | 'warning' | 'over'
export type SurplusAction = 'save' | 'split' | 'carry' | 'pending'
export type ContributionType = 'manual' | 'surplus' | 'rapido_tax' | 'auto'

export interface CategoryConfigEntry {
  name: string
  color: string
}

export interface Transaction {
  id: string
  date: string
  dateKey: string
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
  categoryConfig?: CategoryConfigEntry[]
  rapidoTaxEnabled?: boolean
  rapidoTaxPercent?: number
  primarySavingsGoalId?: string
  monthEndReminderEnabled?: boolean
  envelopeWarningThreshold?: number
}

export interface Stats {
  totalSpent: number
  byCategory: { category: Category; total: number; count: number }[]
  byDate: { date: string; total: number }[]
  byMode: { Online: number; Cash: number; Card: number }
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
  frequency: RuleFrequency
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

export interface SavingsGoal {
  _id: string
  name: string
  emoji: string
  targetAmount: number
  savedAmount: number
  monthlyTarget: number
  deadline?: string
  status: GoalStatus
  color: string
  progressPercent: number
  monthsLeft?: number
  monthlyNeeded?: number
  eta?: string
  createdAt: string
  updatedAt: string
}

export interface SavingsContribution {
  _id: string
  goalId: string
  amount: number
  type: ContributionType
  note?: string
  transactionId?: string
  createdAt: string
  updatedAt?: string
}

export interface RecurringTransaction {
  _id: string
  name: string
  amount: number
  category: Category
  mode: 'Online' | 'Cash'
  notes?: string
  frequency: Frequency
  startDate: string
  endDate?: string
  lastPaidDate?: string
  nextDueDate: string
  status: RecurringStatus
  autoDetected: boolean
  occurrences: number
  totalPaid: number
  daysUntilDue: number
  projectedMonthly: number
  projectedYearly: number
  createdAt: string
  updatedAt: string
}

export interface EnvelopeItem {
  category: Category
  limit: number
  spent: number
  status: EnvelopeStatus
  percentUsed?: number
  remaining?: number
}

export interface Envelope {
  _id: string
  month: string
  envelopes: EnvelopeItem[]
  surplusAmount: number
  surplusAction: SurplusAction
  savingsGoalId?: string
  createdAt: string
  updatedAt: string
}

export interface DetectedRecurring {
  name: string
  amount: number
  category: Category
  frequency: Frequency
  confidence: number
  occurrences: number
  avgGapDays?: number
  lastSeen: string
  suggestedNextDate: string
  matchingTransactionIds: string[]
}

export interface SavingsStats {
  totalSaved: number
  activeGoals: number
  completedGoals: number
  savingsRate: number
  monthlyRecurringCost: number
  upcomingDue: RecurringTransaction[]
  noSpendDays: number
  noSpendStreak: number
  bestStreak: number
  rapidoTaxSaved: number
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

export type TabId =
  | 'dashboard'
  | 'transactions'
  | 'recurring'
  | 'budgets'
  | 'insights'
  | 'settings'
  | 'savings'
  | 'recurring_tx'
  | 'envelopes'

export const DEFAULT_CATEGORY_HEX: Record<(typeof DEFAULT_CATEGORIES)[number], string> = {
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

export const CATEGORY_HEX: Record<string, string> = { ...DEFAULT_CATEGORY_HEX }

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n))
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = hex.trim().match(/^#([0-9a-fA-F]{6})$/)
  if (!m) return null
  const intVal = parseInt(m[1], 16)
  return {
    r: (intVal >> 16) & 255,
    g: (intVal >> 8) & 255,
    b: intVal & 255,
  }
}

function rgbToHsl(
  r: number,
  g: number,
  b: number,
): { h: number; s: number; l: number } {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255

  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const d = max - min
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1))
    switch (max) {
      case rn:
        h = ((gn - bn) / d) % 6
        break
      case gn:
        h = (bn - rn) / d + 2
        break
      default:
        h = (rn - gn) / d + 4
        break
    }
    h *= 60
    if (h < 0) h += 360
  }

  return { h, s, l }
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2

  let rp = 0
  let gp = 0
  let bp = 0

  if (h >= 0 && h < 60) {
    rp = c
    gp = x
  } else if (h < 120) {
    rp = x
    gp = c
  } else if (h < 180) {
    gp = c
    bp = x
  } else if (h < 240) {
    gp = x
    bp = c
  } else if (h < 300) {
    rp = x
    bp = c
  } else {
    rp = c
    bp = x
  }

  return {
    r: Math.round((rp + m) * 255),
    g: Math.round((gp + m) * 255),
    b: Math.round((bp + m) * 255),
  }
}

function rgbToHex(r: number, g: number, b: number): string {
  const to = (n: number) => n.toString(16).padStart(2, '0')
  return `#${to(r)}${to(g)}${to(b)}`
}

function adjustCategoryHexForTheme(
  hex: string,
  theme: 'light' | 'dark',
): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex

  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b)
  const baseS = Math.max(0.55, Math.min(hsl.s, 0.9))
  const targetL = theme === 'dark'
    ? Math.max(0.58, Math.min(hsl.l + 0.12, 0.72))
    : Math.max(0.32, Math.min(hsl.l - 0.1, 0.48))

  const next = hslToRgb(hsl.h, clamp01(baseS), clamp01(targetL))
  return rgbToHex(next.r, next.g, next.b)
}

export function getAvailableCategories(settings?: Settings): string[] {
  const custom = (settings?.categoryConfig ?? []).map(c => c.name)
  const merged = [...DEFAULT_CATEGORIES, ...custom]
  return Array.from(new Set(merged)).sort((a, b) => a.localeCompare(b))
}

export function getCategoryHex(
  category: string,
  settings?: Settings,
): string {
  const custom = settings?.categoryConfig?.find(c => c.name === category)
  const base = custom?.color || CATEGORY_HEX[category] || '#6080a0'

  const isDark =
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  return adjustCategoryHexForTheme(base, isDark ? 'dark' : 'light')
}
