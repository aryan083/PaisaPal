import mongoose, { type Document, type Model, Schema } from 'mongoose'

export type BadgeType =
  | 'FIRST_HABIT'
  | 'FIRST_LOG'
  | 'STREAK_7'
  | 'STREAK_30'
  | 'STREAK_100'
  | 'PERFECT_WEEK'
  | 'PERFECT_MONTH'
  | 'EARLY_BIRD'
  | 'NIGHT_OWL'
  | 'CATEGORY_MASTER'
  | 'COMEBACK_KID'
  | 'MULTITASKER'
  | 'CONSISTENCY_KING'
  | 'BUDGET_DISCIPLINE'
  | 'SAVINGS_HERO'
  | 'NO_SPEND_WARRIOR'
  | 'MIND_AND_MONEY'

export interface IBadge extends Document {
  userId: mongoose.Types.ObjectId
  badgeType: BadgeType
  habitId?: mongoose.Types.ObjectId
  earnedAt: Date
  metadata?: Record<string, unknown>
}

const badgeSchema = new Schema<IBadge>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    badgeType: { type: String, required: true },
    habitId: { type: Schema.Types.ObjectId, ref: 'Habit' },
    earnedAt: { type: Date, default: () => new Date() },
    metadata: { type: Schema.Types.Mixed },
  },
  {
    timestamps: false,
    toJSON: { virtuals: true, transform: (_doc, ret) => { delete ret.__v; return ret } },
  },
)

badgeSchema.index({ userId: 1, badgeType: 1, habitId: 1 })

const Badge: Model<IBadge> =
  mongoose.models.Badge ?? mongoose.model<IBadge>('Badge', badgeSchema)

export default Badge
