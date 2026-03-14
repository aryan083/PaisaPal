import cors, { type CorsOptions } from 'cors';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import type { Request, Response } from 'express';

import apiRoutes from './routes';
import { errorHandler } from './lib/errorHandler';
import { notFound } from './middleware/notFound';
import { requestLogger } from './lib/logger';

const app = express();

app.set('trust proxy', 1);

app.use(helmet());

const cors_options: CorsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);

    const allowed =
      origin === 'https://paisa-pal-c9ol.vercel.app' ||
      origin === 'http://localhost:8080';

    return callback(null, allowed);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false,
  optionsSuccessStatus: 204,
  preflightContinue: false,
};

app.use(
  cors(cors_options),
);

app.use(express.json({ limit: '10kb' }));

app.use(requestLogger);

app.use(
  '/api',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

app.get('/healthz', (_req: Request, res: Response) => {
  res.status(200).json({ data: { status: 'ok' }, error: null });
});

app.get('/api/healthz', (_req: Request, res: Response) => {
  res.status(200).json({ data: { status: 'ok' }, error: null });
});

app.use('/api', apiRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
