import mongoose from "mongoose";
import {
  Player,
  type PlayerDocument,
} from "../models/player.model";

const XP_PER_LEVEL = 100;
const ONE_DAY_IN_MS = 24 * 60 * 60 * 1000;

export const getOrCreatePlayer = async (
  userId: string,
  session?: mongoose.ClientSession
) => {
  const userObjectId = new mongoose.Types.ObjectId(userId);
  const query = Player.findOneAndUpdate(
    { user: userObjectId },
    {
      $setOnInsert: {
        user: userObjectId,
        profileKey: `user:${userId}`,
      },
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    }
  );

  if (session) {
    query.session(session);
  }

  return query;
};

const startOfUtcDay = (date: Date) =>
  Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());

const calculateStreak = (
  currentStreak: number,
  lastCompletedDate: Date | null,
  completedAt: Date
) => {
  if (!lastCompletedDate) {
    return 1;
  }

  const daysSinceLastCompletion =
    (startOfUtcDay(completedAt) - startOfUtcDay(lastCompletedDate)) /
    ONE_DAY_IN_MS;

  // UTC is used because the player does not store a timezone yet.
  if (daysSinceLastCompletion === 0) {
    return Math.max(1, currentStreak);
  }

  if (daysSinceLastCompletion === 1) {
    return currentStreak + 1;
  }

  return 1;
};

export const applyCompletionToPlayer = async ({
  userId,
  completed,
  xpReward,
  session,
}: {
  userId: string;
  completed: boolean;
  xpReward: number;
  session: mongoose.ClientSession;
}) => {
  const player = await getOrCreatePlayer(userId, session);

  if (completed) {
    const completedAt = new Date();
    player.totalXp += xpReward;
    player.completedTasks += 1;
    player.streak = calculateStreak(
      player.streak,
      player.lastCompletedDate,
      completedAt
    );
    player.lastCompletedDate = completedAt;
  } else {
    player.totalXp = Math.max(0, player.totalXp - xpReward);
    player.completedTasks = Math.max(0, player.completedTasks - 1);

    // Streak is intentionally not rolled back. With only one last-completed
    // date, we cannot know whether this task created that day's streak.
  }

  await player.save({ session });
  return player;
};

export const toPlayerResponse = (player: PlayerDocument) => ({
  ...player.toObject(),
  level: Math.floor(player.totalXp / XP_PER_LEVEL) + 1,
  currentLevelXp: player.totalXp % XP_PER_LEVEL,
  xpForNextLevel: XP_PER_LEVEL,
});
