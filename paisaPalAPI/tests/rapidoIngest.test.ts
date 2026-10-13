import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Application } from 'express';

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
