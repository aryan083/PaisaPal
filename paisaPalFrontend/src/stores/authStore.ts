import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type AuthErrorResponse = {
  error?: string | null
  suggestion?: string
}

export interface User {
  _id: string
  email: string
  name: string
}

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  setUser: (user: User | null) => void
  setToken: (token: string | null) => void
  login: (email: string, password: string) => Promise<boolean>
  register: (email: string, password: string, name: string) => Promise<boolean>
  logout: () => void
  clearError: () => void
  checkAuth: () => Promise<void>
}

const API_BASE = '/api'

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setToken: (token) => set({ token }),

      login: async (email, password) => {
        set({ isLoading: true, error: null })
        try {
          const res = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
          })
          const data = (await res.json()) as AuthErrorResponse & { data?: any }
          if (data.error) {
            const msg = data.suggestion ? `${data.error} ${data.suggestion}` : data.error
            set({ error: msg, isLoading: false })
            return false
          }
          set({
            user: data.data.user,
            token: data.data.token,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          })
          return true
        } catch (err) {
          set({ error: 'Failed to login', isLoading: false })
          return false
        }
      },

      register: async (email, password, name) => {
        set({ isLoading: true, error: null })
        try {
          const res = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, name }),
          })
          const data = (await res.json()) as AuthErrorResponse & { data?: any }
          if (data.error) {
            const msg = data.suggestion ? `${data.error} ${data.suggestion}` : data.error
            set({ error: msg, isLoading: false })
            return false
          }
          set({
            user: data.data.user,
            token: data.data.token,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          })
          return true
        } catch (err) {
          set({ error: 'Failed to register', isLoading: false })
          return false
        }
      },

      logout: () => {
        set({ user: null, token: null, isAuthenticated: false, error: null })
      },

      clearError: () => set({ error: null }),

      checkAuth: async () => {
        const { token } = get()
        if (!token) {
          set({ isAuthenticated: false, user: null })
          return
        }
        try {
          const res = await fetch(`${API_BASE}/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          const data = await res.json()
          if (data.error) {
            set({ user: null, token: null, isAuthenticated: false })
            return
          }
          set({ user: data.data, isAuthenticated: true })
        } catch {
          set({ user: null, token: null, isAuthenticated: false })
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ token: state.token, user: state.user }),
    }
  )
)
