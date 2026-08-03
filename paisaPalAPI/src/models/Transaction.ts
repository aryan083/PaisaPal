import mongoose, { type Document, type Model, Schema } from 'mongoose';

export type Category = string;

export type Mode = 'Online' | 'Cash' | 'Card';

export interface ITransaction extends Document {
  userId: mongoose.Types.ObjectId;
  date: Date;
  dateKey: string;
  particulars: string;
  amount: number;
  category: Category;
  modes: Mode[];
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

const transactionSchema = new Schema<ITransaction>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    date: { type: Date, required: true, index: true },
    dateKey: {
      type: String,
      required: true,
      index: true,
      default: function dateKeyDefault(this: { date?: Date }) {
        const d = this.date instanceof Date ? this.date : new Date();
        return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      },
    },
    particulars: { type: String, required: true, maxlength: 200 },
    amount: { type: Number, required: true, min: 0 },
    category: {
      type: String,
      required: true,
      maxlength: 50,
      index: true,
    },
    modes: {
      type: [String],
      required: true,
      enum: ['Online', 'Cash', 'Card'],
      default: ['Online'],
      validate: {
        validator: (v: string[]) => Array.isArray(v) && v.length > 0,
        message: 'At least one payment mode is required',
      },
    },
    notes: { type: String, default: '', maxlength: 500 },
  },
  { timestamps: true },
);

transactionSchema.index({ userId: 1, date: -1 });
transactionSchema.index({ userId: 1, dateKey: -1 });
transactionSchema.index({ userId: 1, category: 1 });

const Transaction: Model<ITransaction> =
  mongoose.models.Transaction ?? mongoose.model<ITransaction>('Transaction', transactionSchema);

export default Transaction;
