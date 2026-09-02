const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000";
export const AUTH_UNAUTHORIZED_EVENT = "questly:unauthorized";

export type User = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
};

export type AuthResponse = {
  user: User;
};

export type Task = {
  _id: string;
  title: string;
  description: string;
  completed: boolean;
  difficulty: "easy" | "medium" | "hard";
  xpReward: number;
  createdAt: string;
  updatedAt: string;
};

export type TaskInput = {
  title: string;
  description?: string;
  completed?: boolean;
  difficulty?: Task["difficulty"];
};

export type Player = {
  _id: string;
  name: string;
  totalXp: number;
  completedTasks: number;
  streak: number;
  lastCompletedDate: string | null;
  level: number;
  currentLevelXp: number;
  xpForNextLevel: number;
};

export type TaskUpdateResponse = {
  task: Task;
  player: Player;
};

const request = async <T>(
  path: string,
  options?: RequestInit,
  requiresAuth = false
): Promise<T> => {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as {
      message?: string;
      code?: string;
    } | null;
    const message = error?.message ?? "The request failed";

    if (response.status === 401 && requiresAuth) {
      window.dispatchEvent(
        new CustomEvent(AUTH_UNAUTHORIZED_EVENT, {
          detail:
            error?.code === "SESSION_INVALID"
              ? "Your session expired or was signed out. Please sign in again."
              : "Please sign in to continue.",
        })
      );
    }

    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
};

export const getHealth = async () => {
  return request<{ status: string }>("/api/health");
};

export const registerUser = (input: {
  name: string;
  email: string;
  password: string;
}) =>
  request<AuthResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  });

export const loginUser = (input: { email: string; password: string }) =>
  request<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });

export const getCurrentUser = () =>
  request<{ user: User }>("/api/auth/me", undefined, true);

export const logoutUser = () =>
  request<{ message: string }>("/api/auth/logout", { method: "POST" });

export const updateAccount = (input: { name: string; email: string }) =>
  request<{ user: User }>(
    "/api/auth/me",
    { method: "PATCH", body: JSON.stringify(input) },
    true
  );

export const changePassword = (input: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}) =>
  request<{ message: string }>(
    "/api/auth/password",
    { method: "PATCH", body: JSON.stringify(input) },
    true
  );

export const requestPasswordReset = (email: string) =>
  request<{ message: string }>("/api/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });

export const resetPassword = (input: {
  token: string;
  newPassword: string;
  confirmPassword: string;
}) =>
  request<{ message: string }>("/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify(input),
  });

export const verifyEmail = (token: string) =>
  request<AuthResponse>("/api/auth/verify-email", {
    method: "POST",
    body: JSON.stringify({ token }),
  });

export const resendVerification = () =>
  request<{ message: string; user: User }>(
    "/api/auth/resend-verification",
    { method: "POST" },
    true
  );

export const getTasks = () => request<Task[]>("/api/tasks", undefined, true);

export const getPlayer = () => request<Player>("/api/player", undefined, true);

export const createTask = (input: TaskInput) =>
  request<Task>(
    "/api/tasks",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
    true
  );

export const updateTask = (id: string, input: Partial<TaskInput>) =>
  request<TaskUpdateResponse>(
    `/api/tasks/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
    true
  );

export const deleteTask = (id: string) =>
  request<void>(`/api/tasks/${id}`, { method: "DELETE" }, true);
