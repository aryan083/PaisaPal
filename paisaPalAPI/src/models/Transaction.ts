import mongoose, { type Document, type Model, Schema } from 'mongoose';

export type Category =
  | 'Rapido'
  | 'Bus/GSRTC'
  | 'Food & Drinks'
  | 'Shopping'
  | 'Social'
  | 'Recharge/Bills'
  | 'Self Care'
  | 'Transfer/Sent'
  | 'Other';

export type Mode = 'Online' | 'Cash';

export interface ITransaction extends Document {
  date: Date;
  particulars: string;
  amount: number;
  category: Category;
  mode: Mode;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

const transactionSchema = new Schema<ITransaction>(
  {
    date: { type: Date, required: true, index: true },
    particulars: { type: String, required: true, maxlength: 200 },
    amount: { type: Number, required: true, min: 0 },
    category: {
      type: String,
      required: true,
      enum: [
        'Rapido',
        'Bus/GSRTC',
        'Food & Drinks',
        'Shopping',
        'Social',
        'Recharge/Bills',
        'Self Care',
        'Transfer/Sent',
        'Other',
      ],
      index: true,
    },
    mode: {
      type: String,
      required: true,
      enum: ['Online', 'Cash'],
      default: 'Online',
    },
    notes: { type: String, default: '', maxlength: 500 },
  },
  { timestamps: true },
);

const Transaction: Model<ITransaction> =
  mongoose.models.Transaction ?? mongoose.model<ITransaction>('Transaction', transactionSchema);

export default Transaction;
