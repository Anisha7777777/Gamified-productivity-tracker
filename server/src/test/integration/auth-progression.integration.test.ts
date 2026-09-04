import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import app from "../../app";
import { Player } from "../../models/player.model";
import { Task } from "../../models/task.model";
import { User } from "../../models/user.model";
import * as playerService from "../../services/player.service";
import {
  api,
  createTestTask,
  getStoredPlayer,
  getStoredTask,
  getStoredUser,
  registerTestUser,
  registerVerifiedTestUser,
  tokenFromCapturedEmail,
} from "../helpers";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("registration and authentication", () => {
  it("creates one unverified user and one owned player without exposing secrets", async () => {
    const { credentials, response } = await registerTestUser();

    expect(response.status).toBe(201);
    expect(String(response.headers["set-cookie"])).toContain("HttpOnly");
    expect(response.body.user).toMatchObject({
      name: credentials.name,
      email: credentials.email,
      emailVerified: false,
      timezone: "UTC",
    });
    expect(JSON.stringify(response.body)).not.toMatch(/password|token/i);

    const user = await getStoredUser(credentials.email);
    expect(user).not.toBeNull();
    expect(await getStoredPlayer(String(user?._id))).not.toBeNull();
    expect(await User.countDocuments()).toBe(1);
    expect(await Player.countDocuments()).toBe(1);
  });

  it("rejects duplicate normalized emails and uses the same invalid-login message", async () => {
    const { credentials } = await registerTestUser();
    const duplicate = await api.post("/api/auth/register").send({
      ...credentials,
      email: credentials.email.toUpperCase(),
    });

    const unknown = await api.post("/api/auth/login").send({
      email: "missing@example.test",
      password: credentials.password,
    });
    const wrongPassword = await api.post("/api/auth/login").send({
      email: credentials.email,
      password: "wrong-password",
    });

    expect(duplicate.status).toBe(409);
    expect(unknown.status).toBe(401);
    expect(wrongPassword.status).toBe(401);
    expect(unknown.body.message).toBe(wrongPassword.body.message);
  });

  it("uses cookies for sessions and logout revokes the previous token", async () => {
    const { agent, credentials } = await registerTestUser();

    expect((await agent.get("/api/auth/me")).status).toBe(200);
    expect((await api.get("/api/auth/me")).status).toBe(401);
    expect((await api.get("/api/auth/me").set("Cookie", "auth_token=invalid")).status).toBe(401);

    const userBeforeLogout = await User.findOne({ email: credentials.email }).select(
      "+tokenVersion"
    );
    const logout = await agent.post("/api/auth/logout");
    const userAfterLogout = await User.findOne({ email: credentials.email }).select(
      "+tokenVersion"
    );

    expect(logout.status).toBe(200);
    expect(String(logout.headers["set-cookie"])).toMatch(/auth_token=.*Expires=/i);
    expect(userAfterLogout?.tokenVersion).toBe((userBeforeLogout?.tokenVersion ?? 0) + 1);
    expect((await agent.get("/api/auth/me")).status).toBe(401);

    const loginAgent = request.agent(app);
    const login = await loginAgent.post("/api/auth/login").send({
      email: credentials.email,
      password: credentials.password,
    });
    expect(login.status).toBe(200);
    expect(String(login.headers["set-cookie"])).toContain("HttpOnly");
    expect((await loginAgent.get("/api/auth/me")).status).toBe(200);
  });
});

describe("email verification", () => {
  it("stores only a verification hash and gates task and player routes until verified", async () => {
    const { agent, credentials } = await registerTestUser();
    const rawToken = tokenFromCapturedEmail("verification", credentials.email);
    const user = await User.findOne({ email: credentials.email }).select(
      "+emailVerificationTokenHash +emailVerificationExpiresAt"
    );

    expect(user?.emailVerified).toBe(false);
    expect(user?.emailVerificationTokenHash).toBeTruthy();
    expect(user?.emailVerificationTokenHash).not.toBe(rawToken);
    expect((await agent.get("/api/tasks")).status).toBe(403);
    expect((await agent.get("/api/player")).status).toBe(403);

    expect((await api.post("/api/auth/verify-email").send({ token: rawToken })).status).toBe(200);
    expect((await api.post("/api/auth/verify-email").send({ token: rawToken })).status).toBe(400);
    expect((await agent.get("/api/tasks")).status).toBe(200);
    expect((await agent.get("/api/player")).status).toBe(200);
  });

  it("invalidates the earlier link when verification is resent", async () => {
    const { agent, credentials } = await registerTestUser();
    const firstToken = tokenFromCapturedEmail("verification", credentials.email);
    const resend = await agent.post("/api/auth/resend-verification");
    const secondToken = tokenFromCapturedEmail("verification", credentials.email);

    expect(resend.status).toBe(200);
    expect(secondToken).not.toBe(firstToken);
    expect((await api.post("/api/auth/verify-email").send({ token: firstToken })).status).toBe(400);
    expect((await api.post("/api/auth/verify-email").send({ token: secondToken })).status).toBe(200);
    expect((await agent.post("/api/auth/resend-verification")).status).toBe(429);
  });

  it("rejects invalid and expired verification links safely", async () => {
    const { credentials } = await registerTestUser();
    const rawToken = tokenFromCapturedEmail("verification", credentials.email);
    await User.updateOne(
      { email: credentials.email },
      { $set: { emailVerificationExpiresAt: new Date(Date.now() - 1_000) } }
    );

    expect((await api.post("/api/auth/verify-email").send({ token: "not-a-real-token" })).status).toBe(400);
    expect((await api.post("/api/auth/verify-email").send({ token: rawToken })).status).toBe(400);
  });

  it("requires a fresh verification after an email change without losing task ownership", async () => {
    const user = await registerVerifiedTestUser();
    await createTestTask(user.agent, { title: "Preserved task" });
    const newEmail = "changed-email@example.test";
    const update = await user.agent.patch("/api/auth/me").send({
      name: user.credentials.name,
      email: newEmail,
    });

    expect(update.body.user).toMatchObject({ email: newEmail, emailVerified: false });
    expect((await user.agent.get("/api/tasks")).status).toBe(403);
    const token = tokenFromCapturedEmail("verification", newEmail);
    expect((await api.post("/api/auth/verify-email").send({ token })).status).toBe(200);
    expect((await user.agent.get("/api/tasks")).body).toHaveLength(1);
  });
});

describe("task ownership and progression", () => {
  it("keeps task and player data private to each verified user", async () => {
    const userA = await registerVerifiedTestUser();
    const userB = await registerVerifiedTestUser();
    const taskA = await createTestTask(userA.agent, { title: "A private task", difficulty: "easy" });

    expect((await userA.agent.get("/api/tasks")).body).toHaveLength(1);
    expect((await userB.agent.get("/api/tasks")).body).toHaveLength(0);

    for (const makeAttempt of [
      () => userB.agent.get(`/api/tasks/${taskA._id}`),
      () => userB.agent.patch(`/api/tasks/${taskA._id}`).send({ title: "Changed" }),
      () => userB.agent.patch(`/api/tasks/${taskA._id}`).send({ completed: true }),
      () => userB.agent.delete(`/api/tasks/${taskA._id}`),
    ]) {
      expect((await makeAttempt()).status).toBe(404);
    }

    const storedTask = await getStoredTask(taskA._id);
    const playerA = await getStoredPlayer(String((await getStoredUser(userA.credentials.email))?._id));
    const playerB = await getStoredPlayer(String((await getStoredUser(userB.credentials.email))?._id));
    expect(storedTask?.title).toBe("A private task");
    expect(storedTask?.completed).toBe(false);
    expect(playerA?.totalXp).toBe(0);
    expect(playerB?.totalXp).toBe(0);
    expect(String(playerA?._id)).not.toBe(String(playerB?._id));
  });

  it("applies XP exactly once for completion, reopening, and completed-task difficulty changes", async () => {
    const user = await registerVerifiedTestUser();
    const task = await createTestTask(user.agent, { difficulty: "medium" });

    const complete = await user.agent.patch(`/api/tasks/${task._id}`).send({ completed: true });
    const repeatedComplete = await user.agent.patch(`/api/tasks/${task._id}`).send({ completed: true });
    const changedDifficulty = await user.agent.patch(`/api/tasks/${task._id}`).send({ difficulty: "hard" });
    const reopen = await user.agent.patch(`/api/tasks/${task._id}`).send({ completed: false });
    const repeatedReopen = await user.agent.patch(`/api/tasks/${task._id}`).send({ completed: false });

    expect(complete.body.player).toMatchObject({ totalXp: 25, completedTasks: 1 });
    expect(repeatedComplete.body.player).toMatchObject({ totalXp: 25, completedTasks: 1 });
    expect(changedDifficulty.body.player).toMatchObject({ totalXp: 50, completedTasks: 1 });
    expect(reopen.body.player).toMatchObject({ totalXp: 0, completedTasks: 0 });
    expect(repeatedReopen.body.player).toMatchObject({ totalXp: 0, completedTasks: 0 });
  });

  it("does not duplicate XP when completion and reopening requests arrive together", async () => {
    const user = await registerVerifiedTestUser();
    const task = await createTestTask(user.agent, { difficulty: "hard" });

    await Promise.all([
      user.agent.patch(`/api/tasks/${task._id}`).send({ completed: true }),
      user.agent.patch(`/api/tasks/${task._id}`).send({ completed: true }),
    ]);
    let player = await getStoredPlayer(String((await getStoredUser(user.credentials.email))?._id));
    expect(player).toMatchObject({ totalXp: 50, completedTasks: 1 });

    await Promise.all([
      user.agent.patch(`/api/tasks/${task._id}`).send({ completed: false }),
      user.agent.patch(`/api/tasks/${task._id}`).send({ completed: false }),
    ]);
    player = await getStoredPlayer(String((await getStoredUser(user.credentials.email))?._id));
    expect(player).toMatchObject({ totalXp: 0, completedTasks: 0 });
  });

  it("rolls back a task transition when the player update fails", async () => {
    const user = await registerVerifiedTestUser();
    const task = await createTestTask(user.agent, { difficulty: "easy" });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(playerService, "applyCompletionToPlayer").mockRejectedValueOnce(
      new Error("Simulated player persistence failure")
    );

    const response = await user.agent.patch(`/api/tasks/${task._id}`).send({ completed: true });
    const storedTask = await getStoredTask(task._id);
    const player = await getStoredPlayer(String((await getStoredUser(user.credentials.email))?._id));

    expect(response.status).toBe(500);
    expect(storedTask?.completed).toBe(false);
    expect(player).toMatchObject({ totalXp: 0, completedTasks: 0 });
    errorSpy.mockRestore();
  });
});

describe("task planning fields and filters", () => {
  it("creates optional category and date-only due-date fields without changing XP behavior", async () => {
    const user = await registerVerifiedTestUser();
    const planned = await createTestTask(user.agent, {
      title: "Plan the weekly review",
      difficulty: "hard",
      category: " Work ",
      dueDate: "2026-09-04",
    });
    const unplanned = await createTestTask(user.agent, {
      title: "An unplanned quest",
    });

    expect(planned).toMatchObject({
      category: "Work",
      dueDate: "2026-09-04",
      xpReward: 50,
    });
    expect(unplanned).toMatchObject({ category: null, dueDate: null, xpReward: 25 });

    const listed = await user.agent.get("/api/tasks");
    const fetched = await user.agent.get(`/api/tasks/${planned._id}`);
    expect(listed.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          _id: planned._id,
          category: "Work",
          dueDate: "2026-09-04",
        }),
      ])
    );
    expect(fetched.body).toMatchObject({
      _id: planned._id,
      category: "Work",
      dueDate: "2026-09-04",
    });

    const completed = await user.agent
      .patch(`/api/tasks/${planned._id}`)
      .send({ completed: true });
    expect(completed.body.player).toMatchObject({ totalXp: 50, completedTasks: 1 });
  });

  it("updates and clears category and due date, while rejecting invalid planning values", async () => {
    const user = await registerVerifiedTestUser();
    const task = await createTestTask(user.agent);

    const updated = await user.agent.patch(`/api/tasks/${task._id}`).send({
      category: "Home",
      dueDate: "2026-12-31",
    });
    expect(updated.status).toBe(200);
    expect(updated.body.task).toMatchObject({ category: "Home", dueDate: "2026-12-31" });

    const cleared = await user.agent.patch(`/api/tasks/${task._id}`).send({
      category: null,
      dueDate: null,
    });
    expect(cleared.status).toBe(200);
    expect(cleared.body.task).toMatchObject({ category: null, dueDate: null });

    for (const body of [
      { category: "   " },
      { category: "x".repeat(31) },
      { dueDate: "2026-02-30" },
      { dueDate: "not-a-date" },
      { xpReward: 999 },
    ]) {
      expect((await user.agent.patch(`/api/tasks/${task._id}`).send(body)).status).toBe(400);
    }
  });

  it("combines user-scoped status, difficulty, and category filters", async () => {
    const user = await registerVerifiedTestUser();
    const activeHardWork = await createTestTask(user.agent, {
      title: "Active hard work quest",
      difficulty: "hard",
      category: "Work",
    });
    const completedHardWork = await createTestTask(user.agent, {
      title: "Completed hard work quest",
      difficulty: "hard",
      category: "Work",
    });
    await createTestTask(user.agent, {
      title: "Easy home quest",
      difficulty: "easy",
      category: "Home",
    });
    await user.agent
      .patch(`/api/tasks/${completedHardWork._id}`)
      .send({ completed: true });

    const activeHardWorkTasks = await user.agent.get(
      "/api/tasks?status=active&difficulty=hard&category=Work"
    );
    const completedTasks = await user.agent.get("/api/tasks?status=completed");

    expect(activeHardWorkTasks.status).toBe(200);
    expect(activeHardWorkTasks.body).toHaveLength(1);
    expect(activeHardWorkTasks.body[0]._id).toBe(activeHardWork._id);
    expect(completedTasks.body).toHaveLength(1);
    expect(completedTasks.body[0]._id).toBe(completedHardWork._id);
    expect((await user.agent.get("/api/tasks?difficulty=legendary")).status).toBe(400);
    expect((await user.agent.get("/api/tasks?category=%20%20")).status).toBe(400);
  });

  it("never exposes another user's filtered tasks or categories", async () => {
    const userA = await registerVerifiedTestUser();
    const userB = await registerVerifiedTestUser();
    await createTestTask(userA.agent, {
      title: "Private finance planning",
      category: "Private Finance",
      dueDate: "2026-09-04",
    });
    await createTestTask(userB.agent, {
      title: "Public-looking task",
      category: "Work",
    });

    const userBPrivateFilter = await userB.agent.get(
      "/api/tasks?category=Private%20Finance"
    );
    const userBWorkFilter = await userB.agent.get("/api/tasks?category=Work");

    expect(userBPrivateFilter.status).toBe(200);
    expect(userBPrivateFilter.body).toEqual([]);
    expect(userBWorkFilter.body).toHaveLength(1);
    expect(userBWorkFilter.body[0].category).toBe("Work");
  });
});

describe("recurring task planning", () => {
  it("stores a valid IANA timezone and rejects unsupported timezone values", async () => {
    const user = await registerVerifiedTestUser();

    const valid = await user.agent.patch("/api/auth/me").send({
      name: user.credentials.name,
      email: user.credentials.email,
      timezone: "Asia/Kolkata",
    });
    const invalid = await user.agent.patch("/api/auth/me").send({
      timezone: "Moon/Base-One",
    });

    expect(valid.status).toBe(200);
    expect(valid.body.user.timezone).toBe("Asia/Kolkata");
    expect(invalid.status).toBe(400);
  });

  it("validates reminder times and requires a due date for reminders and recurrence", async () => {
    const user = await registerVerifiedTestUser();

    const valid = await createTestTask(user.agent, {
      dueDate: "2026-09-04",
      reminderTime: "18:30",
      recurrence: "daily",
    });
    expect(valid).toMatchObject({
      dueDate: "2026-09-04",
      reminderTime: "18:30",
      recurrence: "daily",
    });
    expect(
      (await user.agent.patch(`/api/tasks/${valid._id}`).send({ dueDate: null }))
        .status
    ).toBe(400);

    for (const body of [
      { title: "No due date", recurrence: "daily" },
      { title: "No due date reminder", reminderTime: "09:00" },
      { title: "Invalid time", dueDate: "2026-09-04", reminderTime: "25:00" },
      { title: "Invalid repeat", dueDate: "2026-09-04", recurrence: "yearly" },
    ]) {
      expect((await user.agent.post("/api/tasks").send(body)).status).toBe(400);
    }
  });

  it("creates daily and weekly successors inside completion transactions", async () => {
    const user = await registerVerifiedTestUser();
    const daily = await createTestTask(user.agent, {
      title: "Daily planning",
      dueDate: "2026-09-04",
      recurrence: "daily",
      reminderTime: "09:00",
    });
    const weekly = await createTestTask(user.agent, {
      title: "Weekly planning",
      dueDate: "2026-09-04",
      recurrence: "weekly",
    });

    const dailyCompletion = await user.agent
      .patch(`/api/tasks/${daily._id}`)
      .send({ completed: true });
    const weeklyCompletion = await user.agent
      .patch(`/api/tasks/${weekly._id}`)
      .send({ completed: true });

    expect(dailyCompletion.body.recurringTask).toMatchObject({
      title: "Daily planning",
      dueDate: "2026-09-05",
      completed: false,
      recurrence: "daily",
      reminderTime: "09:00",
    });
    expect(weeklyCompletion.body.recurringTask).toMatchObject({
      title: "Weekly planning",
      dueDate: "2026-09-11",
      completed: false,
      recurrence: "weekly",
    });
  });

  it("clamps monthly successors to the final day of shorter months", async () => {
    const user = await registerVerifiedTestUser();
    const task = await createTestTask(user.agent, {
      title: "Month-end review",
      dueDate: "2026-01-31",
      recurrence: "monthly",
    });

    const completion = await user.agent
      .patch(`/api/tasks/${task._id}`)
      .send({ completed: true });

    expect(completion.status).toBe(200);
    expect(completion.body.recurringTask).toMatchObject({
      dueDate: "2026-02-28",
      recurrence: "monthly",
    });
  });

  it("creates one recurring successor and awards XP once for simultaneous completion", async () => {
    const user = await registerVerifiedTestUser();
    const task = await createTestTask(user.agent, {
      difficulty: "easy",
      dueDate: "2026-09-04",
      recurrence: "daily",
    });

    await Promise.all([
      user.agent.patch(`/api/tasks/${task._id}`).send({ completed: true }),
      user.agent.patch(`/api/tasks/${task._id}`).send({ completed: true }),
    ]);

    const tasks = await user.agent.get("/api/tasks");
    const player = await getStoredPlayer(String((await getStoredUser(user.credentials.email))?._id));
    expect(tasks.body).toHaveLength(2);
    expect(tasks.body.filter((item: { title: string }) => item.title === "Integration task")).toHaveLength(2);
    expect(player).toMatchObject({ totalXp: 10, completedTasks: 1 });

    const reopen = await user.agent
      .patch(`/api/tasks/${task._id}`)
      .send({ completed: false });
    expect(reopen.body.recurringTask).toBeNull();
    expect((await user.agent.get("/api/tasks")).body).toHaveLength(2);
  });

  it("keeps recurring tasks private and does not create successors for one-time tasks", async () => {
    const userA = await registerVerifiedTestUser();
    const userB = await registerVerifiedTestUser();
    const recurringTask = await createTestTask(userA.agent, {
      dueDate: "2026-09-04",
      recurrence: "daily",
    });
    const oneTimeTask = await createTestTask(userA.agent, { title: "One-time quest" });

    expect((await userA.agent.patch(`/api/tasks/${recurringTask._id}`).send({ completed: true })).body.recurringTask).not.toBeNull();
    expect((await userA.agent.patch(`/api/tasks/${oneTimeTask._id}`).send({ completed: true })).body.recurringTask).toBeNull();
    expect((await userB.agent.get("/api/tasks")).body).toEqual([]);
    expect((await userB.agent.patch(`/api/tasks/${recurringTask._id}`).send({ completed: true })).status).toBe(404);
  });

  it("rolls back completion when creating a recurring successor fails", async () => {
    const user = await registerVerifiedTestUser();
    const task = await createTestTask(user.agent, {
      difficulty: "easy",
      dueDate: "2026-09-04",
      recurrence: "daily",
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(Task.prototype, "save").mockRejectedValueOnce(
      new Error("Simulated recurring successor failure")
    );

    const response = await user.agent.patch(`/api/tasks/${task._id}`).send({ completed: true });
    const storedTask = await getStoredTask(task._id);
    const player = await getStoredPlayer(String((await getStoredUser(user.credentials.email))?._id));

    expect(response.status).toBe(500);
    expect(storedTask?.completed).toBe(false);
    expect(player).toMatchObject({ totalXp: 0, completedTasks: 0 });
    expect((await user.agent.get("/api/tasks")).body).toHaveLength(1);
    errorSpy.mockRestore();
  });
});

describe("password recovery", () => {
  it("uses hashed one-time reset tokens and revokes sessions after a successful reset", async () => {
    const user = await registerVerifiedTestUser();
    const existing = await api.post("/api/auth/forgot-password").send({ email: user.credentials.email });
    const missing = await api.post("/api/auth/forgot-password").send({ email: "missing@example.test" });
    const rawToken = tokenFromCapturedEmail("password-reset", user.credentials.email);
    const storedBeforeReset = await User.findOne({ email: user.credentials.email }).select(
      "+passwordResetTokenHash"
    );

    expect(existing.body).toEqual(missing.body);
    expect(storedBeforeReset?.passwordResetTokenHash).toBeTruthy();
    expect(storedBeforeReset?.passwordResetTokenHash).not.toBe(rawToken);

    const reset = await api.post("/api/auth/reset-password").send({
      token: rawToken,
      newPassword: "new-safe-test-password",
      confirmPassword: "new-safe-test-password",
    });
    expect(reset.status).toBe(200);
    expect((await user.agent.get("/api/auth/me")).status).toBe(401);
    expect((await api.post("/api/auth/login").send(user.credentials)).status).toBe(401);
    expect((await api.post("/api/auth/login").send({
      email: user.credentials.email,
      password: "new-safe-test-password",
    })).status).toBe(200);
    expect((await api.post("/api/auth/reset-password").send({
      token: rawToken,
      newPassword: "another-password",
      confirmPassword: "another-password",
    })).status).toBe(400);
  });

  it("rejects invalid and expired password-reset links safely", async () => {
    const user = await registerVerifiedTestUser();
    await api.post("/api/auth/forgot-password").send({ email: user.credentials.email });
    const rawToken = tokenFromCapturedEmail("password-reset", user.credentials.email);
    await User.updateOne(
      { email: user.credentials.email },
      { $set: { passwordResetExpiresAt: new Date(Date.now() - 1_000) } }
    );

    for (const token of ["not-a-real-token", rawToken]) {
      const response = await api.post("/api/auth/reset-password").send({
        token,
        newPassword: "new-safe-test-password",
        confirmPassword: "new-safe-test-password",
      });
      expect(response.status).toBe(400);
    }
  });
});
