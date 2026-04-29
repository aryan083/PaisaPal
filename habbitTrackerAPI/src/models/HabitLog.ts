import mongoose, { type Document, type Model, Schema } from 'mongoose'

export interface IHabitLog extends Document {
  userId: mongoose.Types.ObjectId
  habitId: mongoose.Types.ObjectId
  date: string       // YYYY-MM-DD string — NEVER a Date object
  completed: boolean
  value: number
  note?: string
  loggedAt: Date
}

const habitLogSchema = new Schema<IHabitLog>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    habitId: { type: Schema.Types.ObjectId, ref: 'Habit', required: true, index: true },
    date: {
      type: String,
      required: true,
      match: [/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'],
    },
    completed: { type: Boolean, required: true },
    value: { type: Number, default: 0 },
    note: { type: String, maxlength: 200 },
    loggedAt: { type: Date, default: () => new Date() },
  },
  {
    timestamps: false,
    toJSON: { virtuals: true, transform: (_doc, ret) => { delete ret.__v; return ret } },
  },
)

habitLogSchema.index({ habitId: 1, date: 1 }, { unique: true })
habitLogSchema.index({ userId: 1, date: 1 })
habitLogSchema.index({ habitId: 1, date: -1 })
habitLogSchema.index({ userId: 1, loggedAt: -1 })

const HabitLog: Model<IHabitLog> =
  mongoose.models.HabitLog ?? mongoose.model<IHabitLog>('HabitLog', habitLogSchema)

export default HabitLog
