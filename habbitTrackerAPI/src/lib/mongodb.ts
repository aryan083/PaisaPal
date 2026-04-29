import mongoose from 'mongoose'

type MongooseCache = {
  conn: typeof mongoose | null
  promise: Promise<typeof mongoose> | null
}

declare global {
  // eslint-disable-next-line no-var
  var mongooseHabit: MongooseCache | undefined
}

const cached: MongooseCache = global.mongooseHabit ?? { conn: null, promise: null }
global.mongooseHabit = cached

export async function connectDB(): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) {
    cached.conn = mongoose
    return mongoose
  }

  if (mongoose.connection.readyState === 2) {
    await mongoose.connection.asPromise()
    cached.conn = mongoose
    return mongoose
  }

  if (cached.conn) {
    return cached.conn
  }

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not set')
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(process.env.MONGODB_URI, {
      bufferCommands: false,
    })
  }

  cached.conn = await cached.promise
  return cached.conn
}
