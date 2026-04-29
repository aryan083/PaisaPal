import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import type { Request, Response } from 'express';

import apiRoutes from './routes';
import { errorHandler } from './lib/errorHandler';
import { notFound } from './middleware/notFound';

const app = express();

app.use(helmet());

app.use(
  cors({
    origin:
      process.env.NODE_ENV === 'production' ? (process.env.FRONTEND_URL ?? false) : '*',
  }),
);

app.use(express.json({ limit: '10kb' }));

app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

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

app.use('/api', apiRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
