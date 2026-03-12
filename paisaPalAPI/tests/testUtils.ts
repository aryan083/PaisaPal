import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import jwt from 'jsonwebtoken';
import { User } from '../src/models/User';

let mongoServer: MongoMemoryServer | null = null;

export const TEST_USER_ID = '507f1f77bcf86cd799439011';
export const TEST_JWT_SECRET = 'test-secret-key-for-jwt-signing-32-bytes';

export async function startInMemoryMongo() {
  mongoServer = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongoServer.getUri('paisatracker');
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = TEST_JWT_SECRET;
  process.env.JWT_EXPIRY = '7d';

  await mongoose.connect(process.env.MONGODB_URI);
}

export async function stopInMemoryMongo() {
  await mongoose.disconnect();

  if (mongoServer) {
    await mongoServer.stop();
    mongoServer = null;
  }
}

export async function clearDatabase() {
  const db = mongoose.connection.db;
  if (!db) return;
  await db.dropDatabase();
}

export async function createTestUser() {
  const user = await User.create({
    _id: new mongoose.Types.ObjectId(TEST_USER_ID),
    email: 'test@test.com',
    passwordHash: 'test-hash',
    name: 'Test User',
  });
  return user;
}

export function generateTestToken(userId: string = TEST_USER_ID) {
  return jwt.sign({ userId, email: 'test@test.com' }, TEST_JWT_SECRET, { expiresIn: '7d' });
}

export function authHeaders(token?: string) {
  return { Authorization: `Bearer ${token ?? generateTestToken()}` };
}
