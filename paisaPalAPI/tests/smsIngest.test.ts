import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Application } from 'express';

import SmsInbox from '@/models/SmsInbox';
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

describe('POST /api/ingest/sms', () => {
  beforeAll(async () => {
    process.env.SMS_INGEST_SECRET = INGEST_SECRET;
    process.env.SMS_INGEST_USER_ID = TEST_USER_ID;
    await startInMemoryMongo();
    // startInMemoryMongo overwrites some env vars — restore ingest config after.
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
    const res = await request(app).post('/api/ingest/sms').send({
      sender: 'BOBTXN',
      body: 'Rs.500 debited from A/c XX1234 on 08-Oct-26',
    });
    expect(res.status).toBe(401);
    expect(res.body.errorCode).toBe('INGEST_UNAUTHORIZED');
  });

  it('posts a BOB debit SMS as a Transaction', async () => {
    const res = await request(app)
      .post('/api/ingest/sms')
      .set('x-ingest-secret', INGEST_SECRET)
      .send({
        sender: 'BOBTXN',
        body: 'Rs.320 debited from A/c XX4821 on 08-Oct-26 towards UPI/rapido/123456789012. Avl Bal Rs.12500.50',
      });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('posted');
    expect(res.body.data.parsed.amount).toBe(320);
    expect(res.body.data.parsed.direction).toBe('DEBIT');
    expect(res.body.data.parsed.bank).toBe('BOB');
    expect(res.body.data.transactionId).toBeTruthy();

    const txCount = await Transaction.countDocuments({});
    expect(txCount).toBe(1);
    const inboxCount = await SmsInbox.countDocuments({});
    expect(inboxCount).toBe(1);
  });

  it('dedups the same SMS body on replay', async () => {
    const payload = {
      sender: 'KOTAKB',
      body: 'INR 2,000 credited to A/c XX9911 on 08-Oct-2026. Ref No 987654321098.',
    };
    const first = await request(app)
      .post('/api/ingest/sms')
      .set('x-ingest-secret', INGEST_SECRET)
      .send(payload);
    expect(first.status).toBe(201);

    const second = await request(app)
      .post('/api/ingest/sms')
      .set('x-ingest-secret', INGEST_SECRET)
      .send(payload);
    expect(second.status).toBe(200);
    expect(second.body.data.status).toBe('duplicate');

    expect(await Transaction.countDocuments({})).toBe(1);
    expect(await SmsInbox.countDocuments({})).toBe(1);
  });

  it('quarantines unparseable SMS instead of failing', async () => {
    const res = await request(app)
      .post('/api/ingest/sms')
      .set('x-ingest-secret', INGEST_SECRET)
      .send({ sender: 'BOBTXN', body: 'Your OTP is 482913. Do not share it with anyone.' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('needs_review');
    expect(await Transaction.countDocuments({})).toBe(0);
    expect(await SmsInbox.countDocuments({ status: 'needs_review' })).toBe(1);
  });

  it('400 on invalid body', async () => {
    const res = await request(app)
      .post('/api/ingest/sms')
      .set('x-ingest-secret', INGEST_SECRET)
      .send({ sender: '', body: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.errorCode).toBe('VALIDATION_FAILED');
  });
});
