import mongoose, { type Document, type Model, Schema } from 'mongoose'

// Read-only Settings model for Paisa Tracker crossover
export interface ISettings extends Document {
  userId: mongoose.Types.ObjectId
  stipend: number
  extra: number
  primarySavingsGoalId?: mongoose.Types.ObjectId
}

const settingsSchema = new Schema<ISettings>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    stipend: { type: Number, default: 12000 },
    extra: { type: Number, default: 0 },
    primarySavingsGoalId: { type: Schema.Types.ObjectId },
  },
  { timestamps: true },
)

const Settings: Model<ISettings> =
  mongoose.models.Settings ?? mongoose.model<ISettings>('Settings', settingsSchema)

export default Settings
