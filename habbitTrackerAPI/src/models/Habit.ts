import mongoose, { type Document, type Model, Schema } from 'mongoose'

export interface IHabit extends Document {
  userId: mongoose.Types.ObjectId
  categoryId: mongoose.Types.ObjectId
  name: string
  description?: string
  icon: string
  color: string
  trackingType: 'boolean' | 'count' | 'duration'
  targetValue: number
  targetUnit?: string
  frequency: 'daily' | 'weekdays' | 'weekends' | 'custom'
  customDays: number[]
  difficulty: 'easy' | 'medium' | 'hard'
  reminderTime?: string
  isArchived: boolean
  order: number
  currentStreak: number
  longestStreak: number
  totalCompletions: number
  totalAttempts: number
  createdAt: Date
  updatedAt: Date
}

const habitSchema = new Schema<IHabit>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    categoryId: { type: Schema.Types.ObjectId, ref: 'HabitCategory', required: true, index: true },
    name: { type: String, required: true, maxlength: 100, trim: true },
    description: { type: String, maxlength: 300 },
    icon: { type: String, default: '✅' },
    color: { type: String, default: '#7c6aff' },
    trackingType: {
      type: String,
      enum: ['boolean', 'count', 'duration'],
      required: true,
      default: 'boolean',
    },
    targetValue: { type: Number, default: 1, min: 1 },
    targetUnit: { type: String, maxlength: 20 },
    frequency: {
      type: String,
      enum: ['daily', 'weekdays', 'weekends', 'custom'],
      required: true,
      default: 'daily',
    },
    customDays: { type: [Number], default: [] },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      default: 'medium',
    },
    reminderTime: { type: String },
    isArchived: { type: Boolean, default: false, index: true },
    order: { type: Number, default: 0 },
    // Denormalized fields — updated after every log
    currentStreak: { type: Number, default: 0 },
    longestStreak: { type: Number, default: 0 },
    totalCompletions: { type: Number, default: 0 },
    totalAttempts: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, transform: (_doc, ret) => { delete ret.__v; return ret } },
  },
)

habitSchema.index({ userId: 1, isArchived: 1 })
habitSchema.index({ userId: 1, categoryId: 1 })
habitSchema.index({ userId: 1, order: 1 })

const Habit: Model<IHabit> =
  mongoose.models.Habit ?? mongoose.model<IHabit>('Habit', habitSchema)

export default Habit
