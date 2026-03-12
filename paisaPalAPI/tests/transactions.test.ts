import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Application } from 'express';

import Transaction from '@/models/Transaction';
import {
  authHeaders,
  clearDatabase,
  createTestUser,
  generateTestToken,
  startInMemoryMongo,
  stopInMemoryMongo,
  TEST_USER_ID,
} from './testUtils';

let app: Application;
let token: string;

describe('transactions API', () => {
  beforeAll(async () => {
    await startInMemoryMongo();
    const mod = await import('@/index');
    app = mod.default;
  });

  beforeEach(async () => {
    await clearDatabase();
    await createTestUser();
    token = generateTestToken();
  });

  afterAll(async () => {
    await stopInMemoryMongo();
  });

  it('lists all transactions', async () => {
    await Transaction.create({
      date: new Date('2026-03-01'),
      particulars: 'Coffee',
      amount: 20,
      category: 'Food & Drinks',
      mode: 'Cash',
      notes: '',
      userId: TEST_USER_ID,
    });

    const res = await request(app)
      .get('/api/transactions')
      .set(authHeaders(token));
    expect(res.status).toBe(200);
    expect(res.body.error).toBeNull();
    expect(res.body.data.total).toBe(1);
    expect(res.body.data.transactions).toHaveLength(1);
  });

  it('lists with search filter', async () => {
    await Transaction.create({
      date: new Date('2026-03-01'),
      particulars: 'Coffee',
      amount: 20,
      category: 'Food & Drinks',
      mode: 'Cash',
      notes: 'nice',
      userId: TEST_USER_ID,
    });
    await Transaction.create({
      date: new Date('2026-03-01'),
      particulars: 'Bus ticket',
      amount: 50,
      category: 'Bus/GSRTC',
      mode: 'Online',
      notes: '',
      userId: TEST_USER_ID,
    });

    const res = await request(app)
      .get('/api/transactions')
      .query({ search: 'cof' })
      .set(authHeaders(token));
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(1);
    expect(res.body.data.transactions[0].particulars).toBe('Coffee');
  });

  it('lists with category filter', async () => {
    await Transaction.create({
      date: new Date('2026-03-01'),
      particulars: 'Coffee',
      amount: 20,
      category: 'Food & Drinks',
      mode: 'Cash',
      notes: '',
      userId: TEST_USER_ID,
    });
    await Transaction.create({
      date: new Date('2026-03-01'),
      particulars: 'Bus ticket',
      amount: 50,
      category: 'Bus/GSRTC',
      mode: 'Online',
      notes: '',
      userId: TEST_USER_ID,
    });

    const res = await request(app)
      .get('/api/transactions')
      .query({ category: 'Bus/GSRTC' })
      .set(authHeaders(token));
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(1);
    expect(res.body.data.transactions[0].category).toBe('Bus/GSRTC');
  });

  it('creates valid transaction', async () => {
    const res = await request(app)
      .post('/api/transactions')
      .set(authHeaders(token))
      .send({
        date: '2026-03-01',
        particulars: 'Snack',
        amount: 10,
        category: 'Food & Drinks',
        mode: 'Online',
        notes: 'tasty',
      });

    expect(res.status).toBe(201);
    expect(res.body.error).toBeNull();
    expect(res.body.data.particulars).toBe('Snack');
  });

  it('creates invalid transaction (missing fields)', async () => {
    const res = await request(app)
      .post('/api/transactions')
      .set(authHeaders(token))
      .send({
        particulars: 'Snack',
      });

    expect(res.status).toBe(400);
    expect(res.body.data).toBeNull();
    expect(res.body.error).toBe('Validation failed');
  });

  it('imports transactions from csv', async () => {
    const csv =
      'date,particulars,amount,category,mode,notes\n' +
      '2026-03-01,Coffee,20,Food & Drinks,Cash,\n' +
      '2026-03-02,Bus ticket,50,Bus/GSRTC,Online,\n';

    const res = await request(app)
      .post('/api/transactions/import/csv')
      .set(authHeaders(token))
      .attach('file', Buffer.from(csv), 'transactions.csv');

    expect(res.status).toBe(200);
    expect(res.body.error).toBeNull();
    expect(res.body.data.inserted).toBe(2);
    expect(res.body.data.failed).toBe(0);

    const count = await Transaction.countDocuments();
    expect(count).toBe(2);
  });

  it('gets by id', async () => {
    const created = await Transaction.create({
      date: new Date('2026-03-01'),
      particulars: 'Coffee',
      amount: 20,
      category: 'Food & Drinks',
      mode: 'Cash',
      notes: '',
      userId: TEST_USER_ID,
    });

    const res = await request(app)
      .get(`/api/transactions/${created._id.toString()}`)
      .set(authHeaders(token));
    expect(res.status).toBe(200);
    expect(res.body.data.particulars).toBe('Coffee');
  });

  it('get non-existent id', async () => {
    const res = await request(app)
      .get('/api/transactions/507f1f77bcf86cd799439012')
      .set(authHeaders(token));
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Transaction not found');
  });

  it('updates transaction', async () => {
    const created = await Transaction.create({
      date: new Date('2026-03-01'),
      particulars: 'Coffee',
      amount: 20,
      category: 'Food & Drinks',
      mode: 'Cash',
      notes: '',
      userId: TEST_USER_ID,
    });

    const res = await request(app)
      .put(`/api/transactions/${created._id.toString()}`)
      .set(authHeaders(token))
      .send({ amount: 30 });

    expect(res.status).toBe(200);
    expect(res.body.data.amount).toBe(30);
  });

  it('deletes transaction', async () => {
    const created = await Transaction.create({
      date: new Date('2026-03-01'),
      particulars: 'Coffee',
      amount: 20,
      category: 'Food & Drinks',
      mode: 'Cash',
      notes: '',
      userId: TEST_USER_ID,
    });

    const res = await request(app)
      .delete(`/api/transactions/${created._id.toString()}`)
      .set(authHeaders(token));
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Transaction deleted');
  });

  it('delete non-existent', async () => {
    const res = await request(app)
      .delete('/api/transactions/507f1f77bcf86cd799439012')
      .set(authHeaders(token));
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Transaction not found');
  });
});
