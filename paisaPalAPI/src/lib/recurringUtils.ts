export type Frequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly';

export function toIstDateKey(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

export function istStartOfDayUtc(d: Date): Date {
  const istKey = toIstDateKey(d);
  const [y, m, day] = istKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day, 0, 0, 0) - 330 * 60 * 1000);
}

function addIstDaysUtc(base: Date, days: number): Date {
  const istKey = toIstDateKey(base);
  const [y, m, d] = istKey.split('-').map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d + days, 0, 0, 0));
  return istStartOfDayUtc(shifted);
}

function getIstYmd(base: Date): { y: number; m: number; d: number } {
  const [y, m, d] = toIstDateKey(base).split('-').map(Number);
  return { y, m, d };
}

function makeIstStartUtc(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0) - 330 * 60 * 1000);
}

function clampToMonthEnd(y: number, m: number, targetDay: number): number {
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Math.min(targetDay, lastDay);
}

export function calculateNextDueDate(
  frequency: Frequency,
  lastPaidDate: Date,
  startDate: Date,
): Date {
  const base = istStartOfDayUtc(lastPaidDate ?? startDate);

  if (frequency === 'daily') {
    return addIstDaysUtc(base, 1);
  }

  if (frequency === 'weekly') {
    return addIstDaysUtc(base, 7);
  }

  if (frequency === 'biweekly') {
    return addIstDaysUtc(base, 14);
  }

  if (frequency === 'monthly') {
    const { y, m, d } = getIstYmd(base);
    const targetDay = d;
    const nextMonth = m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 };
    const day = clampToMonthEnd(nextMonth.y, nextMonth.m, targetDay);
    return makeIstStartUtc(nextMonth.y, nextMonth.m, day);
  }

  const { y, m, d } = getIstYmd(base);
  const targetDay = d;
  const nextYear = y + 1;
  const day = clampToMonthEnd(nextYear, m, targetDay);
  return makeIstStartUtc(nextYear, m, day);
}

export function getDaysUntilDue(nextDueDate: Date): number {
  const now = istStartOfDayUtc(new Date());
  const due = istStartOfDayUtc(nextDueDate);
  return Math.floor((due.getTime() - now.getTime()) / 86400000);
}

export function getProjectedMonthly(amount: number, frequency: Frequency): number {
  const factors: Record<Frequency, number> = {
    daily: 30,
    weekly: 4.33,
    biweekly: 2.17,
    monthly: 1,
    yearly: 1 / 12,
  };
  return Math.round(amount * factors[frequency]);
}

export function getProjectedYearly(amount: number, frequency: Frequency): number {
  const factors: Record<Frequency, number> = {
    daily: 365,
    weekly: 52,
    biweekly: 26,
    monthly: 12,
    yearly: 1,
  };
  return Math.round(amount * factors[frequency]);
}
