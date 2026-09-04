import type { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import { Task } from "../models/task.model";
import type { PlayerDocument } from "../models/player.model";
import {
  adjustPlayerXp,
  applyCompletionToPlayer,
  getOrCreatePlayer,
  toPlayerResponse,
} from "../services/player.service";
import {
  getNextRecurringDueDate,
  isCalendarDate,
  isRecurrence,
  isReminderTime,
  type Recurrence,
} from "../services/task-planning.service";

const xpByDifficulty = {
  easy: 10,
  medium: 25,
  hard: 50,
} as const;

type Difficulty = keyof typeof xpByDifficulty;

const isDifficulty = (value: unknown): value is Difficulty => {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(xpByDifficulty, value)
  );
};

const allowedFields = new Set([
  "title",
  "description",
  "category",
  "dueDate",
  "recurrence",
  "reminderTime",
  "completed",
  "difficulty",
]);

const validatePlanningCombination = ({
  dueDate,
  recurrence,
  reminderTime,
}: {
  dueDate: string | null;
  recurrence: Recurrence;
  reminderTime: string | null;
}) => {
  if (recurrence !== "none" && !dueDate) {
    return "A recurring task needs a due date";
  }

  if (reminderTime && !dueDate) {
    return "A reminder needs a due date";
  }

  return null;
};

const validateTaskBody = (
  body: unknown,
  options: { requireTitle?: boolean } = {}
): string | null => {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return "Request body must be an object";
  }

  const values = body as Record<string, unknown>;
  const fields = Object.keys(values);

  if (fields.some((field) => !allowedFields.has(field))) {
    return "Only title, description, category, dueDate, recurrence, reminderTime, completed, and difficulty can be changed";
  }

  if (options.requireTitle && !("title" in values)) {
    return "Title is required";
  }

  if ("title" in values) {
    if (typeof values.title !== "string" || !values.title.trim()) {
      return "Title must be a non-empty string";
    }

    if (values.title.trim().length > 120) {
      return "Title cannot be longer than 120 characters";
    }
  }

  if (
    "description" in values &&
    (typeof values.description !== "string" ||
      values.description.length > 500)
  ) {
    return "Description must be a string of 500 characters or fewer";
  }

  if (
    "category" in values &&
    values.category !== null &&
    (typeof values.category !== "string" ||
      !values.category.trim() ||
      values.category.trim().length > 30)
  ) {
    return "Category must be a non-empty string of 30 characters or fewer";
  }

  if (
    "dueDate" in values &&
    values.dueDate !== null &&
    (typeof values.dueDate !== "string" || !isCalendarDate(values.dueDate))
  ) {
    return "Due date must be a real calendar date in YYYY-MM-DD format";
  }

  if ("recurrence" in values && !isRecurrence(values.recurrence)) {
    return "Recurrence must be none, daily, weekly, or monthly";
  }

  if (
    "reminderTime" in values &&
    values.reminderTime !== null &&
    (typeof values.reminderTime !== "string" || !isReminderTime(values.reminderTime))
  ) {
    return "Reminder time must use 24-hour HH:mm format";
  }

  if (options.requireTitle) {
    const planningError = validatePlanningCombination({
      dueDate: typeof values.dueDate === "string" ? values.dueDate : null,
      recurrence: isRecurrence(values.recurrence) ? values.recurrence : "none",
      reminderTime:
        typeof values.reminderTime === "string" ? values.reminderTime : null,
    });

    if (planningError) return planningError;
  }

  if ("completed" in values && typeof values.completed !== "boolean") {
    return "Completed must be true or false";
  }

  if ("difficulty" in values && !isDifficulty(values.difficulty)) {
    return "Difficulty must be easy, medium, or hard";
  }

  return null;
};

const buildTaskFilters = (query: Request["query"]) => {
  const status = query.status;
  const difficulty = query.difficulty;
  const category = query.category;

  if (status !== undefined && status !== "all" && status !== "active" && status !== "completed") {
    return { error: "Status must be all, active, or completed" };
  }

  if (difficulty !== undefined && !isDifficulty(difficulty)) {
    return { error: "Difficulty must be easy, medium, or hard" };
  }

  if (
    category !== undefined &&
    (typeof category !== "string" || !category.trim() || category.trim().length > 30)
  ) {
    return { error: "Category must be a non-empty value of 30 characters or fewer" };
  }

  const filters: {
    completed?: boolean;
    difficulty?: Difficulty;
    category?: string;
  } = {};

  if (status === "active") filters.completed = false;
  if (status === "completed") filters.completed = true;
  if (isDifficulty(difficulty)) filters.difficulty = difficulty;
  if (typeof category === "string") filters.category = category.trim();

  return { filters };
};

const getTaskId = (value: string | string[] | undefined) => {
  return typeof value === "string" &&
    mongoose.isObjectIdOrHexString(value)
    ? value
    : null;
};

const getAuthenticatedUserId = (req: Request) => {
  if (!req.userId) {
    throw new Error("Authenticated user ID is missing");
  }

  return req.userId;
};

export const createTask = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const validationError = validateTaskBody(req.body, {
      requireTitle: true,
    });

    if (validationError) {
      res.status(400).json({ message: validationError });
      return;
    }

    const requestBody = req.body as Record<string, unknown>;
    const difficulty = (requestBody.difficulty ?? "medium") as Difficulty;
    const category =
      typeof requestBody.category === "string"
        ? requestBody.category.trim()
        : null;
    const recurrence = isRecurrence(requestBody.recurrence)
      ? requestBody.recurrence
      : "none";
    const reminderTime =
      typeof requestBody.reminderTime === "string"
        ? requestBody.reminderTime
        : null;

    const task = await Task.create({
      ...requestBody,
      user: userId,
      category,
      recurrence,
      reminderTime,
      difficulty,
      xpReward: xpByDifficulty[difficulty],
    });

    res.status(201).json(task);
  } catch (error) {
    next(error);
  }
};

export const listTasks = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const taskFilters = buildTaskFilters(req.query);

    if ("error" in taskFilters) {
      res.status(400).json({ message: taskFilters.error });
      return;
    }

    const tasks = await Task.find({ user: userId, ...taskFilters.filters }).sort({
      createdAt: -1,
    });

    res.json(tasks);
  } catch (error) {
    next(error);
  }
};

export const getTask = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const id = getTaskId(req.params.id);

    if (!id) {
      res.status(400).json({ message: "Invalid task id" });
      return;
    }

    const task = await Task.findOne({ _id: id, user: userId });

    if (!task) {
      res.status(404).json({ message: "Task not found" });
      return;
    }

    res.json(task);
  } catch (error) {
    next(error);
  }
};

export const updateTask = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const id = getTaskId(req.params.id);

    if (!id) {
      res.status(400).json({ message: "Invalid task id" });
      return;
    }

    const validationError = validateTaskBody(req.body);

    if (validationError) {
      res.status(400).json({ message: validationError });
      return;
    }

    if (Object.keys(req.body).length === 0) {
      res.status(400).json({
        message: "Provide at least one field to update",
      });
      return;
    }

    const updates: Record<string, unknown> = {
      ...req.body,
    };

    if (typeof updates.category === "string") {
      updates.category = updates.category.trim();
    }

    if (isDifficulty(updates.difficulty)) {
      updates.xpReward = xpByDifficulty[updates.difficulty];
    }

    const session = await mongoose.startSession();
    let updatedTask;
    let updatedPlayer: PlayerDocument | undefined;
    let recurringTask: unknown = null;
    let taskWasFound = true;
    let planningValidationError: string | null = null;

    try {
      await session.withTransaction(async () => {
        const existingTask = await Task.findOne({ _id: id, user: userId })
          .select("+awardedXp")
          .session(session);

        if (!existingTask) {
          taskWasFound = false;
          return;
        }

        const effectiveDueDate =
          typeof updates.dueDate === "string"
            ? updates.dueDate
            : updates.dueDate === null
              ? null
              : existingTask.dueDate ?? null;
        const effectiveRecurrence = isRecurrence(updates.recurrence)
          ? updates.recurrence
          : isRecurrence(existingTask.recurrence)
            ? existingTask.recurrence
            : "none";
        const effectiveReminderTime =
          typeof updates.reminderTime === "string"
            ? updates.reminderTime
            : updates.reminderTime === null
              ? null
              : existingTask.reminderTime ?? null;
        planningValidationError = validatePlanningCombination({
          dueDate: effectiveDueDate,
          recurrence: effectiveRecurrence,
          reminderTime: effectiveReminderTime,
        });

        if (planningValidationError) return;

        const completionWasRequested = typeof updates.completed === "boolean";
        const targetCompleted = completionWasRequested
          ? (updates.completed as boolean)
          : existingTask.completed;
        const completionChanged =
          completionWasRequested && targetCompleted !== existingTask.completed;

        if (completionChanged) {
          const xpForTransition = targetCompleted
            ? ((updates.xpReward as number | undefined) ?? existingTask.xpReward)
            : existingTask.awardedXp;

          updates.awardedXp = targetCompleted ? xpForTransition : 0;

          // Including the old completed value in the filter means only one
          // request can win a particular false→true or true→false transition.
          updatedTask = await Task.findOneAndUpdate(
            { _id: id, user: userId, completed: existingTask.completed },
            updates,
            { new: true, runValidators: true, session }
          );

          if (updatedTask) {
            updatedPlayer = await applyCompletionToPlayer({
              userId,
              completed: targetCompleted,
              xpReward: xpForTransition,
              session,
            });

            if (targetCompleted && effectiveRecurrence !== "none" && effectiveDueDate) {
              const successor = new Task({
                user: userId,
                title: updatedTask.title,
                description: updatedTask.description,
                category: updatedTask.category ?? null,
                dueDate: getNextRecurringDueDate(
                  effectiveDueDate,
                  effectiveRecurrence
                ),
                recurrence: effectiveRecurrence,
                reminderTime: effectiveReminderTime,
                completed: false,
                difficulty: updatedTask.difficulty,
                xpReward: xpByDifficulty[updatedTask.difficulty as Difficulty],
                awardedXp: 0,
              });
              await successor.save({ session });
              recurringTask = successor;
            }
          }
        } else {
          if (existingTask.completed && isDifficulty(updates.difficulty)) {
            updates.awardedXp = updates.xpReward;
          }

          updatedTask = await Task.findOneAndUpdate(
            { _id: id, user: userId },
            updates,
            {
              new: true,
              runValidators: true,
              session,
            }
          );

          if (updatedTask && existingTask.completed) {
            updatedPlayer = await adjustPlayerXp({
              userId,
              amount: updatedTask.xpReward - existingTask.xpReward,
              session,
            });

          }
        }

        // A concurrent request may already have performed the same transition.
        // In that case, return current state without applying progression again.
        if (!updatedTask) {
          updatedTask = await Task.findOne({ _id: id, user: userId }).session(
            session
          );
        }

        if (!updatedPlayer) {
          updatedPlayer = await getOrCreatePlayer(userId, session);
        }
      });
    } finally {
      await session.endSession();
    }

    if (planningValidationError) {
      res.status(400).json({ message: planningValidationError });
      return;
    }

    if (!taskWasFound || !updatedTask || !updatedPlayer) {
      res.status(404).json({ message: "Task not found" });
      return;
    }

    res.json({
      task: updatedTask,
      player: toPlayerResponse(updatedPlayer),
      recurringTask,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteTask = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const id = getTaskId(req.params.id);

    if (!id) {
      res.status(400).json({ message: "Invalid task id" });
      return;
    }

    const task = await Task.findOneAndDelete({ _id: id, user: userId });

    if (!task) {
      res.status(404).json({ message: "Task not found" });
      return;
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
