import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`
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

export function formatDate(dateStr: string): string {
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
