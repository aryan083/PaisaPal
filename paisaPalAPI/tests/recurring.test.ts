import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { Application } from 'express';
import request from 'supertest';

import app from '../src/index';
import RecurringRule from '../src/models/RecurringRule';
import Transaction from '../src/models/Transaction';
import { clearDatabase, startInMemoryMongo, stopInMemoryMongo } from './testUtils';

describe('recurring rules API', () => {
  beforeAll(async () => {
    await startInMemoryMongo();
  });

  afterAll(async () => {
    await stopInMemoryMongo();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  describe('list rules', () => {
    it('returns empty list when no rules exist', async () => {
      const res = await request(app).get('/api/recurring');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    it('returns all rules sorted by nextDue', async () => {
      await RecurringRule.create([
        {
          name: 'Monthly Rent',
          particulars: 'Rent payment',
          amount: 10000,
          category: 'Other',
          mode: 'Online',
          frequency: 'monthly',
          dayOfMonth: 1,
          startDate: new Date('2026-01-01'),
          nextDue: new Date('2026-04-01'),
          isActive: true,
        },
        {
          name: 'Weekly Recharge',
          particulars: 'Phone recharge',
          amount: 200,
          category: 'Recharge/Bills',
          mode: 'Online',
          frequency: 'weekly',
          dayOfWeek: 0,
          startDate: new Date('2026-01-01'),
          nextDue: new Date('2026-03-15'),
          isActive: true,
        },
      ]);

      const res = await request(app).get('/api/recurring');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].name).toBe('Weekly Recharge');
      expect(res.body.data[1].name).toBe('Monthly Rent');
    });
  });

  describe('create rule', () => {
    it('creates a monthly recurring rule', async () => {
      const res = await request(app)
        .post('/api/recurring')
        .send({
          name: 'Monthly Rent',
          particulars: 'Rent payment',
          amount: 10000,
          category: 'Other',
          mode: 'Online',
          frequency: 'monthly',
          dayOfMonth: 1,
          startDate: '2026-01-01',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('Monthly Rent');
      expect(res.body.data.frequency).toBe('monthly');
      expect(res.body.data.nextDue).toBeDefined();
    });

    it('creates a weekly recurring rule', async () => {
      const res = await request(app)
        .post('/api/recurring')
        .send({
          name: 'Weekly Groceries',
          particulars: 'Grocery shopping',
          amount: 500,
          category: 'Food & Drinks',
          mode: 'Cash',
          frequency: 'weekly',
          dayOfWeek: 6,
          startDate: '2026-01-04',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.frequency).toBe('weekly');
      expect(res.body.data.dayOfWeek).toBe(6);
    });

    it('validates required fields', async () => {
      const res = await request(app)
        .post('/api/recurring')
        .send({
          name: 'Invalid Rule',
        });

      expect(res.status).toBe(400);
    });
  });

  describe('get rule', () => {
    it('returns a rule by id', async () => {
      const rule = await RecurringRule.create({
        name: 'Monthly Rent',
        particulars: 'Rent payment',
        amount: 10000,
        category: 'Other',
        mode: 'Online',
        frequency: 'monthly',
        dayOfMonth: 1,
        startDate: new Date('2026-01-01'),
        nextDue: new Date('2026-04-01'),
        isActive: true,
      });

      const res = await request(app).get(`/api/recurring/${rule._id}`);

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Monthly Rent');
    });

    it('returns 404 for non-existent rule', async () => {
      const res = await request(app).get('/api/recurring/507f1f77bcf86cd799439011');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Recurring rule not found');
    });
  });

  describe('update rule', () => {
    it('updates a rule', async () => {
      const rule = await RecurringRule.create({
        name: 'Monthly Rent',
        particulars: 'Rent payment',
        amount: 10000,
        category: 'Other',
        mode: 'Online',
        frequency: 'monthly',
        dayOfMonth: 1,
        startDate: new Date('2026-01-01'),
        nextDue: new Date('2026-04-01'),
        isActive: true,
      });

      const res = await request(app)
        .put(`/api/recurring/${rule._id}`)
        .send({ amount: 12000 });

      expect(res.status).toBe(200);
      expect(res.body.data.amount).toBe(12000);
    });

    it('deactivates a rule', async () => {
      const rule = await RecurringRule.create({
        name: 'Monthly Rent',
        particulars: 'Rent payment',
        amount: 10000,
        category: 'Other',
        mode: 'Online',
        frequency: 'monthly',
        dayOfMonth: 1,
        startDate: new Date('2026-01-01'),
        nextDue: new Date('2026-04-01'),
        isActive: true,
      });

      const res = await request(app)
        .put(`/api/recurring/${rule._id}`)
        .send({ isActive: false });

      expect(res.status).toBe(200);
      expect(res.body.data.isActive).toBe(false);
    });
  });

  describe('delete rule', () => {
    it('deletes a rule', async () => {
      const rule = await RecurringRule.create({
        name: 'Monthly Rent',
        particulars: 'Rent payment',
        amount: 10000,
        category: 'Other',
        mode: 'Online',
        frequency: 'monthly',
        dayOfMonth: 1,
        startDate: new Date('2026-01-01'),
        nextDue: new Date('2026-04-01'),
        isActive: true,
      });

      const res = await request(app).delete(`/api/recurring/${rule._id}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Recurring rule deleted');

      const found = await RecurringRule.findById(rule._id);
      expect(found).toBeNull();
    });

    it('returns 404 for non-existent rule', async () => {
      const res = await request(app).delete('/api/recurring/507f1f77bcf86cd799439011');

      expect(res.status).toBe(404);
    });
  });

  describe('preview rule', () => {
    it('previews next occurrences for a monthly rule', async () => {
      const res = await request(app)
        .post('/api/recurring/preview')
        .send({
          name: 'Monthly Rent',
          particulars: 'Rent payment',
          amount: 10000,
          category: 'Other',
          mode: 'Online',
          frequency: 'monthly',
          dayOfMonth: 1,
          startDate: '2026-01-01',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.nextOccurrences).toBeDefined();
      expect(res.body.data.nextOccurrences.length).toBeGreaterThan(0);
    });

    it('respects endDate in preview', async () => {
      const res = await request(app)
        .post('/api/recurring/preview')
        .send({
          name: 'Temporary',
          particulars: 'Temp',
          amount: 100,
          category: 'Other',
          mode: 'Online',
          frequency: 'monthly',
          dayOfMonth: 1,
          startDate: '2026-01-01',
          endDate: '2026-02-28',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.nextOccurrences.length).toBeLessThanOrEqual(3);
    });
  });

  describe('run rules', () => {
    it('dry run returns preview without creating transactions', async () => {
      await RecurringRule.create({
        name: 'Monthly Rent',
        particulars: 'Rent payment',
        amount: 10000,
        category: 'Other',
        mode: 'Online',
        frequency: 'monthly',
        dayOfMonth: 1,
        startDate: new Date('2020-01-01'),
        nextDue: new Date('2026-03-01'),
        isActive: true,
      });

      const res = await request(app).get('/api/recurring/run?dryRun=true');

      expect(res.status).toBe(200);
      expect(res.body.data.created).toBeGreaterThan(0);
      expect(res.body.data.transactions).toBeDefined();

      const transactions = await Transaction.find();
      expect(transactions.length).toBe(0);
    });

    it('creates transactions from due rules', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      await RecurringRule.create({
        name: 'Monthly Rent',
        particulars: 'Rent payment',
        amount: 10000,
        category: 'Other',
        mode: 'Online',
        frequency: 'monthly',
        dayOfMonth: 1,
        startDate: new Date('2020-01-01'),
        nextDue: today,
        isActive: true,
      });

      const res = await request(app).get('/api/recurring/run');

      expect(res.status).toBe(200);
      expect(res.body.data.created).toBeGreaterThan(0);

      const transactions = await Transaction.find();
      expect(transactions.length).toBeGreaterThan(0);
    });
  });
});
