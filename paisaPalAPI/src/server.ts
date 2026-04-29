import fs from 'node:fs';
import path from 'node:path';

import dotenv from 'dotenv';

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

import app from './index';

const port = Number(process.env.PORT ?? 3001);

app.listen(port, () => {
  console.log(`Paisa Tracker API listening on port ${port}`);
});
