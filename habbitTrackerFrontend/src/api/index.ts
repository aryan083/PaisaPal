import { useStore } from '@/store'
import type {
  ApiResponse, User, Habit, HabitInput, HabitLog, HabitLogInput,
  HabitLogResponse, HabitStats, Insight, HabitCategory, AchievementsData, LifeScore,
} from '@/types'

const BASE = import.meta.env.VITE_API_URL ?? ''

function getToken(): string | null {
  return localStorage.getItem('habit_token')
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  params?: Record<string, string>,
): Promise<ApiResponse<T>> {
  const url = new URL(`${BASE}${path}`, window.location.origin)
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '') url.searchParams.set(k, v)
    })
  }

  const token = getToken()
  const res = await fetch(url.toString(), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...((options.headers as Record<string, string>) ?? {}),
    },
  })

  if (res.status === 401) {
    localStorage.removeItem('habit_token')
    useStore.getState().clearAuth()
    window.location.href = '/login'
    return { data: null, error: 'Unauthorized' }
  }

  return res.json() as Promise<ApiResponse<T>>
}

export const authApi = {
  me: () => request<User>('/api/auth/me'),
}

export const habitsApi = {
  list: (params?: { categoryId?: string; isArchived?: string; includeToday?: string }) =>
    request<Habit[]>('/api/habits', {}, params as Record<string, string>),

  create: (body: HabitInput) =>
    request<Habit>('/api/habits', { method: 'POST', body: JSON.stringify(body) }),

  get: (id: string) =>
    request<Habit>(`/api/habits/${id}`),

  update: (id: string, body: Partial<HabitInput>) =>
    request<Habit>(`/api/habits/${id}`, { method: 'PUT', body: JSON.stringify(body) }),

  archive: (id: string) =>
    request<Habit>(`/api/habits/${id}`, { method: 'DELETE' }),

  log: (id: string, body: HabitLogInput) =>
    request<HabitLogResponse>(`/api/habits/${id}/log`, { method: 'POST', body: JSON.stringify(body) }),

  getLogs: (id: string, from: string, to: string) =>
    request<HabitLog[]>(`/api/habits/${id}/logs`, {}, { from, to }),

  getStats: () =>
    request<HabitStats>('/api/habits/stats'),

  getInsights: () =>
    request<{ insights: Insight[] }>('/api/habits/insights'),

  getCategories: () =>
    request<HabitCategory[]>('/api/habits/categories'),

  createCategory: (body: { name: string; icon: string; color: string }) =>
    request<HabitCategory>('/api/habits/categories', { method: 'POST', body: JSON.stringify(body) }),
}

export const achievementsApi = {
  get: () => request<AchievementsData>('/api/achievements'),
}

export const lifeApi = {
  get: () => request<LifeScore>('/api/life'),
}
