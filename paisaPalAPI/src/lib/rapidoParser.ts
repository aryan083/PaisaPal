/**
 * Pure Rapido receipt parser (email subject + body → structured ride).
 * No DB, no side effects — safe to unit test.
 *
 * Rapido sends ride receipts by email (no public API). Templates vary, so
 * this is best-effort v1: amount first, everything else optional.
 * Bank debit stays payment truth — this parser only captures Rapido's claim.
 */

export interface ParsedRapidoReceipt {
  rapidoAmount: number;
  date: Date;
  dateKey: string;
  /** Rapido's claimed payment mode ("Cash" is often wrong — see K3). */
  claimedMode: 'Cash' | 'UPI' | 'Online' | 'UNKNOWN';
  receiptId: string | null;
  pickup: string | null;
  drop: string | null;
  confidence: 'high' | 'medium' | 'low';
}

export function toIstDateKey(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function toNum(raw: string): number | null {
  const n = Number(raw.replace(/,/g, '').trim());
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}

/** Prefer labelled totals ("Total fare", "Amount paid", "Grand total"), else first money mention. */
function extractAmount(subject: string, body: string): number | null {
  const text = `${subject}\n${body}`;
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

function extractClaimedMode(body: string): ParsedRapidoReceipt['claimedMode'] {
  const m = body.match(/payment\s*mode\s*[: ]?\s*(cash|upi|online|card|wallet)/i)?.[1]?.toLowerCase();
  if (m === 'cash') return 'Cash';
  if (m === 'upi') return 'UPI';
  if (m === 'online' || m === 'card' || m === 'wallet') return 'Online';
  // Unlabelled mentions as fallback.
  if (/\bpaid\s+(?:in\s+)?cash\b/i.test(body)) return 'Cash';
  if (/\bupi\b/i.test(body)) return 'UPI';
  return 'UNKNOWN';
}

function extractReceiptId(subject: string, body: string): string | null {
  const text = `${subject}\n${body}`;
  const m = text.match(
    /(?:receipt|invoice|ride|trip|booking|order)(?:\s*(?:id|no|number))?\s*[:# ]\s*([A-Za-z0-9\-]{6,40})/i,
  );
  return m?.[1]?.slice(0, 64) ?? null;
}

function extractEndpoint(body: string, label: 'pickup' | 'drop'): string | null {
  const re =
    label === 'pickup'
      ? /(?:pickup|pick-up|from|source)\s*[: ]\s*([^\n]{3,120})/i
      : /(?:drop|dropoff|drop-off|to|destination)\s*[: ]\s*([^\n]{3,120})/i;
  const m = body.match(re);
  return m?.[1]?.trim().slice(0, 200) ?? null;
}

function extractDate(subject: string, body: string, fallback: Date): Date {
  const text = `${subject}\n${body}`;
  // 08-Oct-2026 / 08 Oct 2026 / 08/10/2026 / 2026-10-08, optional time.
  const months: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };
  let m = text.match(
    /(\d{1,2})[-\s/](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[-\s/,]+(\d{4})(?:\s+(\d{1,2}):(\d{2})\s*(AM|PM)?)?/i,
  );
  if (m?.[1] && m[2] && m[3]) {
    const mon = months[m[2].toLowerCase()];
    if (mon !== undefined) {
      let hh = m[4] ? Number(m[4]) : 12;
      const mm = m[5] ? Number(m[5]) : 0;
      if (m[6]?.toUpperCase() === 'PM' && hh < 12) hh += 12;
      if (m[6]?.toUpperCase() === 'AM' && hh === 12) hh = 0;
      const d = new Date(Date.UTC(Number(m[3]), mon, Number(m[1]), hh - 5, mm - 30, 0));
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

export function parseRapidoEmail(
  subject: string,
  body: string,
  receivedAt?: Date,
): ParsedRapidoReceipt | null {
  const text = `${subject}\n${body}`;
  if (!/rapido/i.test(text)) return null; // not a Rapido receipt at all
  if (text.trim().length < 20) return null;

  const rapidoAmount = extractAmount(subject, body);
  if (rapidoAmount === null) return null;

  const fallback = receivedAt ?? new Date();
  const date = extractDate(subject, body, fallback);
  const claimedMode = extractClaimedMode(body);
  const receiptId = extractReceiptId(subject, body);
  const pickup = extractEndpoint(body, 'pickup');
  const drop = extractEndpoint(body, 'drop');

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
