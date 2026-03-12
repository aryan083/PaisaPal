import mongoose, { type Model, Schema } from 'mongoose';

export interface ISettings {
  userId: mongoose.Types.ObjectId;
  stipend: number;
  extra: number;
  createdAt: Date;
  updatedAt: Date;
}

const settingsSchema = new Schema<ISettings>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    stipend: { type: Number, default: 12000 },
    extra: { type: Number, default: 0 },
  },
  { timestamps: true },
);

const Settings: Model<ISettings> =
  mongoose.models.Settings ?? mongoose.model<ISettings>('Settings', settingsSchema);

export default Settings;
