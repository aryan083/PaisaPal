import { openDB, type DBSchema } from 'idb'

import type { Settings, Transaction } from '@/types'

type StoredSettings = {
  key: 'settings'
  value: Settings
}

interface PaisaPalDb extends DBSchema {
  transactions: {
    key: string
    value: Transaction
    indexes: { 'by-updated-at': string }
  }
  id_map: {
    key: string
    value: { clientId: string; serverId: string }
  }
  settings: {
    key: StoredSettings['key']
    value: StoredSettings
  }
}

const DB_NAME = 'paisa-pal'
const DB_VERSION = 1

function dbName(namespace: string): string {
  return `${DB_NAME}:${namespace}`
}

async function getDb(namespace: string) {
  return openDB<PaisaPalDb>(dbName(namespace), DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('transactions')) {
        const store = db.createObjectStore('transactions', { keyPath: 'id' })
        store.createIndex('by-updated-at', 'updatedAt')
      }
      if (!db.objectStoreNames.contains('id_map')) {
        db.createObjectStore('id_map', { keyPath: 'clientId' })
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' })
      }
    },
  })
}

export async function getCachedTransactions(namespace: string): Promise<Transaction[]> {
  const db = await getDb(namespace)
  return db.getAll('transactions')
}

export async function cacheTransactions(
  namespace: string,
  transactions: Transaction[],
): Promise<void> {
  const db = await getDb(namespace)
  const tx = db.transaction('transactions', 'readwrite')
  await tx.store.clear()
  for (const t of transactions) {
    await tx.store.put(t)
  }
  await tx.done
}

export async function upsertCachedTransaction(
  namespace: string,
  transaction: Transaction,
): Promise<void> {
  const db = await getDb(namespace)
  await db.put('transactions', transaction)
}

export async function deleteCachedTransaction(namespace: string, id: string): Promise<void> {
  const db = await getDb(namespace)
  await db.delete('transactions', id)
}

export async function getCachedSettings(namespace: string): Promise<Settings | null> {
  const db = await getDb(namespace)
  const stored = await db.get('settings', 'settings')
  return stored?.value ?? null
}

export async function getServerId(
  namespace: string,
  clientId: string,
): Promise<string | null> {
  const db = await getDb(namespace)
  const mapped = await db.get('id_map', clientId)
  return mapped?.serverId ?? null
}

export async function setIdMap(
  namespace: string,
  clientId: string,
  serverId: string,
): Promise<void> {
  const db = await getDb(namespace)
  await db.put('id_map', { clientId, serverId })
}

export async function cacheSettings(namespace: string, settings: Settings): Promise<void> {
  const db = await getDb(namespace)
  await db.put('settings', { key: 'settings', value: settings })
}
