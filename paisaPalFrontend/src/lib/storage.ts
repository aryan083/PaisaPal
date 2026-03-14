import type { Transaction, Settings } from '@/types'

import {
  cacheSettings,
  cacheTransactions,
  getCachedSettings,
  getCachedTransactions,
} from './idbStorage'

const SEED_TRANSACTIONS: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>[] = [
  { date: '2025-12-30', particulars: 'Rajkot to Ahmedabad - GSRTC Volvo', amount: 0, category: 'Bus/GSRTC', mode: 'Online', notes: '' },
  { date: '2026-03-01', particulars: 'iPhone Case', amount: 161, category: 'Shopping', mode: 'Online', notes: 'Paid to Flipkart' },
  { date: '2026-03-02', particulars: 'Rapido: Home Haven to KP Epitome', amount: 41, category: 'Rapido', mode: 'Online', notes: '' },
  { date: '2026-03-02', particulars: 'Rapido: KP Epitome to Home Haven', amount: 59, category: 'Rapido', mode: 'Online', notes: '' },
  { date: '2026-03-03', particulars: 'Rapido: Home Haven to KP Epitome', amount: 34, category: 'Rapido', mode: 'Online', notes: '' },
  { date: '2026-03-03', particulars: 'Rapido: KP Epitome to Home Haven', amount: 59, category: 'Rapido', mode: 'Online', notes: '' },
  { date: '2026-03-05', particulars: 'Rapido: Home Haven to KP Epitome', amount: 41, category: 'Rapido', mode: 'Online', notes: '' },
  { date: '2026-03-05', particulars: 'Rapido: KP Epitome to Home Haven', amount: 50, category: 'Rapido', mode: 'Online', notes: '' },
  { date: '2026-03-05', particulars: 'Soap + Bhakarvadi snack', amount: 85, category: 'Self Care', mode: 'Online', notes: 'Self care? Hell na' },
  { date: '2026-03-06', particulars: 'Rapido: Home Haven to KP Epitome', amount: 34, category: 'Rapido', mode: 'Online', notes: '' },
  { date: '2026-03-06', particulars: 'Rapido: KP Epitome to Home Haven', amount: 41, category: 'Rapido', mode: 'Online', notes: '' },
  { date: '2026-03-07', particulars: 'Sugar Cane Juice', amount: 160, category: 'Food & Drinks', mode: 'Online', notes: '' },
  { date: '2026-03-07', particulars: 'Bus: Ahmedabad to Rajkot', amount: 208, category: 'Bus/GSRTC', mode: 'Online', notes: 'Paid to Umang' },
  { date: '2026-03-07', particulars: 'Rapido: Home to Marwadi', amount: 116, category: 'Rapido', mode: 'Online', notes: '' },
  { date: '2026-03-07', particulars: 'Lunch: 2 Dhokla + Hide n Seek', amount: 90, category: 'Food & Drinks', mode: 'Online', notes: '' },
  { date: '2026-03-07', particulars: 'Farewell', amount: 580, category: 'Social', mode: 'Online', notes: '' },
  { date: '2026-03-08', particulars: 'Recharge 49', amount: 49, category: 'Recharge/Bills', mode: 'Online', notes: '' },
  { date: '2026-03-08', particulars: 'Bus: Rajkot to Ahmedabad', amount: 208, category: 'Bus/GSRTC', mode: 'Online', notes: 'Paid to Ritesh' },
  { date: '2026-03-24', particulars: 'Flipkart: DualShock Controller', amount: 895, category: 'Shopping', mode: 'Online', notes: 'ETA 24-Mar' },
  { date: '2026-03-09', particulars: 'Rapido: Home Haven to KP Epitome', amount: 41, category: 'Rapido', mode: 'Online', notes: '' },
  { date: '2026-03-09', particulars: 'Rapido: KP Epitome to Home Haven', amount: 67, category: 'Rapido', mode: 'Online', notes: '' },
  { date: '2026-03-09', particulars: 'Xerox + Glue + Nail Cutter', amount: 92, category: 'Shopping', mode: 'Cash', notes: '' },
  { date: '2026-03-08', particulars: 'Sprite + Fanta', amount: 80, category: 'Food & Drinks', mode: 'Online', notes: '' },
  { date: '2026-03-10', particulars: 'Rapido: Home Haven to KP Epitome', amount: 34, category: 'Rapido', mode: 'Online', notes: '' },
  { date: '2026-03-10', particulars: 'Rapido: KP Epitome to Home Haven', amount: 41, category: 'Rapido', mode: 'Online', notes: '' },
  { date: '2026-03-10', particulars: 'Send to Adii', amount: 100, category: 'Transfer/Sent', mode: 'Online', notes: '' },
]

const DEFAULT_SETTINGS: Settings = { stipend: 12000, extra: 0, categoryConfig: [] }

const DEFAULT_NAMESPACE = 'anonymous'

function makeTx(data: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>): Transaction {
  const now = new Date().toISOString()
  return { ...data, id: crypto.randomUUID(), createdAt: now, updatedAt: now }
}

export async function getTransactions(namespace?: string): Promise<Transaction[]> {
  const ns = namespace ?? DEFAULT_NAMESPACE
  const cached = await getCachedTransactions(ns)
  if (cached.length > 0) return cached

  const seeded = SEED_TRANSACTIONS.map(makeTx)
  await cacheTransactions(ns, seeded)
  return seeded
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
