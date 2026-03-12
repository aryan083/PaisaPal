import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Application } from 'express';

import Settings from '@/models/Settings';
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

describe('settings API', () => {
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

  it('get creates default if none', async () => {
    const res = await request(app)
      .get('/api/settings')
      .set(authHeaders(token));
    expect(res.status).toBe(200);
    expect(res.body.error).toBeNull();
    expect(res.body.data.stipend).toBe(12000);
    expect(res.body.data.extra).toBe(0);
  });

  it('update stipend', async () => {
    await Settings.create({ stipend: 12000, extra: 0, userId: TEST_USER_ID });

    const res = await request(app)
      .put('/api/settings')
      .set(authHeaders(token))
      .send({ stipend: 15000 });
    expect(res.status).toBe(200);
    expect(res.body.data.stipend).toBe(15000);
  });

  it('update extra', async () => {
    const res = await request(app)
      .put('/api/settings')
      .set(authHeaders(token))
      .send({ extra: 500 });
    expect(res.status).toBe(200);
    expect(res.body.data.extra).toBe(500);
  });

  it('update both', async () => {
    const res = await request(app)
      .put('/api/settings')
      .set(authHeaders(token))
      .send({ stipend: 13000, extra: 100 });
    expect(res.status).toBe(200);
    expect(res.body.data.stipend).toBe(13000);
    expect(res.body.data.extra).toBe(100);
  });
});
