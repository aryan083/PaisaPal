import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number | undefined | null): string {
  const safe = typeof amount === 'number' && Number.isFinite(amount) ? amount : 0
  return `₹${safe.toLocaleString('en-IN')}`
}

export function parseLocalDate(dateStr: string): Date {
  const val = dateStr.trim()

  const ddmmyyyy = val.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/)
  if (ddmmyyyy) {
    const day = Number(ddmmyyyy[1])
    const month = Number(ddmmyyyy[2])
    const year = Number(ddmmyyyy[3])
    return new Date(year, month - 1, day)
  }

  const ymd = val.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (ymd) {
    const year = Number(ymd[1])
    const month = Number(ymd[2])
    const day = Number(ymd[3])
    return new Date(year, month - 1, day)
  }

  // ISO datetime string (e.g. "2026-07-11T00:00:00.000Z" from API response)
  // Convert to IST date string first so the timezone is correct
  if (val.includes('T')) {
    const istKey = new Date(val).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
    return parseLocalDate(istKey)
  }

  return new Date(val)
}

export function toLocalDateKey(input: string | Date): string {
  const d = typeof input === 'string' ? parseLocalDate(input) : input
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function getWeekdayShort(dateStr: string): string {
  const d = parseLocalDate(dateStr)
  return d.toLocaleDateString('en-IN', { weekday: 'short' })
}

export function formatDate(dateStr: string | undefined | null): string {
  if (!dateStr) return '—'
  const d = parseLocalDate(dateStr)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatDateShort(dateStr: string): string {
  const d = parseLocalDate(dateStr)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

export function formatDateWithWeekday(dateStr: string): string {
  const d = parseLocalDate(dateStr)
  const day = d.toLocaleDateString('en-IN', { weekday: 'short' })
  const date = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  return `${day}, ${date}`
}

export function formatDateShortWithWeekday(dateStr: string): string {
  const d = parseLocalDate(dateStr)
  const day = d.toLocaleDateString('en-IN', { weekday: 'short' })
  const date = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
  return `${day}, ${date}`
}

export function generateId(): string {
  return crypto.randomUUID()
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function fromBase64Url(s: string): Uint8Array {
  const base = s.replace(/-/g, '+').replace(/_/g, '/')
  const pad = base.length % 4 === 0 ? base : base + '='.repeat(4 - (base.length % 4))
  const bin = atob(pad)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i)
  return bytes
}

export function encodeSnapshot(payload: unknown): string {
  const json = JSON.stringify(payload)
  const bytes = new TextEncoder().encode(json)
  return toBase64Url(bytes)
}

export function decodeSnapshot(encoded: string): unknown {
  const bytes = fromBase64Url(encoded)
  const json = new TextDecoder().decode(bytes)
  return JSON.parse(json) as unknown
}
