import mongoose from "mongoose";

const taskSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Task owner is required"],
      index: true,
    },
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: [120, "Title cannot be longer than 120 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot be longer than 500 characters"],
      default: "",
    },
    completed: {
      type: Boolean,
      default: false,
    },
    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"],
      default: "medium",
    },
    xpReward: {
      type: Number,
      default: 25,
      min: 0,
    },
    awardedXp: {
      type: Number,
      default: 0,
      min: 0,
      select: false,
    },
  },
  {
    timestamps: true,
  }
);

export const Task = mongoose.model("Task", taskSchema);
