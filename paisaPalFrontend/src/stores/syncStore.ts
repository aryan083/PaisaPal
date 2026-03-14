import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import { persist } from 'zustand/middleware'
import { useAuthStore } from './authStore'

import { getServerId, setIdMap } from '@/lib/idbStorage'
import { useStore } from '@/store'

export type SyncOperation = {
  idempotencyKey: string
  operation: 'create' | 'update' | 'delete'
  resource: 'transaction' | 'settings'
  data: Record<string, unknown>
  timestamp: string
}

interface SyncState {
  queue: SyncOperation[]
  isOnline: boolean
  isSyncing: boolean
  lastSync: string | null
  pendingCount: number

  addToQueue: (operation: Omit<SyncOperation, 'idempotencyKey' | 'timestamp'>) => string
  removeFromQueue: (idempotencyKey: string) => void
  clearQueue: () => void
  setOnline: (online: boolean) => void
  sync: () => Promise<void>
}

const API_BASE = '/api'

export const useSyncStore = create<SyncState>()(
  persist(
    (set, get) => ({
      queue: [],
      isOnline: navigator.onLine,
      isSyncing: false,
      lastSync: null,
      pendingCount: 0,

      addToQueue: (operation) => {
        const idempotencyKey = uuidv4()
        const syncOp: SyncOperation = {
          ...operation,
          idempotencyKey,
          timestamp: new Date().toISOString(),
        }
        set((state) => ({
          queue: [...state.queue, syncOp],
          pendingCount: state.pendingCount + 1,
        }))
        return idempotencyKey
      },

      removeFromQueue: (idempotencyKey) => {
        set((state) => ({
          queue: state.queue.filter((op) => op.idempotencyKey !== idempotencyKey),
          pendingCount: Math.max(0, state.pendingCount - 1),
        }))
      },

      clearQueue: () => {
        set({ queue: [], pendingCount: 0 })
      },

      setOnline: (online) => {
        set({ isOnline: online })
        if (online) {
          // Auto-sync when coming back online
          get().sync()
        }
      },

      sync: async () => {
        const { queue, isSyncing } = get()
        if (isSyncing || queue.length === 0) return

        const token = useAuthStore.getState().token
        if (!token) return

        const namespace = useAuthStore.getState().user?._id ?? 'anonymous'

        const sendable: SyncOperation[] = []
        for (const op of queue) {
          if (op.resource === 'settings') {
            sendable.push(op)
            continue
          }

          if (op.operation === 'create') {
            sendable.push(op)
            continue
          }

          const clientId = (op.data.clientId as string | undefined) ??
            (op.data._id as string | undefined)
          if (!clientId) continue

          const serverId = await getServerId(namespace, clientId)
          if (!serverId) {
            // can't sync updates/deletes until create is synced
            continue
          }

          sendable.push({
            ...op,
            data: {
              ...op.data,
              _id: serverId,
            },
          })
        }

        if (sendable.length === 0) return

        set({ isSyncing: true })

        try {
          const res = await fetch(`${API_BASE}/sync`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ operations: sendable }),
          })

          const data = await res.json()

          if (data.data?.results) {
            const results = data.data.results as Array<{
              idempotencyKey: string
              success: boolean
              resourceId?: string
            }>

            // Apply id mapping for successful creates
            for (const r of results) {
              if (!r.success || !r.resourceId) continue
              const op = queue.find(q => q.idempotencyKey === r.idempotencyKey)
              if (!op || op.resource !== 'transaction' || op.operation !== 'create') continue
              const clientId = op.data.clientId as string | undefined
              if (!clientId) continue

              await setIdMap(namespace, clientId, r.resourceId)

              // Update local store to replace clientId with serverId
              const store = useStore.getState()
              const txs = store.transactions.map(t =>
                t.id === clientId ? { ...t, id: r.resourceId } : t,
              )
              useStore.setState({ transactions: txs })
            }

            // Remove successful operations from queue
            const successfulKeys = results
              .filter(r => r.success)
              .map(r => r.idempotencyKey)

            set((state) => ({
              queue: state.queue.filter(
                (op) => !successfulKeys.includes(op.idempotencyKey)
              ),
              pendingCount: Math.max(
                0,
                state.pendingCount - successfulKeys.length
              ),
              lastSync: new Date().toISOString(),
            }))
          }
        } catch (err) {
          console.error('Sync failed:', err)
        } finally {
          set({ isSyncing: false })
        }
      },
    }),
    {
      name: 'sync-queue',
      partialize: (state) => ({
        queue: state.queue,
        pendingCount: state.pendingCount,
        lastSync: state.lastSync,
      }),
    }
  )
)

// Listen for online/offline events
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    useSyncStore.getState().setOnline(true)
  })
  window.addEventListener('offline', () => {
    useSyncStore.getState().setOnline(false)
  })
}
