import mongoose, { type Document, type Model, Schema } from 'mongoose';

export type Frequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly';
export type RecurringStatus = 'active' | 'paused' | 'ended';

export type Mode = 'Online' | 'Cash' | 'Card';

export interface IRecurringTransaction extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  particulars?: string;
  amount: number;
  category: string;
  mode: Mode;
  notes?: string;
  frequency: Frequency;
  dayOfMonth?: number;
  dayOfWeek?: number;
  startDate: Date;
  endDate?: Date;
  lastPaidDate?: Date;
  nextDueDate: Date;
  status: RecurringStatus;
  autoDetected: boolean;
  autoGenerate?: boolean;
  occurrences: number;
  totalPaid: number;
  createdAt: Date;
  updatedAt: Date;
}

const recurringTransactionSchema = new Schema<IRecurringTransaction>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, maxlength: 200 },
    amount: { type: Number, required: true, min: 0 },
    category: { type: String, required: true, maxlength: 50, index: true },
    mode: { type: String, enum: ['Online', 'Cash', 'Card'], default: 'Online' },
    notes: { type: String, maxlength: 500 },
    particulars: { type: String, maxlength: 200 },
    frequency: {
      type: String,
      required: true,
      enum: ['daily', 'weekly', 'biweekly', 'monthly', 'yearly'],
    },
    dayOfMonth: { type: Number, min: 1, max: 31 },
    dayOfWeek: { type: Number, min: 0, max: 6 },
    startDate: { type: Date, required: true },
    endDate: { type: Date },
    lastPaidDate: { type: Date },
    nextDueDate: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: ['active', 'paused', 'ended'],
      default: 'active',
      index: true,
    },
    autoDetected: { type: Boolean, default: false },
    autoGenerate: { type: Boolean, default: false },
    occurrences: { type: Number, default: 0, min: 0 },
    totalPaid: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

recurringTransactionSchema.index({ userId: 1, status: 1, nextDueDate: 1 });

const RecurringTransaction: Model<IRecurringTransaction> =
  mongoose.models.RecurringTransaction ??
  mongoose.model<IRecurringTransaction>('RecurringTransaction', recurringTransactionSchema);

export default RecurringTransaction;
