---
name: express-serverless-api
description: >
  Build production-ready Express.js REST APIs deployable as Vercel serverless
  functions with MongoDB Atlas. Use when asked to create backend APIs, REST
  endpoints, database models, Docker development environments, or serverless
  Express deployments. Covers: route handlers, Mongoose models, Zod validation
  middleware, error handling, CORS/helmet security, Docker Compose setup,
  Vercel serverless entry points, and integration testing with Vitest.
version: 1.0.0
author: paisa-tracker
tags: [express, mongodb, mongoose, vercel, serverless, docker, typescript, zod, vitest]
---

# Express Serverless API Skill

## Purpose
Build Express REST APIs that run both locally (via Docker) and in production
(as Vercel serverless functions) with MongoDB as the database.

## Critical Architecture Rules

### 1. App Factory Pattern (MANDATORY)
NEVER put `app.listen()` in the main app file.
Split into two files:

`src/index.ts` — exports the Express app, no listen call. This is what
Vercel imports.

`src/server.ts` — imports app, calls `app.listen()`. Used only for local dev.

The Vercel entry point (`api/index.ts`) imports from `src/index.ts` and
exports as default. This is the ONLY way to make Express work serverlessly
on Vercel.

### 2. MongoDB Singleton (MANDATORY)
Serverless functions are stateless but containers are reused between warm
invocations. Always cache the Mongoose connection on the `global` object:
```typescript
const cached = global.mongoose ?? { conn: null, promise: null }
global.mongoose = cached

export async function connectDB() {
  if (cached.conn) return cached.conn
  if (!cached.promise) {
    cached.promise = mongoose.connect(process.env.MONGODB_URI!, {
      bufferCommands: false,
    })
  }
  cached.conn = await cached.promise
  return cached.conn
}
```

Call `await connectDB()` at the top of every route handler.
Without this, each serverless invocation opens a new connection and
exhausts the MongoDB Atlas connection limit within minutes.

### 3. Async Handler Wrapper (MANDATORY)
Never write async route handlers without wrapping them. Unhandled promise
rejections crash serverless functions silently.
```typescript
// asyncHandler.ts
export const asyncHandler = (fn: RequestHandler): RequestHandler =>
  (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

// Usage — always
router.get('/', asyncHandler(async (req, res) => {
  // safe to use await here
}))
```

### 4. Zod Validation Middleware (MANDATORY)
Validation always happens in middleware before the controller.
Controllers must NEVER validate — they assume data is clean.
```typescript
// validate.ts
export const validate = (schema: ZodSchema, target: 'body' | 'query' = 'body') =>
  (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(target === 'body' ? req.body : req.query)
    if (!result.success) {
      return res.status(400).json({
        data: null,
        error: 'Validation failed',
        details: result.error.flatten(),
      })
    }
    if (target === 'body') req.body = result.data
    else req.query = result.data as Record<string, string>
    next()
  }

// Usage
router.post('/', validate(TransactionSchema), asyncHandler(createTransaction))
```

### 5. Response Envelope (MANDATORY)
Every single API response must use this shape — no exceptions:
```typescript
// Success
res.status(200).json({ data: result, error: null })

// Error
res.status(404).json({ data: null, error: 'Transaction not found' })

// Created
res.status(201).json({ data: created, error: null, message: 'Created' })
```

### 6. Error Handler (MANDATORY)
Register as the LAST middleware in `src/index.ts`:
```typescript
app.use(notFound)      // 404 for unmatched routes
app.use(errorHandler)  // global error handler
```

Map these Mongoose errors to HTTP codes:
- `CastError` (invalid ObjectId) → 400
- `ValidationError` → 422
- `11000` (duplicate key) → 409
- Everything else → 500

Never include `error.stack` in production responses.

## File Templates

### Mongoose Model Pattern
```typescript
import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IModelName extends Document {
  field: type
  createdAt: Date
  updatedAt: Date
}

const ModelSchema = new Schema<IModelName>(
  { field: { type: Type, required: true } },
  { timestamps: true }
)

// This prevents "Cannot overwrite model once compiled" in serverless
const ModelName: Model<IModelName> =
  mongoose.models.ModelName ??
  mongoose.model<IModelName>('ModelName', ModelSchema)

export default ModelName
```

### Controller Pattern
```typescript
import { Request, Response } from 'express'
import { asyncHandler } from '@/middleware/asyncHandler'
import { connectDB } from '@/lib/mongodb'
import Transaction from '@/models/Transaction'

export const getTransactions = asyncHandler(async (req: Request, res: Response) => {
  await connectDB()
  const transactions = await Transaction.find({}).lean()
  res.json({ data: transactions, error: null })
})
```

### Route Registration Pattern
```typescript
// routes/transactions.ts
import { Router } from 'express'
import { validate } from '@/middleware/validate'
import { TransactionSchema } from '@/schemas'
import { getTransactions, createTransaction } from '@/controllers/transactions'

const router = Router()

router.get('/', asyncHandler(getTransactions))
router.post('/', validate(TransactionSchema), asyncHandler(createTransaction))

export default router

// routes/index.ts
import { Router } from 'express'
import transactionRoutes from './transactions'
import settingsRoutes from './settings'

const router = Router()
router.use('/transactions', transactionRoutes)
router.use('/settings', settingsRoutes)

export default router
```

## Docker Compose Pattern
```yaml
services:
  mongo:
    image: mongo:7
    ports: ["27017:27017"]
    volumes:
      - mongo_data:/data/db
      - ./docker/mongo-init.js:/docker-entrypoint-initdb.d/init.js
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
      interval: 10s
      timeout: 5s
      retries: 5

  api:
    build: .
    ports: ["3001:3001"]
    depends_on:
      mongo:
        condition: service_healthy
    env_file: .env.development
    volumes:
      - ./src:/app/src   # hot reload
    command: npm run dev

volumes:
  mongo_data:
```

## Vercel Configuration
```json
{
  "version": 2,
  "builds": [{ "src": "api/index.ts", "use": "@vercel/node" }],
  "routes": [{ "src": "/api/(.*)", "dest": "api/index.ts" }]
}
```
```typescript
// api/index.ts — the ONLY thing this file does
import app from '../src/index'
export default app
```

## Security Checklist
Apply middleware in this exact order:
1. `helmet()` — security headers
2. `cors({ origin: process.env.FRONTEND_URL })` — cross-origin
3. `express.json({ limit: '10kb' })` — body parser with size limit
4. `morgan()` — logging
5. `rateLimit({ windowMs: 15*60*1000, max: 100 })` — rate limiting on /api/*
6. Routes
7. `notFound` middleware
8. `errorHandler` middleware

## Common Pitfalls to Avoid

NEVER do this:
- `app.listen()` in `src/index.ts` — breaks Vercel deployment
- `new mongoose.connection` per request — exhausts connection pool
- Unhandled async route handlers — causes silent crashes
- Hardcoded `localhost` MongoDB URI in any committed file
- `console.log(error.stack)` in production — leaks internals
- Mongoose model definition outside the `models/` directory
- Returning different response shapes from different endpoints

ALWAYS do this:
- Use `lean()` on read queries that don't need Mongoose document methods
- Export both the Mongoose model AND its TypeScript interface from model files
- Use `mongoose.models.X ?? mongoose.model('X', schema)` pattern
- Index fields you filter or sort by (`category`, `date`)
- Validate at the middleware layer, not in controllers
- Use `safeParse` not `parse` in validation middleware (graceful failure)
```

---

## 🤖 How to Use AI Agents Properly

Here's a practical guide specifically for a project like this:

---

### The Core Mental Model

Think of an AI agent like a very smart contractor who has never seen your codebase. The more context you give upfront, the less back-and-forth you need. Vague requests get vague results. Precise requests with constraints get production-ready output.

---

### Rule 1 — Give the Agent a Role First

Always start with who the agent is before what you want:
```
You are a senior backend engineer with expertise in Express.js, 
MongoDB, and Vercel serverless deployments. You write TypeScript 
with strict mode, never use `any`, and always handle errors 
gracefully. You are building the backend for Paisa Tracker.
```

This primes the model's "voice" and prevents it from writing tutorial-level code.

---

### Rule 2 — Constraints Beat Instructions

Instead of saying "write good code," list what good means:
```
CONSTRAINTS:
- Zero `any` in TypeScript
- Every async handler wrapped in asyncHandler()
- Never call app.listen() in src/index.ts
- All responses use { data, error, message } envelope
- Never leak stack traces in production
```

Constraints are non-negotiable rules. The agent will follow them more reliably than vague quality instructions.

---

### Rule 3 — Give the Agent Your SKILL.md

The SKILL.md above is specifically designed to be pasted as context at the start of any agent session involving this codebase. It gives the agent:
- Architecture decisions already made
- Exact code patterns to follow
- Common mistakes to avoid
- File templates to use as starting points

Use it like this:
```
Before writing any code, read and internalize this SKILL.md. 
Follow every pattern defined in it without deviation.

[paste SKILL.md content here]

Now build the transactions controller.
```

---

### Rule 4 — One File at a Time for Complex Code

Don't ask for everything at once. Ask file by file for complex logic:
```
Good:  "Write src/middleware/validate.ts using the pattern in SKILL.md"
Bad:   "Write all the middleware files"
```
```
Good:  "Write the GET /api/transactions handler. It should support 
        search, category filter, sort, order, page, and limit params. 
        Use the QueryParamsSchema from src/schemas/index.ts"
Bad:   "Write all the transaction routes"
```

---

### Rule 5 — Always Give the Agent Your Types

Paste your `types/index.ts` and model interfaces into every session. The agent cannot infer what your `Transaction` type looks like without seeing it, and will make up its own version that won't match your frontend.

---

### Rule 6 — Use Checkpoints

After every 3-4 files ask the agent to summarize what it has built and what still needs to be done. This prevents drift where the agent "forgets" earlier decisions:
```
Before continuing, summarize:
1. What files have we written so far
2. What patterns are we using for error handling
3. What's the response envelope shape
4. What still needs to be built
```

---

### Rule 7 — Paste Actual Errors, Not Descriptions

When something breaks, paste the full error — not a description of it:
```
Bad:  "The MongoDB connection isn't working"
Good: [paste the full stack trace and the relevant file content]
```

The agent can fix exact errors. It cannot reliably fix vague descriptions.

---

### Rule 8 — Use Agents for Iteration, Not Just Generation

After the agent writes a file, ask it to review its own work:
```
Now review what you just wrote and check:
1. Are there any implicit `any` types?
2. Is every async handler wrapped in asyncHandler()?
3. Does every response use the { data, error } envelope?
4. Are there any edge cases not handled?
---

### Rule 9 — Version Control Your Prompts

Save your best prompts as .md files in a prompts/ directory in your repo. When you come back to a project after weeks away, these prompts let you spin up a new agent session with full context in seconds rather than reconstructing everything from memory.

---
### Rule 10 — The SKILL.md is a Living Document

Update your SKILL.md every time you discover a new pattern, fix a recurring bug, or make an architectural decision. Treat it like you treat your README — it represents the current truth of your codebase. The better your SKILL.md, the better every future agent session will be.