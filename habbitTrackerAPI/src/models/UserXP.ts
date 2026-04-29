import mongoose, { type Document, type Model, Schema } from 'mongoose'

export interface IXPEvent {
  date: string
  amount: number
  reason: string
  source: 'habit' | 'finance' | 'badge' | 'streak'
}

export interface IUserXP extends Document {
  userId: mongoose.Types.ObjectId
  totalXP: number
  level: number
  currentLevelXP: number
  nextLevelXP: number
  xpHistory: IXPEvent[]
  updatedAt: Date
}

const xpEventSchema = new Schema<IXPEvent>({
  date: { type: String, required: true },
  amount: { type: Number, required: true },
  reason: { type: String, required: true },
  source: { type: String, enum: ['habit', 'finance', 'badge', 'streak'], required: true },
}, { _id: false })

const userXPSchema = new Schema<IUserXP>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    totalXP: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    currentLevelXP: { type: Number, default: 0 },
    nextLevelXP: { type: Number, default: 100 },
    xpHistory: { type: [xpEventSchema], default: [] },
  },
  {
    timestamps: { updatedAt: true, createdAt: false },
    toJSON: { virtuals: true, transform: (_doc, ret) => { delete ret.__v; return ret } },
  },
)

const UserXP: Model<IUserXP> =
  mongoose.models.UserXP ?? mongoose.model<IUserXP>('UserXP', userXPSchema)

export default UserXP
