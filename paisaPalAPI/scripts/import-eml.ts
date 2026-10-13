/**
 * One-off importer: posts .eml receipt files (e.g. Rapido invoices saved from
 * Gmail) to the ingest API. Used for history backfill and for verifying real
 * mail against the endpoints without depending on the iPhone automations.
 *
 * Usage (run from paisaPalAPI/):
 *   SMS_INGEST_SECRET=<secret> npx ts-node --transpile-only scripts/import-eml.ts [--dry-run] [--url <base>] <file.eml> [...]
 *
 * --url defaults to $INGEST_URL, else http://localhost:3001 (local dev).
 *   For production: --url https://<your-app>.vercel.app
 * --dry-run parses + prints only; nothing is POSTed.
 *
 * The secret is read from $SMS_INGEST_SECRET only — never put it in chat/logs.
 * Dependency-free (stdlib only); the server does HTML stripping + parsing.
 */

import fs from 'node:fs';

type ParsedEml = { subject: string; body: string; part: string };

function unfoldHeaders(raw: string): string {
  return raw.replace(/\r?\n[ \t]+/g, ' ');
}

function splitHeaderBody(chunk: string): { headers: string; body: string } {
  const idx = chunk.search(/\r?\n\r?\n/);
  if (idx < 0) return { headers: chunk, body: '' };
  const sep = chunk[idx] === '\r' ? '\r\n\r\n' : '\n\n';
  return { headers: chunk.slice(0, idx), body: chunk.slice(idx + sep.length) };
}

function qpDecode(s: string): string {
  const noSoft = s.replace(/=\r?\n/g, '');
  return noSoft.replace(/(=[0-9A-Fa-f]{2})+/g, (run) => {
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
}

function parseEml(raw: string): ParsedEml {
  const unfolded = unfoldHeaders(raw);
  const top = splitHeaderBody(unfolded);
  const subject = (top.headers.match(/^subject:(.*)$/im)?.[1] ?? '(no subject)').trim();

  const boundary =
    top.headers.match(/boundary="([^"]+)"/i)?.[1] ?? top.headers.match(/boundary=([^\s;]+)/i)?.[1];

  // Non-multipart: whole body is the content.
  if (!boundary) {
    const enc = top.headers.match(/content-transfer-encoding:\s*([^\s;]+)/i)?.[1]?.toLowerCase();
    const text = enc === 'quoted-printable' ? qpDecode(top.body) : top.body;
    return { subject, body: text.trim(), part: 'singlepart' };
  }

  // Multipart: prefer text/plain, else text/html, skip attachments.
  let plain = '';
  let html = '';
  const chunks = top.body.split(`--${boundary}`);
  for (const chunk of chunks) {
    const { headers, body } = splitHeaderBody(chunk);
    const ct = (headers.match(/content-type:\s*([^\s;]+)/i)?.[1] ?? '').toLowerCase();
    if (headers.includes('attachment')) continue;
    const enc = headers.match(/content-transfer-encoding:\s*([^\s;]+)/i)?.[1]?.toLowerCase();
    const decoded = enc === 'quoted-printable' ? qpDecode(body) : body;
    if (ct === 'text/plain' && !plain) plain = decoded;
    else if (ct === 'text/html' && !html) html = decoded;
  }
  if (plain.trim()) return { subject, body: plain.trim(), part: 'text/plain' };
  return { subject, body: html.trim(), part: 'text/html' };
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run');
  const urlIdx = argv.indexOf('--url');
  const base =
    (urlIdx >= 0 ? argv[urlIdx + 1] : undefined)?.replace(/\/$/, '') ||
    (process.env.INGEST_URL ?? '').replace(/\/$/, '') ||
    'http://localhost:3001';
  const files = argv.filter((a) => !a.startsWith('--') && a !== argv[urlIdx + 1]);

  if (files.length === 0) {
    console.error('Usage: import-eml.ts [--dry-run] [--url <base>] <file.eml> [...]');
    process.exit(1);
  }

  const secret = process.env.SMS_INGEST_SECRET ?? '';
  if (!secret && !dryRun) {
    console.error('SMS_INGEST_SECRET is required (except with --dry-run).');
    process.exit(1);
  }

  for (const file of files) {
    const raw = fs.readFileSync(file, 'utf8');
    const { subject, body, part } = parseEml(raw);
    const capped = body.length > 59000 ? body.slice(0, 59000) : body;
    console.log(`--- ${file}`);
    console.log(`subject: ${subject}`);
    console.log(`part: ${part}, body chars: ${body.length}${capped.length !== body.length ? ` (capped to ${capped.length})` : ''}`);
    console.log(`preview: ${capped.slice(0, 200).replace(/\s+/g, ' ')}`);

    if (dryRun) continue;

    const res = await fetch(`${base}/api/ingest/rapido`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-ingest-secret': secret },
      body: JSON.stringify({ subject, body: capped }),
    });
    const json = (await res.json().catch(() => ({ raw: 'non-JSON response' }))) as Record<
      string,
      unknown
    >;
    const data = json.data as Record<string, unknown> | undefined;
    console.log(`-> ${res.status} ${(data?.status as string) ?? json.error ?? ''}`);
    if (data?.parsed) console.log(`   parsed: ${JSON.stringify(data.parsed).slice(0, 300)}`);
    if (json.error) console.log(`   error: ${JSON.stringify(json).slice(0, 500)}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
