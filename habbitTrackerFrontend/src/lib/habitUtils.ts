import { format, getDay, parseISO } from 'date-fns'
import type { Habit, HabitDifficulty, StreakRisk, BadgeType } from '@/types'

export function isHabitScheduledForDate(habit: Habit, dateStr: string): boolean {
  const dow = getDay(parseISO(dateStr))
  if (habit.frequency === 'daily') return true
  if (habit.frequency === 'weekdays') return dow >= 1 && dow <= 5
  if (habit.frequency === 'weekends') return dow === 0 || dow === 6
  if (habit.frequency === 'custom') return (habit.customDays ?? []).includes(dow)
  return false
}

export function getTodayString(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

export function getDifficultyColor(d: HabitDifficulty): string {
  if (d === 'easy') return 'var(--color-success)'
  if (d === 'hard') return 'var(--color-danger)'
  return 'var(--color-warning)'
}

export function getDifficultyLabel(d: HabitDifficulty): string {
  if (d === 'easy') return 'Easy'
  if (d === 'hard') return 'Hard'
  return 'Medium'
}

export function getConsistencyColor(score: number): string {
  if (score >= 80) return 'var(--color-success)'
  if (score >= 50) return 'var(--color-warning)'
  return 'var(--color-danger)'
}

export function getHeatmapColor(value: number): string {
  if (value === 0) return 'var(--color-border)'
  if (value <= 0.25) return 'rgba(34,212,122,0.2)'
  if (value <= 0.5) return 'rgba(34,212,122,0.4)'
  if (value <= 0.75) return 'rgba(34,212,122,0.7)'
  return 'var(--color-success)'
}

export function formatStreak(days: number): string {
  if (days === 0) return 'No streak'
  if (days === 1) return '1 day'
  if (days < 7) return `${days} days`
  if (days < 14) return '1 week'
  if (days < 30) return `${Math.floor(days / 7)} weeks`
  if (days < 60) return '1 month'
  if (days < 365) return `${Math.floor(days / 30)} months`
  if (days < 730) return '1 year'
  return `${Math.floor(days / 365)} years`
}

export function getLevelTitle(level: number): string {
  if (level >= 20) return 'Legendary'
  if (level >= 15) return 'Discipline Guru'
  if (level >= 10) return 'Life Optimizer'
  if (level >= 7) return 'Streak Master'
  if (level >= 5) return 'Consistency Pro'
  if (level >= 4) return 'Habit Builder'
  if (level >= 3) return 'Practitioner'
  if (level >= 2) return 'Learner'
  return 'Beginner'
}

export function getStreakRiskColor(risk: StreakRisk): string {
  if (risk === 'low') return 'var(--color-success)'
  if (risk === 'high') return 'var(--color-danger)'
  return 'var(--color-warning)'
}

export const BADGE_META: Record<BadgeType, { emoji: string; name: string; description: string; hint: string }> = {
  FIRST_HABIT:      { emoji: '🌱', name: 'First Habit',        description: 'Created your first habit',           hint: 'Create your first habit' },
  FIRST_LOG:        { emoji: '✅', name: 'First Log',          description: 'Logged your first completion',       hint: 'Complete any habit once' },
  STREAK_7:         { emoji: '🔥', name: 'Week Warrior',       description: '7-day streak on any habit',          hint: 'Maintain a 7-day streak' },
  STREAK_30:        { emoji: '💥', name: 'Month Master',       description: '30-day streak on any habit',         hint: 'Maintain a 30-day streak' },
  STREAK_100:       { emoji: '🏆', name: 'Century Club',       description: '100-day streak on any habit',        hint: 'Maintain a 100-day streak' },
  PERFECT_WEEK:     { emoji: '⭐', name: 'Perfect Week',       description: 'All habits done for 7 days straight', hint: 'Complete all habits every day for a week' },
  PERFECT_MONTH:    { emoji: '🌟', name: 'Perfect Month',      description: 'All habits done for 30 days',        hint: 'Complete all habits every day for a month' },
  EARLY_BIRD:       { emoji: '🌅', name: 'Early Bird',         description: 'Logged before 8am on 7 days',        hint: 'Log habits before 8am, 7 times' },
  NIGHT_OWL:        { emoji: '🦉', name: 'Night Owl',          description: 'Logged after 10pm on 7 days',        hint: 'Log habits after 10pm, 7 times' },
  CATEGORY_MASTER:  { emoji: '🎯', name: 'Category Master',   description: '100% in one category for 30 days',   hint: 'Perfect score in any category for 30 days' },
  COMEBACK_KID:     { emoji: '💪', name: 'Comeback Kid',       description: 'Resumed a habit after 7+ day break', hint: 'Resume a habit after a long break' },
  MULTITASKER:      { emoji: '🤹', name: 'Multitasker',        description: '5+ active habits simultaneously',    hint: 'Track 5 or more habits at once' },
  CONSISTENCY_KING: { emoji: '👑', name: 'Consistency King',   description: '80%+ consistency for 60 days',       hint: 'Maintain 80%+ consistency for 2 months' },
  BUDGET_DISCIPLINE:{ emoji: '💰', name: 'Budget Discipline',  description: 'Under budget for 30 days',            hint: 'Stay under budget for 30 consecutive days' },
  SAVINGS_HERO:     { emoji: '🦸', name: 'Savings Hero',       description: 'Completed a savings goal',            hint: 'Reach 100% on any savings goal' },
  NO_SPEND_WARRIOR: { emoji: '🛡️', name: 'No-Spend Warrior',   description: '7 consecutive no-spend days',        hint: 'Go 7 days without spending' },
  MIND_AND_MONEY:   { emoji: '🧠', name: 'Mind & Money',       description: 'All habits + under budget 7 days',   hint: 'Combine habit success with financial discipline' },
}

export const HABIT_EMOJIS = [
  '✅', '💪', '📚', '🧘', '💧', '🏃', '🎯', '⚡', '🌅', '🍎',
  '🎵', '✍️', '🧠', '💊', '🛏️', '🌿', '🏋️', '🚴', '🍳', '📝',
  '🎨', '🧹', '💻', '📖', '🧃', '🏊', '🎤', '🌙', '☕', '🦷',
]

export const DEFAULT_CATEGORY_COLORS = [
  '#ff4f6a', '#ff6b35', '#4da6ff', '#ffaa2b', '#b06aff', '#00d4a4', '#ff80c8', '#6080a0',
]
