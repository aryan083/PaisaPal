import cors, { type CorsOptions } from 'cors'
import express from 'express'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import type { Request, Response } from 'express'

import apiRoutes from './routes'
import { errorHandler } from './lib/errorHandler'
import { notFound } from './middleware/notFound'

const app = express()

app.set('trust proxy', 1)
app.use(helmet())

const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true)
    const allowed = [
      process.env.FRONTEND_URL,
      process.env.PAISA_TRACKER_URL,
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:3000',
    ].filter(Boolean)
    return callback(null, allowed.includes(origin) || origin.endsWith('.vercel.app'))
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false,
  optionsSuccessStatus: 204,
}

app.use(cors(corsOptions))
app.use(express.json({ limit: '10kb' }))

app.use(
  '/api',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
  }),
)

app.get('/healthz', (_req: Request, res: Response) => {
  res.status(200).json({ data: { status: 'ok' }, error: null })
})

app.get('/api/healthz', (_req: Request, res: Response) => {
  res.status(200).json({ data: { status: 'ok' }, error: null })
})

app.use('/api', apiRoutes)

app.use(notFound)
app.use(errorHandler)

export default app
