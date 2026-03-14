import mongoose, { type Document, type Model, Schema } from 'mongoose';
import { type Category, type Mode } from './Transaction';

export type Frequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface IRecurringRule extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  particulars: string;
  amount: number;
  category: Category;
  mode: Mode;
  notes: string;
  frequency: Frequency;
  dayOfMonth?: number; // 1-31 for monthly/yearly
  dayOfWeek?: number; // 0-6 for weekly (0 = Sunday)
  startDate: Date;
  endDate?: Date;
  lastGenerated?: Date;
  nextDue: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const recurringRuleSchema = new Schema<IRecurringRule>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, maxlength: 100 },
    particulars: { type: String, required: true, maxlength: 200 },
    amount: { type: Number, required: true, min: 0 },
    category: {
      type: String,
      required: true,
      maxlength: 50,
    },
    mode: {
      type: String,
      required: true,
      enum: ['Online', 'Cash', 'Card'],
      default: 'Online',
    },
    notes: { type: String, default: '', maxlength: 500 },
    frequency: {
      type: String,
      required: true,
      enum: ['daily', 'weekly', 'monthly', 'yearly'],
    },
    dayOfMonth: { type: Number, min: 1, max: 31 },
    dayOfWeek: { type: Number, min: 0, max: 6 },
    startDate: { type: Date, required: true },
    endDate: { type: Date },
    lastGenerated: { type: Date },
    nextDue: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

recurringRuleSchema.index({ userId: 1, nextDue: 1, isActive: 1 });

const RecurringRule: Model<IRecurringRule> =
  mongoose.models.RecurringRule ?? mongoose.model<IRecurringRule>('RecurringRule', recurringRuleSchema);

export default RecurringRule;
