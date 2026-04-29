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
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
      maxlength: 255,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    name: {
      type: String,
      required: true,
      maxlength: 100,
      trim: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret.passwordHash
        delete ret.__v
        return ret
      },
    },
  },
)

export const User = mongoose.models.User ?? mongoose.model<IUser>('User', UserSchema)
