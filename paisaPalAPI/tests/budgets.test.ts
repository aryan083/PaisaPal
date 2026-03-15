import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Application } from 'express';
import request from 'supertest';

import app from '../src/index';
import Envelope from '../src/models/Envelope';
import Transaction from '../src/models/Transaction';
import {
  authHeaders,
  clearDatabase,
  createTestUser,
  generateTestToken,
  startInMemoryMongo,
  stopInMemoryMongo,
  TEST_USER_ID,
} from './testUtils';

let token: string;

describe('budgets API', () => {
  beforeAll(async () => {
    await startInMemoryMongo();
  });

  afterAll(async () => {
    await stopInMemoryMongo();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  beforeEach(async () => {
    await createTestUser();
    token = generateTestToken();
  });

  describe('list budgets', () => {
    it('returns empty list when no budgets exist', async () => {
      const res = await request(app)
        .get('/api/budgets')
        .set(authHeaders(token));

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    it('returns budgets filtered by month', async () => {
      await Envelope.create([
        {
          month: '2026-03',
          userId: TEST_USER_ID,
          envelopes: [{ category: 'Food & Drinks', limit: 5000, spent: 0, status: 'under' }],
        },
        {
          month: '2026-04',
          userId: TEST_USER_ID,
          envelopes: [{ category: 'Shopping', limit: 3000, spent: 0, status: 'under' }],
        },
      ]);

      const res = await request(app)
        .get('/api/budgets?month=2026-03')
        .set(authHeaders(token));

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].category).toBe('Food & Drinks');
    });
  });

  describe('create budget', () => {
    it('creates a budget for a category and month', async () => {
      const res = await request(app)
        .post('/api/budgets')
        .set(authHeaders(token))
        .send({
          category: 'Food & Drinks',
          monthlyLimit: 5000,
          month: '2026-03',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.category).toBe('Food & Drinks');
      expect(res.body.data.monthlyLimit).toBe(5000);
    });

    it('rejects duplicate budget for same category and month', async () => {
      await Envelope.create({
        month: '2026-03',
        userId: TEST_USER_ID,
        envelopes: [{ category: 'Food & Drinks', limit: 5000, spent: 0, status: 'under' }],
      });

      const res = await request(app)
        .post('/api/budgets')
        .set(authHeaders(token))
        .send({
          category: 'Food & Drinks',
          monthlyLimit: 6000,
          month: '2026-03',
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Budget already exists for this category and month');
    });

    it('validates month format', async () => {
      const res = await request(app)
        .post('/api/budgets')
        .set(authHeaders(token))
        .send({
          category: 'Food & Drinks',
          monthlyLimit: 5000,
          month: '2026/03',
        });

      expect(res.status).toBe(400);
    });
  });

  describe('get budget', () => {
    it('returns a budget by id', async () => {
      const env = await Envelope.create({
        month: '2026-03',
        userId: TEST_USER_ID,
        envelopes: [{ category: 'Food & Drinks', limit: 5000, spent: 0, status: 'under' }],
      });

      const firstEnvelope = env.envelopes[0];
      if (!firstEnvelope) throw new Error('No envelope created');
      const budgetId = firstEnvelope._id?.toString();

      const res = await request(app)
        .get(`/api/budgets/${budgetId}`)
        .set(authHeaders(token));

      expect(res.status).toBe(200);
      expect(res.body.data.category).toBe('Food & Drinks');
    });

    it('returns 404 for non-existent budget', async () => {
      const res = await request(app)
        .get('/api/budgets/507f1f77bcf86cd799439012')
        .set(authHeaders(token));

      expect(res.status).toBe(404);
    });
  });

  describe('update budget', () => {
    it('updates budget limit', async () => {
      const env = await Envelope.create({
        month: '2026-03',
        userId: TEST_USER_ID,
        envelopes: [{ category: 'Food & Drinks', limit: 5000, spent: 0, status: 'under' }],
      });

      const firstEnvelope = env.envelopes[0];
      if (!firstEnvelope) throw new Error('No envelope created');
      const budgetId = firstEnvelope._id?.toString();

      const res = await request(app)
        .put(`/api/budgets/${budgetId}`)
        .set(authHeaders(token))
        .send({ monthlyLimit: 6000 });

      expect(res.status).toBe(200);
      expect(res.body.data.monthlyLimit).toBe(6000);
    });
  });

  describe('delete budget', () => {
    it('deletes a budget', async () => {
      const env = await Envelope.create({
        month: '2026-03',
        userId: TEST_USER_ID,
        envelopes: [{ category: 'Food & Drinks', limit: 5000, spent: 0, status: 'under' }],
      });

      const firstEnvelope = env.envelopes[0];
      if (!firstEnvelope) throw new Error('No envelope created');
      const budgetId = firstEnvelope._id?.toString();

      const res = await request(app)
        .delete(`/api/budgets/${budgetId}`)
        .set(authHeaders(token));

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Budget deleted');
    });
  });

  describe('budget stats', () => {
    it('returns budget stats with spending', async () => {
      await Envelope.create({
        month: '2026-03',
        userId: TEST_USER_ID,
        envelopes: [
          { category: 'Food & Drinks', limit: 5000, spent: 0, status: 'under' },
          { category: 'Shopping', limit: 3000, spent: 0, status: 'under' },
        ],
      });

      await Transaction.create([
        {
          date: new Date('2026-03-05'),
          particulars: 'Coffee',
          amount: 100,
          category: 'Food & Drinks',
          mode: 'Online',
          userId: TEST_USER_ID,
        },
        {
          date: new Date('2026-03-10'),
          particulars: 'Groceries',
          amount: 500,
          category: 'Food & Drinks',
          mode: 'Cash',
          userId: TEST_USER_ID,
        },
        {
          date: new Date('2026-03-15'),
          particulars: 'Shoes',
          amount: 2000,
          category: 'Shopping',
          mode: 'Online',
          userId: TEST_USER_ID,
        },
      ]);

      const res = await request(app)
        .get('/api/budgets/stats?month=2026-03')
        .set(authHeaders(token));

      expect(res.status).toBe(200);
      expect(res.body.data.month).toBe('2026-03');
      expect(res.body.data.totalBudgeted).toBe(8000);
      expect(res.body.data.totalSpent).toBe(2600);
      expect(res.body.data.budgets).toHaveLength(2);

      const foodBudget = res.body.data.budgets.find(
        (b: { category: string }) => b.category === 'Food & Drinks',
      );
      expect(foodBudget.spent).toBe(600);
      expect(foodBudget.monthlyLimit).toBe(5000);
      expect(foodBudget.percentage).toBe(12);
    });

    it('detects over-budget categories', async () => {
      await Envelope.create({
        month: '2026-03',
        userId: TEST_USER_ID,
        envelopes: [{ category: 'Food & Drinks', limit: 100, spent: 0, status: 'under' }],
      });

      await Transaction.create({
        date: new Date('2026-03-05'),
        particulars: 'Expensive meal',
        amount: 500,
        category: 'Food & Drinks',
        mode: 'Online',
        userId: TEST_USER_ID,
      });

      const res = await request(app)
        .get('/api/budgets/stats?month=2026-03')
        .set(authHeaders(token));

      expect(res.status).toBe(200);

      const foodBudget = res.body.data.budgets.find(
        (b: { category: string }) => b.category === 'Food & Drinks',
      );
      expect(foodBudget.isOverBudget).toBe(true);
      expect(foodBudget.remaining).toBe(-400);
    });

    it('shows categories with spending but no budget', async () => {
      await Transaction.create({
        date: new Date('2026-03-05'),
        particulars: 'Bus ticket',
        amount: 50,
        category: 'Bus/GSRTC',
        mode: 'Cash',
        userId: TEST_USER_ID,
      });

      const res = await request(app)
        .get('/api/budgets/stats?month=2026-03')
        .set(authHeaders(token));

      expect(res.status).toBe(200);

      const busBudget = res.body.data.budgets.find(
        (b: { category: string }) => b.category === 'Bus/GSRTC',
      );
      expect(busBudget).toBeDefined();
      expect(busBudget.monthlyLimit).toBe(0);
      expect(busBudget.percentage).toBe(-1);
      expect(busBudget.isOverBudget).toBe(true);
    });

    it('requires month parameter', async () => {
      const res = await request(app)
        .get('/api/budgets/stats')
        .set(authHeaders(token));

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Month parameter is required in YYYY-MM format');
    });

    it('validates month format', async () => {
      const res = await request(app)
        .get('/api/budgets/stats?month=2026/03')
        .set(authHeaders(token));

      expect(res.status).toBe(400);
    });
  });
});
