import mongoose, { type Document, type Model, Schema } from 'mongoose';
import { type Category } from './Transaction';

export interface IBudget extends Document {
  category: Category;
  monthlyLimit: number;
  month: string; // Format: YYYY-MM
  createdAt: Date;
  updatedAt: Date;
}

const budgetSchema = new Schema<IBudget>(
  {
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
    },
    monthlyLimit: { type: Number, required: true, min: 0 },
    month: { type: String, required: true }, // YYYY-MM format
  },
  { timestamps: true },
);

budgetSchema.index({ category: 1, month: 1 }, { unique: true });

const Budget: Model<IBudget> =
  mongoose.models.Budget ?? mongoose.model<IBudget>('Budget', budgetSchema);

export default Budget;
