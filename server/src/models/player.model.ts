import mongoose from "mongoose";

export type PlayerFields = {
  user: mongoose.Types.ObjectId;
  profileKey: string;
  name: string;
  totalXp: number;
  completedTasks: number;
  streak: number;
  lastCompletedDate: Date | null;
};

export type PlayerDocument = mongoose.HydratedDocument<PlayerFields>;

const playerSchema = new mongoose.Schema<PlayerFields>(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Player owner is required"],
      unique: true,
      sparse: true,
      index: true,
    },
    profileKey: {
      type: String,
      required: true,
      unique: true,
      select: false,
    },
    name: {
      type: String,
      default: "Trailblazer",
      trim: true,
    },
    totalXp: {
      type: Number,
      default: 0,
      min: 0,
    },
    completedTasks: {
      type: Number,
      default: 0,
      min: 0,
    },
    streak: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastCompletedDate: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export const Player = mongoose.model("Player", playerSchema);
