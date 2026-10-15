import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Application } from 'express';
import { Types } from 'mongoose';

import AppReceipt from '@/models/AppReceipt';
import RapidoReceipt from '@/models/RapidoReceipt';
import Transaction from '@/models/Transaction';
import { authHeaders, clearDatabase, createTestUser, generateTestToken, startInMemoryMongo, stopInMemoryMongo, TEST_USER_ID } from './testUtils';

let app: Application;

describe('ingest review inbox', () => {
  beforeAll(async () => { await startInMemoryMongo(); app = (await import('@/index')).default; });
  beforeEach(async () => { await clearDatabase(); await createTestUser(); });
  afterAll(async () => { await stopInMemoryMongo(); });

  async function receipt(overrides: Record<string, unknown> = {}) {
    return RapidoReceipt.create({ userId: TEST_USER_ID, receiptHash: new Types.ObjectId().toString(), subject: 'Rapido invoice', body: 'ride', rideDateKey: '2026-10-13', rapidoAmount: 54, claimedMode: 'Cash', receiptId: 'RD123', linkedTransactionId: null, variance: null, status: 'pending_bank', parseError: null, ...overrides });
  }

  it('requires JWT and lists only the signed-in user actionable rows', async () => {
    await receipt();
    await AppReceipt.create({ userId: new Types.ObjectId(), receiptHash: 'other', app: 'AMAZON', subject: 'Other', body: 'x', orderDateKey: '2026-10-13', amount: 99, orderId: null, linkedTransactionId: null, variance: null, status: 'pending_bank', parseError: null });
    expect((await request(app).get('/api/ingest/inbox')).status).toBe(401);
    const res = await request(app).get('/api/ingest/inbox?status=actionable').set(authHeaders());
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(1);
    expect(res.body.data.items[0].kind).toBe('rapido');
  });

  it('links a receipt, annotates the bank debit, and promotes Other to Rapido', async () => {
    const row = await receipt();
    const tx = await Transaction.create({ userId: TEST_USER_ID, date: new Date('2026-10-13T00:00:00.000Z'), dateKey: '2026-10-13', particulars: 'UPI debit', amount: 58, category: 'Other', modes: ['Online'], notes: '' });
    const res = await request(app).post(`/api/ingest/inbox/rapido/${row._id}/approve`).set(authHeaders()).send({ action: 'link', transactionId: tx._id.toString() });
    expect(res.status).toBe(200);
    expect(res.body.data.item.variance).toBe(4);
    const updated = await Transaction.findById(tx._id).lean();
    expect(updated?.category).toBe('Rapido');
    expect(updated?.notes).toContain('Rapido receipt');
  });

  it('creates and links a cash transaction, while dismissal retains a row', async () => {
    const row = await receipt();
    const create = await request(app).post(`/api/ingest/inbox/rapido/${row._id}/approve`).set(authHeaders()).send({ action: 'create' });
    expect(create.status).toBe(201);
    expect(create.body.data.transaction.modes).toEqual(['Cash']);
    const promo = await receipt({ receiptHash: 'dismissable', status: 'needs_review' });
    const dismiss = await request(app).post(`/api/ingest/inbox/rapido/${promo._id}/approve`).set(authHeaders()).send({ action: 'dismiss' });
    expect(dismiss.status).toBe(200);
    expect(await RapidoReceipt.countDocuments({ _id: promo._id, status: 'dismissed' })).toBe(1);
  });

  it('returns 404 for a row owned by another user', async () => {
    const other = await receipt({ userId: new Types.ObjectId(), receiptHash: 'other-user' });
    const res = await request(app).post(`/api/ingest/inbox/rapido/${other._id}/approve`).set(authHeaders(generateTestToken())).send({ action: 'dismiss' });
    expect(res.status).toBe(404);
    expect(res.body.errorCode).toBe('INBOX_NOT_FOUND');
  });
});
