import mongoose, { type Model, Schema } from 'mongoose';

export interface ISettings {
  _id: 'default';
  stipend: number;
  extra: number;
}

const settingsSchema = new Schema<ISettings>(
  {
    _id: { type: String, required: true, default: 'default' },
    stipend: { type: Number, default: 12000 },
    extra: { type: Number, default: 0 },
  },
  { timestamps: false },
);

const Settings: Model<ISettings> =
  mongoose.models.Settings ?? mongoose.model<ISettings>('Settings', settingsSchema);

export default Settings;
