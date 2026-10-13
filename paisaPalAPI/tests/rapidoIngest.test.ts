import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Application } from 'express';

import { parseRapidoEmail } from '@/lib/rapidoParser';
import RapidoReceipt from '@/models/RapidoReceipt';
import Transaction from '@/models/Transaction';
import {
  clearDatabase,
  createTestUser,
  startInMemoryMongo,
  stopInMemoryMongo,
  TEST_USER_ID,
} from './testUtils';

const INGEST_SECRET = 'test-ingest-secret-16-chars-min';

let app: Application;

describe('POST /api/ingest/rapido', () => {
  beforeAll(async () => {
    process.env.SMS_INGEST_SECRET = INGEST_SECRET;
    process.env.SMS_INGEST_USER_ID = TEST_USER_ID;
    await startInMemoryMongo();
    process.env.SMS_INGEST_SECRET = INGEST_SECRET;
    process.env.SMS_INGEST_USER_ID = TEST_USER_ID;
    const mod = await import('@/index');
    app = mod.default;
  });

  beforeEach(async () => {
    await clearDatabase();
    await createTestUser();
    process.env.SMS_INGEST_SECRET = INGEST_SECRET;
    process.env.SMS_INGEST_USER_ID = TEST_USER_ID;
  });

  afterAll(async () => {
    await stopInMemoryMongo();
  });

  it('401 without secret', async () => {
    const res = await request(app).post('/api/ingest/rapido').send({
      subject: 'Your Rapido receipt',
      body: 'Rapido ride. Total fare Rs.65. Payment mode Cash.',
    });
    expect(res.status).toBe(401);
  });

  it('stores receipt as pending_bank when no bank debit exists yet', async () => {
    const res = await request(app)
      .post('/api/ingest/rapido')
      .set('x-ingest-secret', INGEST_SECRET)
      .send({
        subject: 'Your Rapido ride receipt #RPD123456',
        body: 'Rapido trip on 08-Oct-2026. Pickup: HSR Layout. Drop: Koramangala. Total fare Rs.65. Payment mode: Cash.',
      });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('pending_bank');
    expect(res.body.data.parsed.rapidoAmount).toBe(65);
    expect(await Transaction.countDocuments({})).toBe(0);
    expect(await RapidoReceipt.countDocuments({})).toBe(1);
  });

  it('links receipt to bank debit with variance (bank wins)', async () => {
    // Bank SMS arrived first: driver took 66, receipt says 65.
    await Transaction.create({
      userId: TEST_USER_ID,
      date: new Date(Date.UTC(2026, 9, 8, 6, 30, 0)),
      dateKey: '2026-10-08',
      particulars: 'UPI to RAPIDO DRIVER',
      amount: 66,
      category: 'Other',
      modes: ['Online'],
      notes: '[SMS]',
    });

    const res = await request(app)
      .post('/api/ingest/rapido')
      .set('x-ingest-secret', INGEST_SECRET)
      .send({
        subject: 'Your Rapido ride receipt #RPD123456',
        body: 'Rapido trip on 08-Oct-2026. Total fare Rs.65. Payment mode: Cash. Receipt ID: RPD123456.',
      });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('linked');
    expect(res.body.data.variance).toBe(1);

    const tx = await Transaction.findOne({ userId: TEST_USER_ID }).lean();
    expect(tx?.category).toBe('Rapido');
    expect(tx?.amount).toBe(66); // bank truth untouched
    expect(tx?.notes).toContain('receipt claimed Cash');
  });

  it('dedups same receipt on replay', async () => {
    const payload = {
      subject: 'Your Rapido receipt #DUP1',
      body: 'Rapido trip on 08-Oct-2026. Total fare Rs.80. Payment mode: UPI.',
    };
    const first = await request(app)
      .post('/api/ingest/rapido')
      .set('x-ingest-secret', INGEST_SECRET)
      .send(payload);
    expect(first.status).toBe(201);
    const second = await request(app)
      .post('/api/ingest/rapido')
      .set('x-ingest-secret', INGEST_SECRET)
      .send(payload);
    expect(second.status).toBe(200);
    expect(second.body.data.status).toBe('duplicate');
    expect(await RapidoReceipt.countDocuments({})).toBe(1);
  });
});

describe('real Rapido invoice templates (sanitized, Oct 2026)', () => {
  beforeAll(async () => {
    process.env.SMS_INGEST_SECRET = INGEST_SECRET;
    process.env.SMS_INGEST_USER_ID = TEST_USER_ID;
    await startInMemoryMongo();
    process.env.SMS_INGEST_SECRET = INGEST_SECRET;
    process.env.SMS_INGEST_USER_ID = TEST_USER_ID;
    if (!app) {
      const mod = await import('@/index');
      app = mod.default;
    }
  });

  beforeEach(async () => {
    await clearDatabase();
    await createTestUser();
    process.env.SMS_INGEST_SECRET = INGEST_SECRET;
    process.env.SMS_INGEST_USER_ID = TEST_USER_ID;
  });

  afterAll(async () => {
    await stopInMemoryMongo();
  });

  // Sanitized excerpt of Invoice-1: keeps the tricky encodings (QP rupee sign,
  // soft-broken Ride ID, tags between label and value, ordinal date) while
  // redacting real pickup/drop addresses.
  const INVOICE_QR_PAY = [
    '<div class=3D"content payment-header">Payment Summary</div>',
    '<img src=3D"https://cust-rapido-images.s3.ap-south-1.am=azonaws.com/rapido-logo.png">',
    '<div class=3D"rider-label">Ride ID</div>',
    '<div class=3D"rider-label align-right">RD17918988593214=',
    '218</div>',
    '<div class=3D"rider-value">Time of Ride</div>',
    '<div class=3D"rider-value align-right">Oct 13th 2026, 7:20 PM</div>',
    '<div class=3D"content success-message">Total</div>',
    '<div class=3D"content ride-cost">=E2=82=B9 54.00</div>',
    '<div class=3D"content bill-data">Ride Charge</div>',
    '<div class=3D"content align-right bill-data">=E2=82=B9 45.11</div>',
    '<div class=3D"content bill-data">Booking Fees & Convenience Charges</div>',
    '<div class=3D"content align-right bill-data">=E2=82=B9 8.89</div>',
    '<div class=3D"content bill-data total">Total Amount</div>',
    '<div class=3D"content align-right bill-data total">=E2=82=B9 54.00</div>',
    '<div class=3D"content payment-mode-header">You Paid Using </div>',
    '<div class =3D "content bill-data payment"> QR Pay</div>',
    '<div class =3D "content align-right bill-data">=E2=82=B9 54.00</div>',
    '<div class=3D"content location"> Area A, City 380001, India </div>',
    '<div class=3D"content location"> Area B, City 380001, India </div>',
  ].join('\n');

  // Sanitized excerpt of Invoice-2 (Cash claim, morning ride, same day).
  const INVOICE_CASH = [
    '<div class=3D"rider-label">Ride ID</div>',
    '<div class=3D"rider-label align-right">RD17918595849181986</div>',
    '<div class=3D"rider-value">Time of Ride</div>',
    '<div class=3D"rider-value align-right">Oct 13th 2026, 8:31 AM</div>',
    '<div class=3D"content success-message">Total</div>',
    '<div class=3D"content ride-cost">=E2=82=B9 34.00</div>',
    '<div class=3D"content bill-data">Ride Charge</div>',
    '<div class=3D"content align-right bill-data">=E2=82=B9 32.82</div>',
    '<div class=3D"content bill-data">Booking Fees & Convenience Charges</div>',
    '<div class=3D"content align-right bill-data">=E2=82=B9 1.18</div>',
    '<div class=3D"content bill-data total">Total Amount</div>',
    '<div class=3D"content align-right bill-data total">=E2=82=B9 34.00</div>',
    '<div class=3D"content payment-mode-header">You Paid Using </div>',
    '<div class =3D "content bill-data payment"> Cash</div>',
    '<div class =3D "content align-right bill-data">=E2=82=B9 34.00</div>',
    '<img src=3D"https://cust-rapido-images.s3.ap-south-1.amazonaws.com/rapido-logo.png">',
  ].join('\n');

  it('parses the QR Pay invoice: 54.00, ride ID rejoined, Oct 13, Online claim', async () => {
    const res = await request(app)
      .post('/api/ingest/rapido')
      .set('x-ingest-secret', INGEST_SECRET)
      .send({ subject: 'Rapido Invoice', body: INVOICE_QR_PAY });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('pending_bank');
    const parsed = res.body.data.parsed;
    expect(parsed.rapidoAmount).toBe(54);
    expect(parsed.receiptId).toBe('RD17918988593214218');
    expect(parsed.dateKey).toBe('2026-10-13');
    expect(parsed.claimedMode).toBe('Online');
    expect(parsed.confidence).toBe('high');
  });

  it('parses the Cash invoice: 34.00, morning ride, Cash claim kept verbatim', async () => {
    const res = await request(app)
      .post('/api/ingest/rapido')
      .set('x-ingest-secret', INGEST_SECRET)
      .send({ subject: 'Rapido Invoice', body: INVOICE_CASH });
    expect(res.status).toBe(201);
    const parsed = res.body.data.parsed;
    expect(parsed.rapidoAmount).toBe(34);
    expect(parsed.receiptId).toBe('RD17918595849181986');
    expect(parsed.dateKey).toBe('2026-10-13');
    expect(parsed.claimedMode).toBe('Cash');
  });

  it('links the QR Pay invoice to its bank debit with zero variance', async () => {
    await Transaction.create({
      userId: TEST_USER_ID,
      date: new Date(Date.UTC(2026, 9, 13, 13, 50, 0)),
      dateKey: '2026-10-13',
      particulars: 'UPI to RAPIDO',
      amount: 54,
      category: 'Other',
      modes: ['Online'],
      notes: '[SMS]',
    });

    const res = await request(app)
      .post('/api/ingest/rapido')
      .set('x-ingest-secret', INGEST_SECRET)
      .send({ subject: 'Rapido Invoice', body: INVOICE_QR_PAY });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('linked');
    expect(res.body.data.variance).toBe(0);

    const tx = await Transaction.findOne({ userId: TEST_USER_ID }).lean();
    expect(tx?.category).toBe('Rapido');
    expect(tx?.amount).toBe(54);
    expect(tx?.notes).toContain('receipt claimed Online');
  });

  it('accepts full-size HTML mail (~20KB): parses fields, stores stripped text only', async () => {
    const padding = `<div class="pad">${'x'.repeat(15000)}</div>`;
    const bigHtml = `<html><head><style>${'y'.repeat(4000)}</style></head><body>${padding}${INVOICE_QR_PAY}</body></html>`;
    expect(bigHtml.length).toBeGreaterThan(15000);

    const res = await request(app)
      .post('/api/ingest/rapido')
      .set('x-ingest-secret', INGEST_SECRET)
      .send({ subject: 'Rapido Invoice', body: bigHtml });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('pending_bank');
    expect(res.body.data.parsed.rapidoAmount).toBe(54);
    expect(res.body.data.parsed.receiptId).toBe('RD17918988593214218');

    const row = await RapidoReceipt.findOne({ userId: TEST_USER_ID }).lean();
    expect(row).toBeTruthy();
    expect(row?.body.length).toBeLessThanOrEqual(8000);
    expect(row?.body).not.toContain('<div');
  });
});

describe('rapido invoice PDF path', () => {
  beforeAll(async () => {
    process.env.SMS_INGEST_SECRET = INGEST_SECRET;
    process.env.SMS_INGEST_USER_ID = TEST_USER_ID;
    await startInMemoryMongo();
    process.env.SMS_INGEST_SECRET = INGEST_SECRET;
    process.env.SMS_INGEST_USER_ID = TEST_USER_ID;
    if (!app) {
      const mod = await import('@/index');
      app = mod.default;
    }
  });

  beforeEach(async () => {
    await clearDatabase();
    await createTestUser();
    process.env.SMS_INGEST_SECRET = INGEST_SECRET;
    process.env.SMS_INGEST_USER_ID = TEST_USER_ID;
  });

  afterAll(async () => {
    await stopInMemoryMongo();
  });

  // Sanitized shape of the real invoice-PDF text extraction (names, addresses,
  // vehicle/GST numbers replaced; ride ID, amounts, dates, modes verbatim).
  const PDF_TEXT = [
    'RD17918595849181986',
    'Oct 13th 2026, 8:31 AM',
    '3.37 kms',
    'DISTANCE',
    '9.05 mins',
    'DURATION',
    '₹ 32.82',
    '₹ 1.18',
    '₹ 34.00',
    '₹ 34.00',
    'Payment Summary',
    'Ride ID',
    'Time of Ride',
    'Total',
    '₹ 34.00',
    'Area A, City 380001, India',
    'Bill Details',
    'Ride Charge',
    'Booking Fees & Convenience Charges',
    'Total Amount',
    '(Inclusive of Taxes)',
    'You Paid Using',
    'Cash',
    'Area B, City 380001, India',
    'Tax Invoice',
    'RD17918595849181986',
    'Invoice No.',
    'INVNUMBER01',
    'Captain Name',
    'Person A',
    'Customer Name',
    'Person B',
    'Rapido',
  ].join('\n');

  it('parses PDF-extracted text like the email path', () => {
    const parsed = parseRapidoEmail('Rapido Invoice', PDF_TEXT);
    expect(parsed).not.toBeNull();
    expect(parsed?.rapidoAmount).toBe(34);
    expect(parsed?.receiptId).toBe('RD17918595849181986');
    expect(parsed?.dateKey).toBe('2026-10-13');
    expect(parsed?.claimedMode).toBe('Cash');
    expect(parsed?.confidence).toBe('high');
  });

  /** Minimal one-page PDF with computed xref (no PII, no fixtures on disk). */
  function buildMiniInvoicePdf(line: string): string {
    const esc = line.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
    const stream = `BT /F1 12 Tf 10 100 Td (${esc}) Tj ET`;
    const head = '%PDF-1.4\n';
    const objs = [
      '1 0 obj\n<</Type/Catalog/Pages 2 0 R>>\nendobj\n',
      '2 0 obj\n<</Type/Pages/Kids [3 0 R]/Count 1>>\nendobj\n',
      '3 0 obj\n<</Type/Page/Parent 2 0 R/MediaBox [0 0 1400 144]/Contents 4 0 R/Resources <</Font <</F1 5 0 R>>>>>>\nendobj\n',
      `4 0 obj\n<</Length ${Buffer.byteLength(stream)}>>\nstream\n${stream}\nendstream\nendobj\n`,
      '5 0 obj\n<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>\nendobj\n',
    ];
    let offset = Buffer.byteLength(head);
    const offsets: number[] = [0];
    for (const o of objs) {
      offsets.push(offset);
      offset += Buffer.byteLength(o);
    }
    let xref = 'xref\n0 6\n0000000000 65535 f \n';
    for (let i = 1; i <= 5; i += 1) {
      xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
    }
    const pdf = head + objs.join('') + xref + `trailer\n<</Size 6/Root 1 0 R>>\nstartxref\n${offset}\n%%EOF`;
    return Buffer.from(pdf, 'latin1').toString('base64');
  }

  const MINI_LINE =
    'Ride ID RD17918595849181986 Time of Ride Oct 13th 2026, 8:31 AM ' +
    'Total Rs. 34.00 You Paid Using Cash Rapido';

  it('401 without secret', async () => {
    const res = await request(app).post('/api/ingest/rapido-pdf').send({
      subject: 'Rapido Invoice',
      pdfBase64: buildMiniInvoicePdf(MINI_LINE),
    });
    expect(res.status).toBe(401);
  });

  it('400 on non-base64 payload', async () => {
    const res = await request(app)
      .post('/api/ingest/rapido-pdf')
      .set('x-ingest-secret', INGEST_SECRET)
      // Long enough to pass Zod's min(100) so the controller's own check fires.
      .send({ subject: 'Rapido Invoice', pdfBase64: `!!!${'x'.repeat(150)}!!!` });
    expect(res.status).toBe(400);
    expect(res.body.errorCode).toBe('PDF_INVALID');
  });

  it('links a PDF invoice to its bank debit', async () => {
    await Transaction.create({
      userId: TEST_USER_ID,
      date: new Date(Date.UTC(2026, 9, 13, 6, 30, 0)),
      dateKey: '2026-10-13',
      particulars: 'UPI to RAPIDO',
      amount: 34,
      category: 'Other',
      modes: ['Online'],
      notes: '[SMS]',
    });

    const first = await request(app)
      .post('/api/ingest/rapido-pdf')
      .set('x-ingest-secret', INGEST_SECRET)
      .send({ subject: 'Rapido Invoice', pdfBase64: buildMiniInvoicePdf(MINI_LINE) });
    expect(first.status).toBe(201);
    expect(first.body.data.status).toBe('linked');
    expect(first.body.data.variance).toBe(0);
    expect(first.body.data.parsed.receiptId).toBe('RD17918595849181986');
    expect(first.body.data.parsed.claimedMode).toBe('Cash');

    const tx = await Transaction.findOne({ userId: TEST_USER_ID }).lean();
    expect(tx?.category).toBe('Rapido');
    expect(tx?.notes).toContain('receipt claimed Cash');

    const second = await request(app)
      .post('/api/ingest/rapido-pdf')
      .set('x-ingest-secret', INGEST_SECRET)
      .send({ subject: 'Rapido Invoice', pdfBase64: buildMiniInvoicePdf(MINI_LINE) });
    expect(second.status).toBe(200);
    expect(second.body.data.status).toBe('duplicate');
  });
});
