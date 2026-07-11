import fs from 'node:fs';
import path from 'node:path';

import dotenv from 'dotenv';

// Load .env first (gitignored, local overrides) — use override:true so these win
const rootEnv = path.resolve(process.cwd(), '.env');
if (fs.existsSync(rootEnv)) {
  dotenv.config({ path: rootEnv, override: true });
}

// Then load the environment-specific config as defaults for anything not set above
const appEnv = process.env.APP_ENV ?? 'development';
const configPath = path.resolve(process.cwd(), 'configs', 'envs', `.env.${appEnv}.config`);
const legacyPath = path.resolve(process.cwd(), `.env.${appEnv}`);

if (fs.existsSync(configPath)) {
  dotenv.config({ path: configPath });
} else if (fs.existsSync(legacyPath)) {
  dotenv.config({ path: legacyPath });
}

import app from './index';

const port = Number(process.env.PORT ?? 3001);

app.listen(port, () => {
  console.log(`Paisa Tracker API listening on port ${port}`);
});
