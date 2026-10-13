import mongoose, { type Document, type Model, Schema } from 'mongoose';

export type SmsInboxStatus = 'posted' | 'duplicate' | 'needs_review';

export interface ISmsInbox extends Document {
  userId: mongoose.Types.ObjectId;
  /** sha256(sender + '\n' + body) — same SMS forwarded twice is the same key. */
  bodyHash: string;
  sender: string;
  body: string;
  direction: string | null;
  amount: number | null;
  dateKey: string | null;
  upiRef: string | null;
  status: SmsInboxStatus;
  transactionId: mongoose.Types.ObjectId | null;
  parseError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const smsInboxSchema = new Schema<ISmsInbox>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    bodyHash: { type: String, required: true, maxlength: 128 },
    sender: { type: String, required: true, maxlength: 64 },
    body: { type: String, required: true, maxlength: 2000 },
    direction: { type: String, default: null },
    amount: { type: Number, default: null },
    dateKey: { type: String, default: null },
    upiRef: { type: String, default: null, maxlength: 64 },
    status: {
      type: String,
      required: true,
      enum: ['posted', 'duplicate', 'needs_review'],
      default: 'posted',
    },
    transactionId: { type: Schema.Types.ObjectId, ref: 'Transaction', default: null },
    parseError: { type: String, default: null, maxlength: 500 },
  },
  { timestamps: true },
);

// Same SMS (same hash) for the same user is processed once.
smsInboxSchema.index({ userId: 1, bodyHash: 1 }, { unique: true });
smsInboxSchema.index({ userId: 1, dateKey: -1 });

const SmsInbox: Model<ISmsInbox> =
  mongoose.models.SmsInbox ?? mongoose.model<ISmsInbox>('SmsInbox', smsInboxSchema);

export default SmsInbox;
