# Paisa Tracker API

Express.js 5 + TypeScript REST API for the Paisa Tracker frontend.

- **Runtime**: Node.js 20
- **Framework**: Express 5
- **Database**: MongoDB (MongoDB Atlas in production)
- **ODM**: Mongoose
- **Validation**: Zod
- **Serverless Deploy**: Vercel (`api/index.ts`)
- **Local Dev**: Docker Compose (API + Mongo)
- **Testing**: Vitest + supertest + mongodb-memory-server

## Quick start (Docker)

```bash
git clone <repo> && cd paisaPalAPI
cp .env.example .env.development
docker compose up --build
# API: http://localhost:3001
# MongoDB: mongodb://localhost:27017

npm run build
npm run seed:docker
```

## Quick start (without Docker)

```bash
npm install
cp .env.example .env.local
# Fill in MONGODB_URI with your Atlas connection string
npm run dev
```

## Deploy to Vercel

```bash
npm install -g vercel
vercel
# Add MONGODB_URI and FRONTEND_URL in Vercel dashboard
vercel --prod
```

## Environment variables

- `MONGODB_URI` (required)
- `FRONTEND_URL` (required in production)
- `NODE_ENV` (`development` | `production`)
- `PORT` (default `3001`)
- `APP_ENV` (loads `./configs/envs/.env.${APP_ENV}.config` when running `src/server.ts`)

## Response envelope

All endpoints respond with:

```json
{ "data": null, "error": null, "message": "..." }
```

## API Reference

### Transactions

#### GET `/api/transactions`

Query params:
- `search` (string) - searches `particulars` and `notes` using case-insensitive regex
- `category` (string) - exact match
- `sort` (string) - `date|amount|category|createdAt|updatedAt` (default `date`)
- `order` (string) - `asc|desc` (default `desc`)
- `page` (number) - default `1`
- `limit` (number) - default `50`, max `100`

Response:
```json
{
  "data": {
    "transactions": [],
    "total": 0,
    "page": 1,
    "pages": 1
  },
  "error": null
}
```

Example:
```bash
curl "http://localhost:3001/api/transactions?search=rapido&limit=10"
```

#### POST `/api/transactions`

Body:
```json
{
  "date": "2026-03-01",
  "particulars": "Coffee",
  "amount": 20,
  "category": "Food & Drinks",
  "mode": "Cash",
  "notes": ""
}
```

Example:
```bash
curl -X POST http://localhost:3001/api/transactions \
  -H "Content-Type: application/json" \
  -d '{"date":"2026-03-01","particulars":"Coffee","amount":20,"category":"Food & Drinks","mode":"Cash","notes":""}'
```

#### GET `/api/transactions/:id`

Example:
```bash
curl http://localhost:3001/api/transactions/507f1f77bcf86cd799439011
```

#### PUT `/api/transactions/:id`

Body (all optional, at least one required):
```json
{ "amount": 30 }
```

Example:
```bash
curl -X PUT http://localhost:3001/api/transactions/<id> \
  -H "Content-Type: application/json" \
  -d '{"amount":30}'
```

#### DELETE `/api/transactions/:id`

Example:
```bash
curl -X DELETE http://localhost:3001/api/transactions/<id>
```

### Settings

#### GET `/api/settings`

Always returns a settings document (upserted with defaults if missing).

Example:
```bash
curl http://localhost:3001/api/settings
```

#### PUT `/api/settings`

Body:
```json
{ "stipend": 12000, "extra": 0 }
```

Example:
```bash
curl -X PUT http://localhost:3001/api/settings \
  -H "Content-Type: application/json" \
  -d '{"stipend":13000,"extra":100}'
```

### Stats

#### GET `/api/stats`

Returns aggregated stats using MongoDB aggregation pipelines.

Example:
```bash
curl http://localhost:3001/api/stats
```

### Health

#### GET `/healthz`

Example:
```bash
curl http://localhost:3001/healthz
```
