import mongoose from "mongoose";

export type UserFields = {
  name: string;
  email: string;
  password: string;
  tokenVersion: number;
  passwordResetTokenHash?: string;
  passwordResetExpiresAt?: Date;
  emailVerified: boolean;
  emailVerificationTokenHash?: string;
  emailVerificationExpiresAt?: Date;
  timezone: string;
};

const userSchema = new mongoose.Schema<UserFields>(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: [80, "Name cannot be longer than 80 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      lowercase: true,
      trim: true,
      unique: true,
      index: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      select: false,
    },
    tokenVersion: {
      type: Number,
      default: 0,
      min: 0,
      select: false,
    },
    passwordResetTokenHash: {
      type: String,
      select: false,
    },
    passwordResetExpiresAt: {
      type: Date,
      select: false,
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationTokenHash: {
      type: String,
      select: false,
    },
    emailVerificationExpiresAt: {
      type: Date,
      select: false,
    },
    timezone: {
      type: String,
      default: "UTC",
    },
  },
  {
    timestamps: true,
  }
);

export const User = mongoose.model<UserFields>("User", userSchema);
