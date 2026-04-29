import fs from 'node:fs'
import path from 'node:path'
import dotenv from 'dotenv'

const envPath = path.resolve(process.cwd(), '.env.local')
const envFallback = path.resolve(process.cwd(), '.env')

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath })
} else {
  dotenv.config({ path: envFallback })
}

import app from './index'

const port = Number(process.env.PORT ?? 3001)

app.listen(port, () => {
  console.log(`Habit Tracker API listening on port ${port}`)
})
