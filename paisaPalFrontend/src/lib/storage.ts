import type { Transaction, Settings } from '@/types'

import {
  cacheSettings,
  cacheTransactions,
  getCachedSettings,
  getCachedTransactions,
} from './idbStorage'

const DEFAULT_SETTINGS: Settings = { stipend: 12000, extra: 0, categoryConfig: [] }

const DEFAULT_NAMESPACE = 'anonymous'

export async function getTransactions(namespace?: string): Promise<Transaction[]> {
  const ns = namespace ?? DEFAULT_NAMESPACE
  const cached = await getCachedTransactions(ns)
  if (cached.length > 0) return cached

  return []
}

export async function saveTransactions(
  txs: Transaction[],
  namespace?: string,
): Promise<void> {
  const ns = namespace ?? DEFAULT_NAMESPACE
  await cacheTransactions(ns, txs)
}

export async function getSettings(namespace?: string): Promise<Settings> {
  const ns = namespace ?? DEFAULT_NAMESPACE
  const cached = await getCachedSettings(ns)
  if (cached) return cached
  await cacheSettings(ns, DEFAULT_SETTINGS)
  return DEFAULT_SETTINGS
}

export async function saveSettings(s: Settings, namespace?: string): Promise<void> {
  const ns = namespace ?? DEFAULT_NAMESPACE
  await cacheSettings(ns, s)
}
