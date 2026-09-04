import { randomUUID } from "node:crypto";
import request from "supertest";
import app from "../app";
import { Player } from "../models/player.model";
import { Task } from "../models/task.model";
import { User } from "../models/user.model";
import { getLatestTestEmail } from "./test-mail.service";

export const api = request(app);

export const makeTestCredentials = () => {
  const email = `integration-${randomUUID()}@example.test`;
  return {
    name: "Integration Adventurer",
    email,
    password: "safe-test-password",
  };
};

export const tokenFromCapturedEmail = (
  kind: "verification" | "password-reset",
  email: string
) => {
  const captured = getLatestTestEmail(kind, email);
  const parameter =
    kind === "verification" ? "verifyEmailToken" : "resetPasswordToken";
  const token = new URL(captured.url).searchParams.get(parameter);

  if (!token) {
    throw new Error("The captured test email did not contain a token");
  }

  return token;
};

export const registerTestUser = async () => {
  const credentials = makeTestCredentials();
  const agent = request.agent(app);
  const response = await agent.post("/api/auth/register").send(credentials);

  return { agent, credentials, response };
};

export const registerVerifiedTestUser = async () => {
  const registered = await registerTestUser();
  const token = tokenFromCapturedEmail("verification", registered.credentials.email);
  const response = await api.post("/api/auth/verify-email").send({ token });

  if (response.status !== 200) {
    throw new Error("Could not verify a test user");
  }

  return registered;
};

export const createTestTask = async (
  agent: ReturnType<typeof request.agent>,
  input: {
    title?: string;
    difficulty?: "easy" | "medium" | "hard";
    category?: string;
    dueDate?: string;
  } = {}
) => {
  const response = await agent.post("/api/tasks").send({
    title: input.title ?? "Integration task",
    difficulty: input.difficulty ?? "medium",
    ...(input.category !== undefined ? { category: input.category } : {}),
    ...(input.dueDate !== undefined ? { dueDate: input.dueDate } : {}),
  });

  if (response.status !== 201) {
    throw new Error("Could not create a test task");
  }

  return response.body as {
    _id: string;
    xpReward: number;
    category: string | null;
    dueDate: string | null;
  };
};

export const getStoredUser = (email: string) => User.findOne({ email });

export const getStoredPlayer = (userId: string) => Player.findOne({ user: userId });

export const getStoredTask = (taskId: string) => Task.findById(taskId).select(
  "+awardedXp"
);
