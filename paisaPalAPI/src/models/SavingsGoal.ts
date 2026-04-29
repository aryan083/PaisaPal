import mongoose, { type Document, type Model, Schema } from 'mongoose';

export type SavingsGoalStatus = 'active' | 'completed' | 'paused' | 'ended';

export interface ISavingsGoal extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  emoji: string;
  targetAmount: number;
  savedAmount: number;
  monthlyTarget: number;
  deadline?: Date;
  status: SavingsGoalStatus;
  color: string;
  createdAt: Date;
  updatedAt: Date;
}

const savingsGoalSchema = new Schema<ISavingsGoal>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, maxlength: 100 },
    emoji: { type: String, default: '🎯' },
    targetAmount: { type: Number, required: true, min: 1 },
    savedAmount: { type: Number, default: 0, min: 0 },
    monthlyTarget: { type: Number, default: 0, min: 0 },
    deadline: { type: Date },
    status: {
      type: String,
      enum: ['active', 'completed', 'paused', 'ended'],
      default: 'active',
      index: true,
    },
    color: {
      type: String,
      required: true,
      match: /^#([0-9a-fA-F]{6})$/,
      default: '#22d47a',
    },
  },
  { timestamps: true },
);

savingsGoalSchema.index({ userId: 1, status: 1, deadline: 1 });

const SavingsGoal: Model<ISavingsGoal> =
  mongoose.models.SavingsGoal ??
  mongoose.model<ISavingsGoal>('SavingsGoal', savingsGoalSchema);

export default SavingsGoal;
