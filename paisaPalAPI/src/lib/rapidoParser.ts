/**
 * Pure Rapido receipt parser (email subject + body → structured ride).
 * No DB, no side effects — safe to unit test.
 *
 * Real template (Oct 2026, from partner@rapido.bike, subject "Rapido Invoice"):
 * HTML invoice (quoted-printable) with Ride ID / "Time of Ride Oct 13th 2026,
 * 7:20 PM" / hero "Total ₹ 54.00" / Bill Details breakdown / "You Paid Using"
 * QR Pay|Cash + PDF attachment (never forwarded — see body limits).
 *
 * Calibrated against two real invoices (RD…4218 ₹54 QR Pay, RD…1986 ₹34 Cash).
 * Bank debit stays payment truth — this parser only captures Rapido's claim,
 * using exactly the app's vocabulary: Cash | Online | Card.
 */

export interface ParsedRapidoReceipt {
  rapidoAmount: number;
  date: Date;
  dateKey: string;
  /** Rapido's claimed payment mode ("Cash" is often wrong — bank wins, see K3). QR Pay counts as Online. */
  claimedMode: 'Cash' | 'Online' | 'Card' | 'UNKNOWN';
  receiptId: string | null;
  pickup: string | null;
  drop: string | null;
  confidence: 'high' | 'medium' | 'low';
}

export function toIstDateKey(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

import { stripToText } from './htmlText';

function toNum(raw: string): number | null {
  const n = Number(raw.replace(/,/g, '').trim());
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}

/** Prefer labelled totals ("Total", "Total Amount", ...), else first money mention. */
function extractAmount(text: string): number | null {
  const labelled = text.match(
    /(?:total(?: fare| amount)?|amount\s*(?:paid|payable|charged)|grand\s*total|fare|trip\s*total|invoice\s*total)\s*[: ]?\s*(?:Rs\.?|INR|₹)?\s*([\d,]+(?:\.\d{1,2})?)/i,
  );
  if (labelled?.[1]) {
    const n = toNum(labelled[1]);
    if (n !== null) return n;
  }
  const first = text.match(/(?:Rs\.?|INR|₹)\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (first?.[1]) return toNum(first[1]);
  return null;
}

function extractClaimedMode(text: string): ParsedRapidoReceipt['claimedMode'] {
  // Real template: "You Paid Using ... QR Pay|Cash". Also accept "Payment mode: X".
  const labelled = text.match(
    /(?:paid\s*using|payment\s*mode)\s*[: ]?\s*(cash|qr\s*pay|upi|online|card|wallet)/i,
  )?.[1]?.toLowerCase().replace(/\s+/g, ' ');
  const mode = mapModeToken(labelled);
  if (mode) return mode;
  // Unlabelled mentions as fallback.
  if (/\bpaid\s+(?:in\s+|using\s+)?cash\b/i.test(text)) return 'Cash';
  if (/\bqr\s*pay\b/i.test(text)) return 'Online';
  if (/\bupi\b/i.test(text)) return 'Online';
  if (/\bcard\b/i.test(text)) return 'Card';
  return 'UNKNOWN';
}

function mapModeToken(token: string | undefined): ParsedRapidoReceipt['claimedMode'] | null {
  if (!token) return null;
  if (token === 'cash') return 'Cash';
  if (token === 'card') return 'Card';
  if (token === 'qr pay' || token === 'upi' || token === 'online' || token === 'wallet') return 'Online';
  return null;
}

function extractReceiptId(text: string): string | null {
  // Require an explicit ID marker (ID/No/number word or :/#) — a bare space
  // is not enough, otherwise "Rapido Invoice Payment ..." captures "Payment".
  const m = text.match(
    /(?:receipt|invoice|ride|trip|booking|order)(?:\s*(?:id|no|number)\s*[:# ]?|\s*[:#])\s*([A-Za-z0-9\-]{6,40})/i,
  );
  return m?.[1]?.slice(0, 64) ?? null;
}

function extractEndpoint(text: string, label: 'pickup' | 'drop'): string | null {
  const re =
    label === 'pickup'
      ? /(?:pickup|pick-up|from|source)\s*[: ]\s*([^\n]{3,120})/i
      : /(?:drop|dropoff|drop-off|to|destination)\s*[: ]\s*([^\n]{3,120})/i;
  const m = text.match(re);
  return m?.[1]?.trim().slice(0, 200) ?? null;
}

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/** Convert captured y/mon/d + optional IST clock time to a Date. Months are 0-based. */
function toDateFromParts(
  year: number, mon: number, day: number, hhRaw?: string, mmRaw?: string, ampmRaw?: string,
): Date | null {
  let hh = hhRaw ? Number(hhRaw) : 12;
  const mm = mmRaw ? Number(mmRaw) : 0;
  const ampm = ampmRaw?.toUpperCase();
  if (ampm === 'PM' && hh < 12) hh += 12;
  if (ampm === 'AM' && hh === 12) hh = 0;
  // Wall clock is IST → shift back to UTC for storage.
  const d = new Date(Date.UTC(year, mon, day, hh - 5, mm - 30, 0));
  return isNaN(d.getTime()) ? null : d;
}

function extractDate(text: string, fallback: Date): Date {
  // "Oct 13th 2026, 7:20 PM" (real Rapido template) — also bare "Oct 13th 2026".
  let m = text.match(
    /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2})(?:st|nd|rd|th)?[,\s]+(\d{4})(?:\s+(\d{1,2}):(\d{2})\s*(AM|PM)?)?/i,
  );
  if (m?.[1] && m[2] && m[3]) {
    const mon = MONTHS[m[1].toLowerCase()];
    if (mon !== undefined) {
      const d = toDateFromParts(Number(m[3]), mon, Number(m[2]), m[4], m[5], m[6]);
      if (d) return d;
    }
  }
  // "08-Oct-2026" / "08 Oct 2026" (+ ordinals), optional time.
  m = text.match(
    /(\d{1,2})(?:st|nd|rd|th)?[-\s/](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[-\s/,]+(\d{4})(?:\s+(\d{1,2}):(\d{2})\s*(AM|PM)?)?/i,
  );
  if (m?.[1] && m[2] && m[3]) {
    const mon = MONTHS[m[2].toLowerCase()];
    if (mon !== undefined) {
      const d = toDateFromParts(Number(m[3]), mon, Number(m[1]), m[4], m[5], m[6]);
      if (d) return d;
    }
  }
  m = text.match(/(\d{1,2})[\/](\d{1,2})[\/](\d{4})/);
  if (m?.[1] && m[2] && m[3]) {
    const d = new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1]), 6, 30, 0));
    if (!isNaN(d.getTime())) return d;
  }
  return fallback;
}

export function parseRapidoEmail(
  subject: string,
  body: string,
  receivedAt?: Date,
): ParsedRapidoReceipt | null {
  const clean = stripToText(`${subject}\n${body}`);
  if (!/rapido/i.test(clean)) return null; // not a Rapido receipt at all
  if (clean.length < 20) return null;

  const rapidoAmount = extractAmount(clean);
  if (rapidoAmount === null) return null;

  const fallback = receivedAt ?? new Date();
  const date = extractDate(clean, fallback);
  const claimedMode = extractClaimedMode(clean);
  const receiptId = extractReceiptId(clean);
  const pickup = extractEndpoint(clean, 'pickup');
  const drop = extractEndpoint(clean, 'drop');

  const signals = [receiptId !== null, claimedMode !== 'UNKNOWN', pickup !== null || drop !== null].filter(
    Boolean,
  ).length;
  const confidence = signals >= 2 ? 'high' : signals === 1 ? 'medium' : 'low';

  return {
    rapidoAmount,
    date,
    dateKey: toIstDateKey(date),
    claimedMode,
    receiptId,
    pickup,
    drop,
    confidence,
  };
}
