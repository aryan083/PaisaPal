import mongoose, { Schema, Document } from 'mongoose'

export interface IIdempotencyKey extends Document {
  key: string
  userId: mongoose.Types.ObjectId
  response: Record<string, unknown>
  createdAt: Date
}

const IdempotencyKeySchema = new Schema<IIdempotencyKey>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
    response: {
      type: Schema.Types.Mixed,
      required: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
)

IdempotencyKeySchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 })

export const IdempotencyKey = mongoose.models.IdempotencyKey || mongoose.model<IIdempotencyKey>('IdempotencyKey', IdempotencyKeySchema)
