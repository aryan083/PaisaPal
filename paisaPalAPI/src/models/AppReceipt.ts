import mongoose, { type Document, type Model, Schema } from 'mongoose';

export type AppReceiptStatus = 'linked' | 'pending_bank' | 'needs_review' | 'dismissed';

export interface IAppReceipt extends Document {
  userId: mongoose.Types.ObjectId;
  /** sha256(app + subject + body) — same email forwarded twice is one key. */
  receiptHash: string;
  app: string;
  subject: string;
  body: string;
  orderDateKey: string | null;
  amount: number | null;
  orderId: string | null;
  linkedTransactionId: mongoose.Types.ObjectId | null;
  variance: number | null;
  status: AppReceiptStatus;
  parseError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const appReceiptSchema = new Schema<IAppReceipt>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    receiptHash: { type: String, required: true, maxlength: 128 },
    app: { type: String, required: true, maxlength: 32, index: true },
    subject: { type: String, required: true, maxlength: 300 },
    body: { type: String, required: true, maxlength: 8000 },
    orderDateKey: { type: String, default: null },
    amount: { type: Number, default: null },
    orderId: { type: String, default: null, maxlength: 64 },
    linkedTransactionId: { type: Schema.Types.ObjectId, ref: 'Transaction', default: null },
    variance: { type: Number, default: null },
    status: {
      type: String,
      required: true,
      enum: ['linked', 'pending_bank', 'needs_review', 'dismissed'],
      default: 'pending_bank',
    },
    parseError: { type: String, default: null, maxlength: 500 },
  },
  { timestamps: true },
);

appReceiptSchema.index({ userId: 1, receiptHash: 1 }, { unique: true });
appReceiptSchema.index({ userId: 1, app: 1, orderDateKey: -1 });

const AppReceipt: Model<IAppReceipt> =
  mongoose.models.AppReceipt ?? mongoose.model<IAppReceipt>('AppReceipt', appReceiptSchema);

export default AppReceipt;
