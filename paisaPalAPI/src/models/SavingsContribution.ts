import mongoose, { type Document, type Model, Schema } from 'mongoose';

export type ContributionType = 'manual' | 'surplus' | 'rapido_tax' | 'auto';

export interface ISavingsContribution extends Document {
  userId: mongoose.Types.ObjectId;
  goalId: mongoose.Types.ObjectId;
  amount: number;
  type: ContributionType;
  note?: string;
  transactionId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const savingsContributionSchema = new Schema<ISavingsContribution>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    goalId: { type: Schema.Types.ObjectId, ref: 'SavingsGoal', required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    type: {
      type: String,
      required: true,
      enum: ['manual', 'surplus', 'rapido_tax', 'auto'],
    },
    note: { type: String, maxlength: 500 },
    transactionId: { type: Schema.Types.ObjectId, ref: 'Transaction' },
  },
  { timestamps: true },
);

savingsContributionSchema.index({ userId: 1, goalId: 1, createdAt: -1 });

const SavingsContribution: Model<ISavingsContribution> =
  mongoose.models.SavingsContribution ??
  mongoose.model<ISavingsContribution>('SavingsContribution', savingsContributionSchema);

export default SavingsContribution;
