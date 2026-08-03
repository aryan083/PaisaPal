import dotenv from 'dotenv';
import fs from 'node:fs';
import mongoose from 'mongoose';
import path from 'node:path';

import Transaction from '../src/models/Transaction';

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

// Root .env (gitignored, local overrides) wins over the environment-specific
// config above — matches src/server.ts's load order, so this script targets
// whatever DB the app actually runs against, not the config file's default.
const rootEnv = path.resolve(process.cwd(), '.env');
if (fs.existsSync(rootEnv)) {
  dotenv.config({ path: rootEnv, override: true });
}

// One-off migration: rename Transaction.mode (string) -> modes (string[])
// for every existing document. `category` is NOT touched. Run this once
// against the target DB right after the model/schema change deploys, before
// the app is exercised against the new schema. Uses the raw driver
// (Transaction.collection, not the Mongoose model) so it bypasses the
// now-array-requiring Mongoose schema while reading/casting old scalar docs.
async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not set');
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const result = await Transaction.collection.updateMany(
    { modes: { $exists: false } },
    [
      { $set: { modes: ['$mode'] } },
      { $unset: ['mode'] },
    ],
  );

  console.log(`Migrated ${result.modifiedCount} transactions`);

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
