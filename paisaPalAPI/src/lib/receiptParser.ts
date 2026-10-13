/**
 * Generic shopping/food-delivery receipt parser (email subject + body).
 * Covers Amazon, Swiggy, Instamart, Flipkart — best-effort v1.
 * No DB, no side effects. Bank debit stays payment truth; this only
 * captures the app's claim (amount, order id, date) for linking.
 */

export type ReceiptApp = 'AMAZON' | 'SWIGGY' | 'INSTAMART' | 'FLIPKART' | 'GENERIC';

export interface ParsedReceipt {
  app: ReceiptApp;
  amount: number;
  date: Date;
  dateKey: string;
  orderId: string | null;
  categoryGuess: string;
  confidence: 'high' | 'medium' | 'low';
}

export function toIstDateKey(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

export function detectApp(senderOrSubject: string, body: string): ReceiptApp {
  const s = `${senderOrSubject} ${body}`.toLowerCase();
  if (/instamart/.test(s)) return 'INSTAMART';
  if (/swiggy/.test(s)) return 'SWIGGY';
  if (/flipkart/.test(s)) return 'FLIPKART';
  if (/amazon/.test(s)) return 'AMAZON';
  return 'GENERIC';
}

export function categoryForApp(app: ReceiptApp): string {
  switch (app) {
    case 'AMAZON':
    case 'FLIPKART':
      return 'Shopping';
    case 'SWIGGY':
    case 'INSTAMART':
      return 'Food & Drinks';
    default:
      return 'Other';
  }
}

function toNum(raw: string): number | null {
  const n = Number(raw.replace(/,/g, '').trim());
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}

/** Prefer labelled totals; fall back to first money mention. */
function extractAmount(subject: string, body: string): number | null {
  const text = `${subject}\n${body}`;
  const labelled = text.match(
    /(?:grand\s*total|order\s*total|total(?: amount| payable| paid)?|amount\s*(?:paid|payable|charged)|invoice\s*(?:value|total|amount)|bill\s*(?:total|amount))\s*[: ]?\s*(?:Rs\.?|INR|₹)?\s*([\d,]+(?:\.\d{1,2})?)/i,
  );
  if (labelled?.[1]) {
    const n = toNum(labelled[1]);
    if (n !== null) return n;
  }
  const first = text.match(/(?:Rs\.?|INR|₹)\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (first?.[1]) return toNum(first[1]);
  return null;
}

function extractOrderId(subject: string, body: string): string | null {
  const text = `${subject}\n${body}`;
  const patterns = [
    /(?:order|invoice|receipt|booking)(?:\s*(?:id|no|number))?\s*[:# ]\s*([A-Z0-9\-]{6,40})/i,
    /#\s*([0-9]{6,20})/,
    /\b([0-9]{3}-[0-9]{7}-[0-9]{7})\b/, // Amazon.in invoice format
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) return m[1].slice(0, 64);
  }
  return null;
}

function extractDate(subject: string, body: string, fallback: Date): Date {
  const text = `${subject}\n${body}`;
  const months: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };
  let m = text.match(
    /(\d{1,2})[-\s/](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[-\s/,]+(\d{4})/i,
  );
  if (m?.[1] && m[2] && m[3]) {
    const mon = months[m[2].toLowerCase()];
    if (mon !== undefined) {
      const d = new Date(Date.UTC(Number(m[3]), mon, Number(m[1]), 6, 30, 0));
      if (!isNaN(d.getTime())) return d;
    }
  }
  m = text.match(/(\d{1,2})[\/](\d{1,2})[\/](\d{4})/);
  if (m?.[1] && m[2] && m[3]) {
    const d = new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1]), 6, 30, 0));
    if (!isNaN(d.getTime())) return d;
  }
  return fallback;
}

export function parseReceiptEmail(
  opts: { app?: string; subject: string; body: string; senderHint?: string },
  receivedAt?: Date,
): ParsedReceipt | null {
  const { subject, body } = opts;
  const text = `${subject}\n${body}`;
  if (text.trim().length < 20) return null;

  const amount = extractAmount(subject, body);
  if (amount === null) return null;

  const hinted = (opts.app ?? '').toUpperCase();
  const app: ReceiptApp =
    hinted === 'AMAZON' || hinted === 'SWIGGY' || hinted === 'INSTAMART' || hinted === 'FLIPKART'
      ? (hinted as ReceiptApp)
      : detectApp(`${opts.senderHint ?? ''} ${subject}`, body);

  const fallback = receivedAt ?? new Date();
  const date = extractDate(subject, body, fallback);
  const orderId = extractOrderId(subject, body);
  const categoryGuess = categoryForApp(app);

  const signals = [app !== 'GENERIC', orderId !== null].filter(Boolean).length;
  const confidence = signals === 2 ? 'high' : signals === 1 ? 'medium' : 'low';

  return { app, amount, date, dateKey: toIstDateKey(date), orderId, categoryGuess, confidence };
}
