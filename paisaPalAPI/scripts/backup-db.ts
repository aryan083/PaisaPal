import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';

const appEnv = process.env.APP_ENV ?? 'development';
const configPath = path.resolve(process.cwd(), 'configs', 'envs', `.env.${appEnv}.config`);
const legacyPath = path.resolve(process.cwd(), `.env.${appEnv}`);

if (fs.existsSync(configPath)) {
  dotenv.config({ path: configPath });
} else if (fs.existsSync(legacyPath)) {
  dotenv.config({ path: legacyPath });
} else {
  dotenv.config();
}

const rootEnv = path.resolve(process.cwd(), '.env');
if (fs.existsSync(rootEnv)) {
  dotenv.config({ path: rootEnv, override: true });
}

// Read-only full-database backup: dumps every collection to a JSON file.
// Safe to run any time — makes no writes to the database.
async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not set');
  }

  const conn = await mongoose.connect(process.env.MONGODB_URI);
  const db = conn.connection.db;
  if (!db) throw new Error('Failed to get database handle');

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.resolve(process.cwd(), 'backups', timestamp);
  fs.mkdirSync(outDir, { recursive: true });

  const collections = await db.listCollections().toArray();
  const summary: Record<string, number> = {};

  for (const { name } of collections) {
    const docs = await db.collection(name).find({}).toArray();
    fs.writeFileSync(
      path.join(outDir, `${name}.json`),
      JSON.stringify(docs, null, 2),
    );
    summary[name] = docs.length;
  }

  console.log(`Backup written to ${outDir}`);
  console.log('Document counts:', JSON.stringify(summary, null, 2));

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
