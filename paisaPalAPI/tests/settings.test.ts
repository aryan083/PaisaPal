import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Application } from 'express';

import Settings from '@/models/Settings';
import { clearDatabase, startInMemoryMongo, stopInMemoryMongo } from './testUtils';

let app: Application;

describe('settings API', () => {
  beforeAll(async () => {
    await startInMemoryMongo();
    const mod = await import('@/index');
    app = mod.default;
  });

  beforeEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await stopInMemoryMongo();
  });

  it('get creates default if none', async () => {
    const res = await request(app).get('/api/settings');
    expect(res.status).toBe(200);
    expect(res.body.error).toBeNull();
    expect(res.body.data._id).toBe('default');
    expect(res.body.data.stipend).toBe(12000);
    expect(res.body.data.extra).toBe(0);
  });

  it('update stipend', async () => {
    await Settings.create({ _id: 'default', stipend: 12000, extra: 0 });

    const res = await request(app).put('/api/settings').send({ stipend: 15000 });
    expect(res.status).toBe(200);
    expect(res.body.data.stipend).toBe(15000);
  });

  it('update extra', async () => {
    const res = await request(app).put('/api/settings').send({ extra: 500 });
    expect(res.status).toBe(200);
    expect(res.body.data.extra).toBe(500);
  });

  it('update both', async () => {
    const res = await request(app).put('/api/settings').send({ stipend: 13000, extra: 100 });
    expect(res.status).toBe(200);
    expect(res.body.data.stipend).toBe(13000);
    expect(res.body.data.extra).toBe(100);
  });
});
