export type TrackingType = 'boolean' | 'count' | 'duration'
export type HabitFrequency = 'daily' | 'weekdays' | 'weekends' | 'custom'
export type HabitDifficulty = 'easy' | 'medium' | 'hard'
export type StreakRisk = 'low' | 'medium' | 'high'
export type InsightType = 'positive' | 'warning' | 'neutral'
export type XPSource = 'habit' | 'finance' | 'badge' | 'streak'
export type BadgeType =
  | 'FIRST_HABIT' | 'FIRST_LOG' | 'STREAK_7' | 'STREAK_30' | 'STREAK_100'
  | 'PERFECT_WEEK' | 'PERFECT_MONTH' | 'EARLY_BIRD' | 'NIGHT_OWL'
  | 'CATEGORY_MASTER' | 'COMEBACK_KID' | 'MULTITASKER' | 'CONSISTENCY_KING'
  | 'BUDGET_DISCIPLINE' | 'SAVINGS_HERO' | 'NO_SPEND_WARRIOR' | 'MIND_AND_MONEY'

export interface User {
  _id: string
  email: string
  name: string
}

export interface HabitCategory {
  _id: string
  name: string
  icon: string
  color: string
  order: number
  isDefault: boolean
}

export interface Habit {
  _id: string
  categoryId: string
  category?: HabitCategory
  name: string
  description?: string
  icon: string
  color: string
  trackingType: TrackingType
  targetValue: number
  targetUnit?: string
  frequency: HabitFrequency
  customDays: number[]
  difficulty: HabitDifficulty
  isArchived: boolean
  order: number
  currentStreak: number
  longestStreak: number
  totalCompletions: number
  totalAttempts: number
  todayLog?: HabitLog | null
  consistencyScore?: number
  streakRisk?: StreakPrediction
  createdAt: string
  updatedAt: string
}

export interface HabitInput {
  name: string
  categoryId: string
  trackingType: TrackingType
  targetValue?: number
  targetUnit?: string
  frequency: HabitFrequency
  customDays?: number[]
  difficulty?: HabitDifficulty
  icon?: string
  description?: string
}

export interface HabitLog {
  _id: string
  habitId: string
  date: string
  completed: boolean
  value: number
  note?: string
  loggedAt: string
}

export interface HabitLogInput {
  date: string
  completed: boolean
  value?: number
  note?: string
}

export interface HabitLogResponse {
  log: HabitLog
  habit: Habit
  xpAwarded: number
  newBadges: Badge[]
  leveledUp: boolean
  newLevel?: number
  newLevelTitle?: string
}

export interface HeatmapDay {
  date: string
  value: number
  completed: number
  total: number
}

export interface StreakPrediction {
  riskLevel: StreakRisk
  reason: string
  historicalBreakPoint: number | null
}

export interface FailureAnalysis {
  worstDayOfWeek: number
  worstDayName: string
  failuresByDayOfWeek: {
    day: number
    dayName: string
    totalMissed: number
    totalExpected: number
    failureRate: number
  }[]
  hardestHabit: {
    habitId: string
    name: string
    icon: string
    difficultyScore: number
  } | null
}

export interface HabitStats {
  totalHabits: number
  activeHabits: number
  totalCompletionsToday: number
  totalHabitsToday: number
  overallConsistencyScore: number
  byCategory: {
    categoryId: string
    categoryName: string
    color: string
    icon: string
    habitCount: number
    avgConsistency: number
  }[]
  streakLeaders: { habitId: string; name: string; icon: string; currentStreak: number }[]
  weeklyCompletion: { date: string; dayName: string; completed: number; total: number; percentage: number }[]
  heatmapData: HeatmapDay[]
  failureAnalysis: FailureAnalysis
  radarData: { category: string; icon: string; color: string; score: number }[]
  movingAverage: { date: string; value: number }[]
}

export interface Insight {
  type: InsightType
  title: string
  description: string
  metric?: string
  actionable?: string
}

export interface Badge {
  _id: string
  badgeType: BadgeType
  habitId?: string
  earnedAt: string
  metadata?: Record<string, unknown>
}

export interface UserXP {
  totalXP: number
  level: number
  levelTitle: string
  currentLevelXP: number
  nextLevelXP: number
  progressPercent: number
  xpHistory: { date: string; amount: number; reason: string; source: XPSource }[]
}

export interface AchievementsData {
  xp: UserXP
  level: number
  levelTitle: string
  badges: Badge[]
  unlockedBadgeTypes: BadgeType[]
  recentBadges: Badge[]
  xpHistory: UserXP['xpHistory']
}

export interface LifeScore {
  lifeScore: number
  financeScore: number
  habitScore: number
  breakdown: {
    budgetDiscipline: number
    savingsProgress: number
    habitConsistency: number
    streakHealth: number
  }
  weeklyTrend: { week: string; financeScore: number; habitScore: number; lifeScore: number }[]
  topWins: string[]
  topRisks: string[]
}

export interface ApiResponse<T> {
  data: T | null
  error: string | null
  message?: string
}
