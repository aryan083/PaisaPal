import mongoose, { type Document, type Model, Schema } from 'mongoose'

export interface IHabitCategory extends Document {
  userId: mongoose.Types.ObjectId
  name: string
  icon: string
  color: string
  order: number
  isDefault: boolean
  createdAt: Date
}

const habitCategorySchema = new Schema<IHabitCategory>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, maxlength: 50, trim: true },
    icon: { type: String, default: '🎯' },
    color: { type: String, default: '#7c6aff' },
    order: { type: Number, default: 0 },
    isDefault: { type: Boolean, default: false },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: { virtuals: true, transform: (_doc, ret) => { delete ret.__v; return ret } },
  },
)

habitCategorySchema.index({ userId: 1, order: 1 })

const HabitCategory: Model<IHabitCategory> =
  mongoose.models.HabitCategory ?? mongoose.model<IHabitCategory>('HabitCategory', habitCategorySchema)

export default HabitCategory

export const DEFAULT_CATEGORIES = [
  { name: 'Health',       icon: '❤️',  color: '#ff4f6a', order: 0 },
  { name: 'Fitness',      icon: '💪',  color: '#ff6b35', order: 1 },
  { name: 'Study',        icon: '📚',  color: '#4da6ff', order: 2 },
  { name: 'Productivity', icon: '⚡',  color: '#ffaa2b', order: 3 },
  { name: 'Mindfulness',  icon: '🧘',  color: '#b06aff', order: 4 },
  { name: 'Finance',      icon: '💰',  color: '#00d4a4', order: 5 },
  { name: 'Social',       icon: '👥',  color: '#ff80c8', order: 6 },
  { name: 'Other',        icon: '🎯',  color: '#6080a0', order: 7 },
]

export async function seedDefaultCategories(userId: string): Promise<IHabitCategory[]> {
  const docs = DEFAULT_CATEGORIES.map((c) => ({
    userId,
    ...c,
    isDefault: true,
  }))
  return HabitCategory.insertMany(docs)
}
