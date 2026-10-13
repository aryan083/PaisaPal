/**
 * Shared HTML/quoted-printable → plain-text normalizer for email ingest
 * (Rapido invoices, shopping-app receipts).
 *
 * Real-world mail arrives as HTML (often quoted-printable encoded): tags sit
 * between labels and values, the ₹ sign arrives as =E2=82=B9, and long lines
 * are split with soft breaks (=\\n) — including inside IDs. Normalizing first
 * keeps every downstream regex simple and makes dedup hashes
 * encoding-insensitive (same invoice as HTML vs text hashes identically).
 */
export function stripToText(raw: string): string {
  const noSoftBreaks = raw.replace(/=\r?\n/g, '');
  const decodedQP = noSoftBreaks.replace(/(=[0-9A-Fa-f]{2})+/g, (run) => {
    const bytes = run
      .split('=')
      .filter((h) => h.length > 0)
      .map((h) => parseInt(h, 16))
      .filter((n) => Number.isFinite(n));
    if (bytes.length === 0) return run;
    try {
      return Buffer.from(bytes).toString('utf8');
    } catch {
      return run;
    }
  });
  const noTags = decodedQP.replace(/<[^>]*>/g, ' ');
  const entities = noTags
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_m, code: string) => {
      const n = Number(code);
      return Number.isFinite(n) ? String.fromCharCode(n) : _m;
    });
  return entities.replace(/\s+/g, ' ').trim();
}
