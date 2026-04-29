import mongoose, { type Document, type Model, Schema } from 'mongoose'

export interface ITransaction extends Document {
  userId: mongoose.Types.ObjectId
  date: Date
  dateKey: string
  particulars: string
  amount: number
  category: string
  mode: 'Online' | 'Cash' | 'Card'
  notes: string
  createdAt: Date
  updatedAt: Date
}

const transactionSchema = new Schema<ITransaction>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    date: { type: Date, required: true, index: true },
    dateKey: { type: String, required: true, index: true },
    particulars: { type: String, required: true, maxlength: 200 },
    amount: { type: Number, required: true, min: 0 },
    category: { type: String, required: true, maxlength: 50, index: true },
    mode: { type: String, required: true, enum: ['Online', 'Cash', 'Card'], default: 'Online' },
    notes: { type: String, default: '', maxlength: 500 },
  },
  { timestamps: true },
)

transactionSchema.index({ userId: 1, date: -1 })
transactionSchema.index({ userId: 1, dateKey: -1 })

// READ-ONLY from Habit Tracker — never write to this collection
const Transaction: Model<ITransaction> =
  mongoose.models.Transaction ?? mongoose.model<ITransaction>('Transaction', transactionSchema)

export default Transaction
