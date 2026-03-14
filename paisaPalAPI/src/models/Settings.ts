import mongoose, { type Model, Schema } from 'mongoose';

export interface ISettings {
  userId: mongoose.Types.ObjectId;
  stipend: number;
  extra: number;
  categoryConfig?: Array<{ name: string; color: string }>;
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
  },
  { timestamps: true },
);

const Settings: Model<ISettings> =
  mongoose.models.Settings ?? mongoose.model<ISettings>('Settings', settingsSchema);

export default Settings;
