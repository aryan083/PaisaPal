import mongoose, { Schema, Document } from 'mongoose'

export interface IAuditLog extends Document {
  userId: mongoose.Types.ObjectId
  action: 'CREATE' | 'UPDATE' | 'DELETE'
  resource: 'transaction' | 'settings' | 'budget' | 'recurring'
  resourceId: string
  before?: Record<string, unknown>
  after?: Record<string, unknown>
  metadata: {
    ip?: string
    userAgent?: string
  }
  createdAt: Date
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'User',
      index: true,
    },
    action: {
      type: String,
      required: true,
      enum: ['CREATE', 'UPDATE', 'DELETE'],
    },
    resource: {
      type: String,
      required: true,
      enum: ['transaction', 'settings', 'budget', 'recurring'],
    },
    resourceId: {
      type: String,
      required: true,
    },
    before: {
      type: Schema.Types.Mixed,
    },
    after: {
      type: Schema.Types.Mixed,
    },
    metadata: {
      ip: String,
      userAgent: String,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
)

AuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 })

export const AuditLog = mongoose.models.AuditLog || mongoose.model<IAuditLog>('AuditLog', AuditLogSchema)
