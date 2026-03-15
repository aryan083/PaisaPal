import mongoose, { type Model, Schema } from 'mongoose';

export interface ISettings {
  userId: mongoose.Types.ObjectId;
  stipend: number;
  extra: number;
  categoryConfig?: Array<{ name: string; color: string }>;
  rapidoTaxEnabled?: boolean;
  rapidoTaxPercent?: number;
  primarySavingsGoalId?: mongoose.Types.ObjectId;
  monthEndReminderEnabled?: boolean;
  envelopeWarningThreshold?: number;
  createdAt: Date;
  updatedAt: Date;
}

const settingsSchema = new Schema<ISettings>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    stipend: { type: Number, default: 12000 },
    extra: { type: Number, default: 0 },
    categoryConfig: {
      type: [
        {
          name: { type: String, required: true, maxlength: 50 },
          color: { type: String, required: true, match: /^#([0-9a-fA-F]{6})$/ },
        },
      ],
      default: undefined,
    },
    rapidoTaxEnabled: { type: Boolean, default: false },
    rapidoTaxPercent: { type: Number, default: 10, min: 5, max: 25 },
    primarySavingsGoalId: { type: Schema.Types.ObjectId, ref: 'SavingsGoal' },
    monthEndReminderEnabled: { type: Boolean, default: false },
    envelopeWarningThreshold: { type: Number, default: 80, min: 50, max: 95 },
  },
  { timestamps: true },
);

const Settings: Model<ISettings> =
  mongoose.models.Settings ?? mongoose.model<ISettings>('Settings', settingsSchema);

export default Settings;
