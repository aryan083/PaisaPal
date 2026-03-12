import type { Transaction, Settings } from '@/types'

const TRANSACTIONS_KEY = 'paisa-tracker-transactions'
const SETTINGS_KEY = 'paisa-tracker-settings'

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

const DEFAULT_SETTINGS: Settings = { stipend: 12000, extra: 0 }

function makeTx(data: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>): Transaction {
  const now = new Date().toISOString()
  return { ...data, id: crypto.randomUUID(), createdAt: now, updatedAt: now }
}

export function getTransactions(): Transaction[] {
  const raw = localStorage.getItem(TRANSACTIONS_KEY)
  if (!raw) {
    const seeded = SEED_TRANSACTIONS.map(makeTx)
    localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(seeded))
    return seeded
  }
  return JSON.parse(raw)
}

export function saveTransactions(txs: Transaction[]): void {
  localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(txs))
}

export function getSettings(): Settings {
  const raw = localStorage.getItem(SETTINGS_KEY)
  if (!raw) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(DEFAULT_SETTINGS))
    return DEFAULT_SETTINGS
  }
  return JSON.parse(raw)
}

export function saveSettings(s: Settings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
}
