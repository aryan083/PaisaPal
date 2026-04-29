import mongoose, { type Document, type Model, Schema } from 'mongoose'

// Read-only SavingsGoal model for Paisa Tracker crossover
export interface ISavingsGoal extends Document {
  userId: mongoose.Types.ObjectId
  name: string
  emoji: string
  targetAmount: number
  savedAmount: number
  status: 'active' | 'completed' | 'paused' | 'ended'
}

const savingsGoalSchema = new Schema<ISavingsGoal>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String },
    emoji: { type: String },
    targetAmount: { type: Number },
    savedAmount: { type: Number, default: 0 },
    status: { type: String, enum: ['active', 'completed', 'paused', 'ended'], default: 'active' },
  },
  { timestamps: true },
)

const SavingsGoal: Model<ISavingsGoal> =
  mongoose.models.SavingsGoal ?? mongoose.model<ISavingsGoal>('SavingsGoal', savingsGoalSchema)

export default SavingsGoal
