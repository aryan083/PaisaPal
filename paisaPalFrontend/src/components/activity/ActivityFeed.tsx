import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Activity, Plus, Edit, Trash2, RefreshCw, Settings, Wallet, Receipt, X } from 'lucide-react'
import { fetchAuditLogs, type ApiAuditLog } from '@/lib/api'
import { toast } from 'sonner'

interface ActivityFeedProps {
  isOpen: boolean
  onClose: () => void
}

const ACTION_ICONS = {
  CREATE: Plus,
  UPDATE: Edit,
  DELETE: Trash2,
}

const RESOURCE_ICONS = {
  transaction: Receipt,
  settings: Settings,
  budget: Wallet,
  recurring: RefreshCw,
}

const ACTION_COLORS = {
  CREATE: 'text-green-500',
  UPDATE: 'text-blue-500',
  DELETE: 'text-red-500',
}

function formatTimeAgo(date: string): string {
  const now = new Date()
  const then = new Date(date)
  const diffMs = now.getTime() - then.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return then.toLocaleDateString()
}

export function ActivityFeed({ isOpen, onClose }: ActivityFeedProps) {
  const [logs, setLogs] = useState<ApiAuditLog[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen) {
      loadLogs()
    }
  }, [isOpen])

  const loadLogs = async () => {
    setLoading(true)
    try {
      const data = await fetchAuditLogs(50)
      setLogs(data)
    } catch (err) {
      console.error('Failed to load audit logs:', err)
      toast.error('Failed to load activity feed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 20 }}
            className="fixed right-0 top-0 h-full w-full sm:w-96 bg-card border-l border-border z-50 shadow-xl"
          >
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold text-foreground">Activity Feed</h2>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto h-[calc(100%-60px)]">
              {loading ? (
                <div className="flex items-center justify-center p-8">
                  <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-muted-foreground">
                  <Activity className="w-12 h-12 mb-2 opacity-50" />
                  <p>No activity yet</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {logs.map((log) => {
                    const ActionIcon = ACTION_ICONS[log.action]
                    const ResourceIcon = RESOURCE_ICONS[log.resource]
                    const actionColor = ACTION_COLORS[log.action]

                    return (
                      <motion.div
                        key={log._id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-4 hover:bg-secondary/50 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-lg bg-secondary ${actionColor}`}>
                            <ActionIcon className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-foreground capitalize">
                                {log.action.toLowerCase()}d
                              </span>
                              <ResourceIcon className="w-4 h-4 text-muted-foreground" />
                              <span className="text-muted-foreground capitalize">
                                {log.resource}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 truncate">
                              ID: {log.resourceId}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatTimeAgo(log.createdAt)}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
