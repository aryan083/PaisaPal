import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Application } from 'express';

import AppReceipt from '@/models/AppReceipt';
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

describe('POST /api/ingest/receipt', () => {
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
    const res = await request(app).post('/api/ingest/receipt').send({
      subject: 'Your Amazon.in order',
      body: 'Order total Rs.499.',
    });
    expect(res.status).toBe(401);
  });

  it('creates a transaction directly from a parsed Swiggy receipt', async () => {
    const res = await request(app)
      .post('/api/ingest/receipt')
      .set('x-ingest-secret', INGEST_SECRET)
      .send({
        app: 'SWIGGY',
        subject: 'Your Swiggy order receipt',
        body: 'Swiggy order on 08-Oct-2026. Order total Rs.299. Order ID SW123456.',
      });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('linked');
    expect(res.body.data.parsed.app).toBe('SWIGGY');
    expect(res.body.data.parsed.amount).toBe(299);
    expect(await Transaction.countDocuments({})).toBe(1);
  });

  it('links Amazon receipt to exact bank debit and sets Shopping', async () => {
    await Transaction.create({
      userId: TEST_USER_ID,
      date: new Date(Date.UTC(2026, 9, 8, 6, 30, 0)),
      dateKey: '2026-10-08',
      particulars: 'UPI to AMAZON',
      amount: 499,
      category: 'Other',
      modes: ['Online'],
      notes: '[SMS]',
    });

    const res = await request(app)
      .post('/api/ingest/receipt')
      .set('x-ingest-secret', INGEST_SECRET)
      .send({
        subject: 'Your Amazon.in order #402-1234567-1234567',
        body: 'Amazon order placed 08-Oct-2026. Grand total Rs.499. Invoice attached.',
      });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('linked');
    expect(res.body.data.parsed.app).toBe('AMAZON');
    expect(res.body.data.variance).toBe(0);

    const tx = await Transaction.findOne({ userId: TEST_USER_ID }).lean();
    expect(tx?.category).toBe('Shopping');
    expect(tx?.notes).toContain('AMAZON');
  });

  it('creates a receipt transaction when no bank debit is within tolerance', async () => {
    await Transaction.create({
      userId: TEST_USER_ID,
      date: new Date(Date.UTC(2026, 9, 8, 6, 30, 0)),
      dateKey: '2026-10-08',
      particulars: 'UPI to FLIPKART',
      amount: 1200,
      category: 'Other',
      modes: ['Online'],
      notes: '',
    });

    const res = await request(app)
      .post('/api/ingest/receipt')
      .set('x-ingest-secret', INGEST_SECRET)
      .send({
        subject: 'Your Flipkart order',
        body: 'Flipkart order total Rs.999. Order ID OD123.',
      });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('linked');
    expect(await Transaction.countDocuments({})).toBe(2);
  });

  it('quarantines promo emails without amounts', async () => {
    const res = await request(app)
      .post('/api/ingest/receipt')
      .set('x-ingest-secret', INGEST_SECRET)
      .send({
        subject: 'Big Diwali Sale is LIVE!',
        body: 'Hurry, best deals on top brands today only, up to 80 percent off on select items now.',
      });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('needs_review');
    expect(await AppReceipt.countDocuments({ status: 'needs_review' })).toBe(1);
  });

  it('accepts full-size HTML mail (~18KB): parses fields, stores stripped text only', async () => {
    const bigHtml = [
      '<html><head><style>',
      'z'.repeat(12000),
      '</style></head><body>',
      '<div>Thank you for shopping with Amazon.in</div>',
      '<div>Order ID 402-1234567-1234567 placed on 08-Oct-2026</div>',
      '<div>Grand total Rs.499</div>',
      `<div>${'w'.repeat(4000)}</div>`,
      '</body></html>',
    ].join('\n');
    expect(bigHtml.length).toBeGreaterThan(15000);

    const res = await request(app)
      .post('/api/ingest/receipt')
      .set('x-ingest-secret', INGEST_SECRET)
      .send({ subject: 'Your Amazon.in order #402-1234567-1234567', body: bigHtml });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('linked');
    expect(res.body.data.parsed.app).toBe('AMAZON');
    expect(res.body.data.parsed.amount).toBe(499);

    const row = await AppReceipt.findOne({ userId: TEST_USER_ID }).lean();
    expect(row).toBeTruthy();
    expect(row?.body.length).toBeLessThanOrEqual(8000);
    expect(row?.body).not.toContain('<div');
  });
});
