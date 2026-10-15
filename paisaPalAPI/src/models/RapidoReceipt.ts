import mongoose, { type Document, type Model, Schema } from 'mongoose';

export type RapidoReceiptStatus = 'linked' | 'pending_bank' | 'needs_review' | 'dismissed';

export interface IRapidoReceipt extends Document {
  userId: mongoose.Types.ObjectId;
  /** sha256(subject + '\n' + body) — same email forwarded twice is the same key. */
  receiptHash: string;
  subject: string;
  body: string;
  rideDateKey: string | null;
  rapidoAmount: number | null;
  claimedMode: string | null;
  receiptId: string | null;
  /** Bank Transaction this receipt reconciled against (bank = truth). */
  linkedTransactionId: mongoose.Types.ObjectId | null;
  /** bankAmount - rapidoAmount when linked (driver extra etc.). */
  variance: number | null;
  status: RapidoReceiptStatus;
  parseError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const rapidoReceiptSchema = new Schema<IRapidoReceipt>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    receiptHash: { type: String, required: true, maxlength: 128 },
    subject: { type: String, required: true, maxlength: 300 },
    body: { type: String, required: true, maxlength: 8000 },
    rideDateKey: { type: String, default: null },
    rapidoAmount: { type: Number, default: null },
    claimedMode: { type: String, default: null, maxlength: 32 },
    receiptId: { type: String, default: null, maxlength: 64 },
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

rapidoReceiptSchema.index({ userId: 1, receiptHash: 1 }, { unique: true });
rapidoReceiptSchema.index({ userId: 1, rideDateKey: -1 });

const RapidoReceipt: Model<IRapidoReceipt> =
  mongoose.models.RapidoReceipt ??
  mongoose.model<IRapidoReceipt>('RapidoReceipt', rapidoReceiptSchema);

export default RapidoReceipt;
