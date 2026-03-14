import mongoose, { type Document, type Model, Schema } from 'mongoose';
import { type Category } from './Transaction';

export interface IBudget extends Document {
  userId: mongoose.Types.ObjectId;
  category: Category;
  monthlyLimit: number;
  month: string; // Format: YYYY-MM
  createdAt: Date;
  updatedAt: Date;
}

const budgetSchema = new Schema<IBudget>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    category: {
      type: String,
      required: true,
      maxlength: 50,
    },
    monthlyLimit: { type: Number, required: true, min: 0 },
    month: { type: String, required: true }, // YYYY-MM format
  },
  { timestamps: true },
);

budgetSchema.index({ userId: 1, category: 1, month: 1 }, { unique: true });

const Budget: Model<IBudget> =
  mongoose.models.Budget ?? mongoose.model<IBudget>('Budget', budgetSchema);

export default Budget;
