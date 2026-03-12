import mongoose, { Schema, Document } from 'mongoose'

export interface IUser extends Document {
  email: string
  passwordHash: string
  name: string
  createdAt: Date
  updatedAt: Date
}

const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
      maxlength: 255,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email format'],
    },
    passwordHash: {
      type: String,
      required: [true, 'Password is required'],
      select: false,
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      maxlength: 100,
      trim: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete ret.passwordHash
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete ret.__v
        return ret
      },
    },
  }
)

// UserSchema.index({ email: 1 })

export const User = mongoose.models.User || mongoose.model<IUser>('User', UserSchema)
