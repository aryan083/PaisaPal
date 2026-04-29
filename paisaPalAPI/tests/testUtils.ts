import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoServer: MongoMemoryServer | null = null;

export async function startInMemoryMongo() {
  mongoServer = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongoServer.getUri('paisatracker');
  process.env.NODE_ENV = 'test';

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
