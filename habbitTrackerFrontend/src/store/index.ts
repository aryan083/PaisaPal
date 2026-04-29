import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  User, Habit, HabitStats, Insight, HabitCategory,
  AchievementsData, Badge, LifeScore, HabitLog,
} from '@/types'

interface AppStore {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  setAuth: (user: User, token: string) => void
  clearAuth: () => void

  habits: Habit[]
  habitStats: HabitStats | null
  habitInsights: Insight[]
  categories: HabitCategory[]
  achievements: AchievementsData | null
  recentBadges: Badge[]
  lifeScore: LifeScore | null
  isLoading: boolean
  theme: 'dark' | 'light'

  setHabits: (habits: Habit[]) => void
  addHabit: (habit: Habit) => void
  updateHabit: (id: string, habit: Habit) => void
  removeHabit: (id: string) => void
  updateHabitTodayLog: (habitId: string, log: HabitLog, updatedHabit: Habit) => void

  setHabitStats: (stats: HabitStats) => void
  setHabitInsights: (insights: Insight[]) => void
  setCategories: (cats: HabitCategory[]) => void
  setAchievements: (data: AchievementsData) => void
  addRecentBadges: (badges: Badge[]) => void
  clearRecentBadges: () => void
  setLifeScore: (score: LifeScore) => void
  setIsLoading: (v: boolean) => void
  setTheme: (t: 'dark' | 'light') => void
}

export const useStore = create<AppStore>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      setAuth: (user, token) => {
        localStorage.setItem('habit_token', token)
        set({ user, token, isAuthenticated: true })
      },
      clearAuth: () => {
        localStorage.removeItem('habit_token')
        set({ user: null, token: null, isAuthenticated: false })
      },

      habits: [],
      habitStats: null,
      habitInsights: [],
      categories: [],
      achievements: null,
      recentBadges: [],
      lifeScore: null,
      isLoading: false,
      theme: 'dark',

      setHabits: (habits) => set({ habits }),
      addHabit: (habit) => set((s) => ({ habits: [...s.habits, habit] })),
      updateHabit: (id, habit) => set((s) => ({
        habits: s.habits.map((h) => (h._id === id ? habit : h)),
      })),
      removeHabit: (id) => set((s) => ({
        habits: s.habits.filter((h) => h._id !== id),
      })),
      updateHabitTodayLog: (habitId, log, updatedHabit) => set((s) => ({
        habits: s.habits.map((h) =>
          h._id === habitId ? { ...updatedHabit, todayLog: log } : h,
        ),
      })),
      setHabitStats: (habitStats) => set({ habitStats }),
      setHabitInsights: (habitInsights) => set({ habitInsights }),
      setCategories: (categories) => set({ categories }),
      setAchievements: (achievements) => set({ achievements }),
      addRecentBadges: (badges) => set((s) => ({ recentBadges: [...s.recentBadges, ...badges] })),
      clearRecentBadges: () => set({ recentBadges: [] }),
      setLifeScore: (lifeScore) => set({ lifeScore }),
      setIsLoading: (isLoading) => set({ isLoading }),
      setTheme: (theme) => {
        document.documentElement.setAttribute('data-theme', theme)
        set({ theme })
      },
    }),
    {
      name: 'habit-store',
      partialize: (s) => ({
        theme: s.theme,
        user: s.user,
        token: s.token,
        isAuthenticated: s.isAuthenticated,
      }),
    },
  ),
)
