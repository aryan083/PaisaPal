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

describe('stats API', () => {
  beforeAll(async () => {
    await startInMemoryMongo();
    const mod = await import('@/index');
    app = mod.default;
  });

  beforeEach(async () => {
    await clearDatabase();
    await createTestUser();
    token = generateTestToken();

    await Transaction.insertMany([
      {
        date: new Date('2026-03-01'),
        particulars: 'Ride 1',
        amount: 50,
        category: 'Rapido',
        mode: 'Online',
        notes: '',
        userId: TEST_USER_ID,
      },
      {
        date: new Date('2026-03-01'),
        particulars: 'Lunch',
        amount: 100,
        category: 'Food & Drinks',
        mode: 'Cash',
        notes: '',
        userId: TEST_USER_ID,
      },
      {
        date: new Date('2026-03-02'),
        particulars: 'Ride 2',
        amount: 70,
        category: 'Rapido',
        mode: 'Online',
        notes: '',
        userId: TEST_USER_ID,
      },
    ]);
  });

  afterAll(async () => {
    await stopInMemoryMongo();
  });

  it('returns correct totals and rapido stats', async () => {
    const res = await request(app)
      .get('/api/stats')
      .set(authHeaders(token));
    expect(res.status).toBe(200);

    const data = res.body.data;
    expect(data.totalSpent).toBe(220);
    expect(data.transactionCount).toBe(3);

    expect(data.byMode.Online).toBe(120);
    expect(data.byMode.Cash).toBe(100);

    expect(data.rapidoStats.total).toBe(120);
    expect(data.rapidoStats.count).toBe(2);
    expect(data.rapidoStats.avgPerRide).toBe(60);

    const rapidoCategory = data.byCategory.find((c: { category: string }) => c.category === 'Rapido');
    expect(rapidoCategory.total).toBe(120);
    expect(rapidoCategory.count).toBe(2);

    expect(data.byDate).toEqual([
      { date: '2026-03-01', total: 150 },
      { date: '2026-03-02', total: 70 },
    ]);
  });
});
