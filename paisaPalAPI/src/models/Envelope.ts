import mongoose, { type Document, type Model, Schema } from 'mongoose';

export type EnvelopeStatus = 'under' | 'warning' | 'over';
export type SurplusAction = 'save' | 'split' | 'carry' | 'pending';

export type EnvelopeItem = {
  _id?: mongoose.Types.ObjectId;
  category: string;
  limit: number;
  spent: number;
  status: EnvelopeStatus;
};

export interface IEnvelope extends Document {
  userId: mongoose.Types.ObjectId;
  month: string;
  envelopes: EnvelopeItem[];
  surplusAmount: number;
  surplusAction: SurplusAction;
  savingsGoalId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const envelopeItemSchema = new Schema<EnvelopeItem>(
  {
    category: { type: String, required: true, maxlength: 50 },
    limit: { type: Number, required: true, min: 0 },
    spent: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ['under', 'warning', 'over'], default: 'under' },
  },
  { _id: true },
);

const envelopeSchema = new Schema<IEnvelope>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    month: { type: String, required: true, match: /^\d{4}-\d{2}$/, index: true },
    envelopes: { type: [envelopeItemSchema], default: [] },
    surplusAmount: { type: Number, default: 0 },
    surplusAction: {
      type: String,
      enum: ['save', 'split', 'carry', 'pending'],
      default: 'pending',
    },
    savingsGoalId: { type: Schema.Types.ObjectId, ref: 'SavingsGoal' },
  },
  { timestamps: true },
);

envelopeSchema.index({ userId: 1, month: 1 }, { unique: true });

const Envelope: Model<IEnvelope> =
  mongoose.models.Envelope ?? mongoose.model<IEnvelope>('Envelope', envelopeSchema);

export default Envelope;
