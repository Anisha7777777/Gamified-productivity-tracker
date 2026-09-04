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
    category: {
      type: String,
      trim: true,
      maxlength: [30, "Category cannot be longer than 30 characters"],
      default: null,
    },
    dueDate: {
      // Calendar dates stay as YYYY-MM-DD strings to avoid timezone shifts.
      type: String,
      default: null,
    },
    recurrence: {
      type: String,
      enum: ["none", "daily", "weekly", "monthly"],
      default: "none",
    },
    reminderTime: {
      // A local wall-clock time such as 09:00; the user timezone supplies context.
      type: String,
      default: null,
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
