/**
 * Pure SMS parser for Indian bank transaction alerts.
 * No DB, no side effects — safe to unit test.
 *
 * Supported (best-effort, v1):
 *  - BOB / Kotak debit + credit SMS in common formats:
 *    "Rs.1,234.56 debited from A/c XX1234 on 08-Oct-26 ... UPI/..."
 *    "INR 2,000 credited to A/c ... Ref No 123456..."
 *  - Amount in Rs./Rs/INR/₹ with Indian commas
 *  - Direction via debited/credited (and common synonyms)
 *  - UPI ref / UTR / Ref No extraction (best-effort, may be null)
 *  - Account tail (last 4), available balance (best-effort, may be null)
 *  - Date inside SMS (dd-MMM-yy, dd/MM/yyyy, etc.) else falls back to receivedAt/now
 */

export type SmsDirection = 'DEBIT' | 'CREDIT' | 'UNKNOWN';

export interface ParsedSms {
  direction: SmsDirection;
  amount: number;
  /** JS Date in IST wall-clock terms (dateKey derived via Asia/Kolkata). */
  date: Date;
  dateKey: string;
  /** Short human label for Transaction.particulars (<=200 chars). */
  narration: string;
  upiRef: string | null;
  accountTail: string | null;
  balance: number | null;
  bank: 'BOB' | 'KOTAK' | 'UNKNOWN';
  categoryGuess: string;
  confidence: 'high' | 'medium' | 'low';
  rawExcerpt: string;
}

export function toIstDateKey(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function parseAmountToNumber(raw: string): number | null {
  const cleaned = raw.replace(/,/g, '').trim();
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n <= 0) return null;
  // Round to paise to avoid float dust.
  return Math.round(n * 100) / 100;
}

function extractAmount(body: string): number | null {
  // Rs.1,234.56 / Rs 2000 / INR 500 / ₹65 — take the FIRST money mention
  // (transaction amount precedes balance in almost all bank templates).
  const m = body.match(/(?:Rs\.?|INR|₹)\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (!m?.[1]) return null;
  return parseAmountToNumber(m[1]);
}

function extractDirection(body: string): SmsDirection {
  const lower = body.toLowerCase();
  if (/(debited|debit\b|spent|paid|withdrawn|deducted|purchase)/i.test(lower)) return 'DEBIT';
  if (/(credited|credit\b|received|deposited|refund)/i.test(lower)) return 'CREDIT';
  return 'UNKNOWN';
}

function extractUpiRef(body: string): string | null {
  // UPI/a/b/ref patterns + generic Ref No / UTR
  const patterns = [
    /UPI\/([A-Za-z0-9]+)\/(\d{6,})/i, // UPI/<vpa>/<ref>
    /UPI\s*(?:Ref(?:erence)?(?:\s*No\.?)?|ID|Txn)\s*[: ]?\s*([A-Za-z0-9]{6,})/i,
    /(?:UTR|UPI|Ref(?:erence)?(?:\s*No\.?)?)\s*[: ]\s*(\d{6,})/i,
  ];
  for (const re of patterns) {
    const m = body.match(re);
    if (m) {
      // Prefer the longest numeric-ish group (the actual ref).
      const groups = m.slice(1).filter(Boolean);
      const numeric = groups.filter((g) => /\d/.test(g)).sort((a, b) => b.length - a.length);
      if (numeric[0]) return numeric[0].slice(0, 64);
      if (groups[0]) return groups[0].slice(0, 64);
    }
  }
  return null;
}

function extractAccountTail(body: string): string | null {
  const patterns = [
    /A\/c\s*(?:XX|X\*|xx|\*)*(\d{4})/i,
    /Acct(?:ount)?\s*(?:XX|X\*|\*)*(\d{4})/i,
    /ending\s*(?:with\s*)?(\d{4})/i,
    /XX(\d{4})\b/,
  ];
  for (const re of patterns) {
    const m = body.match(re);
    if (m?.[1]) return m[1];
  }
  return null;
}

function extractBalance(body: string): number | null {
  const m = body.match(
    /(?:Avl\s*Bal|Available\s*Balance|Bal|Balance)\s*[: ]?\s*(?:Rs\.?|INR|₹)?\s*([\d,]+(?:\.\d{1,2})?)/i,
  );
  if (!m?.[1]) return null;
  return parseAmountToNumber(m[1]);
}

function extractDateInSms(body: string): Date | null {
  // 08-Oct-26, 08-Oct-2026, 08/10/2026, 08-10-2026, 2026-10-08
  const months: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };
  let m = body.match(/(\d{1,2})[-\/](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[-\/](\d{2,4})/i);
  if (m?.[1] && m[2] && m[3]) {
    const day = Number(m[1]);
    const mon = months[m[2].toLowerCase()];
    let year = Number(m[3]);
    if (year < 100) year += 2000;
    if (mon !== undefined && day >= 1 && day <= 31) {
      // Noon UTC keeps IST dateKey stable regardless of TZ edge.
      const d = new Date(Date.UTC(year, mon, day, 6, 30, 0));
      if (!isNaN(d.getTime())) return d;
    }
  }
  m = body.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (m?.[1] && m[2] && m[3]) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const year = Number(m[3]);
    // Assume DD/MM/YYYY (Indian convention) unless first part > 12.
    const day = a > 12 ? a : a;
    const mon = (a > 12 ? b : b) - 1;
    void day;
    const d = new Date(Date.UTC(year, mon, a <= 12 ? a : a, 6, 30, 0));
    // Rebuild properly: day=a, month=b-1 when a<=31 and b<=12
    const dd = new Date(Date.UTC(year, b - 1 > 11 ? 0 : b - 1, a, 6, 30, 0));
    if (!isNaN(dd.getTime()) && a >= 1 && a <= 31 && b >= 1 && b <= 12) return dd;
    if (!isNaN(d.getTime())) return d;
  }
  m = body.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m?.[1] && m[2] && m[3]) {
    const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 6, 30, 0));
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

export function guessBank(sender: string, body: string): ParsedSms['bank'] {
  const s = `${sender} ${body}`.toUpperCase();
  if (/BOB|BARODA|BANKOFBARODA/.test(s)) return 'BOB';
  if (/KOTAK|KOTAKB|KMBL/.test(s)) return 'KOTAK';
  return 'UNKNOWN';
}

export function guessCategory(body: string, narration: string): string {
  const s = `${body} ${narration}`.toLowerCase();
  if (/rapido/.test(s)) return 'Rapido';
  if (/swiggy|zomato|food|restaurant|cafe|coffee/.test(s)) return 'Food & Drinks';
  if (/uber|ola|metro|bus|gsrtc|petrol|fuel/.test(s)) return 'Bus/GSRTC';
  if (/amazon|flipkart|shopping|myntra|store/.test(s)) return 'Shopping';
  if (/recharge|bill|electricity|jio|airtel/.test(s)) return 'Recharge/Bills';
  if (/transfer|neft|imps|self/.test(s)) return 'Transfer/Sent';
  return 'Other';
}

function buildNarration(body: string, direction: SmsDirection, amount: number, upiRef: string | null): string {
  // Prefer the UPI/counterparty fragment; else first meaningful line.
  const upiFrag = body.match(/UPI\/([^\/\n]{1,60})/i)?.[1]?.trim();
  const toFrag = body.match(/to\s+([A-Za-z0-9 ._\-@]{3,40})/i)?.[1]?.trim();
  const base =
    upiFrag && upiFrag.length >= 3
      ? `UPI ${direction === 'CREDIT' ? 'from' : 'to'} ${upiFrag}`
      : toFrag
        ? `${direction === 'CREDIT' ? 'Received from' : 'Paid to'} ${toFrag}`
        : `${direction === 'CREDIT' ? 'Credit' : 'Debit'} Rs.${amount}`;
  const withRef = upiRef ? `${base} (Ref ${upiRef.slice(0, 12)})` : base;
  return withRef.slice(0, 200);
}

export function parseSms(
  sender: string,
  body: string,
  receivedAt?: Date,
): ParsedSms | null {
  if (!body || body.trim().length < 10) return null;

  const amount = extractAmount(body);
  if (amount === null) return null;

  const direction = extractDirection(body);
  const upiRef = extractUpiRef(body);
  const accountTail = extractAccountTail(body);
  const balance = extractBalance(body);
  const bank = guessBank(sender, body);
  const smsDate = extractDateInSms(body);
  const date = smsDate ?? receivedAt ?? new Date();
  const dateKey = toIstDateKey(date instanceof Date ? date : new Date(date));
  const narration = buildNarration(body, direction, amount, upiRef);
  const categoryGuess = guessCategory(body, narration);

  // Confidence: amount + direction + (bank known or ref/tail present)
  const signals = [
    direction !== 'UNKNOWN',
    bank !== 'UNKNOWN',
    upiRef !== null,
    accountTail !== null,
    smsDate !== null,
  ].filter(Boolean).length;
  const confidence = signals >= 3 ? 'high' : signals === 2 ? 'medium' : 'low';

  return {
    direction,
    amount,
    date: date instanceof Date ? date : new Date(date),
    dateKey,
    narration,
    upiRef,
    accountTail,
    balance,
    bank,
    categoryGuess,
    confidence,
    rawExcerpt: body.slice(0, 200),
  };
}
