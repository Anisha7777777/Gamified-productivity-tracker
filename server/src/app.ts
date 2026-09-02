import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";
import healthRoutes from "./routes/health.routes";
import taskRoutes from "./routes/task.routes";
import playerRoutes from "./routes/player.routes";
import authRoutes from "./routes/auth.routes";
import type { NextFunction, Request, Response } from "express";
import { apiLimiter } from "./middleware/rate-limit.middleware";

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN,
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());
app.use("/api", apiLimiter);
app.use("/api", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/player", playerRoutes);

app.use((_req: Request, res: Response) => {
  res.status(404).json({ message: "Route not found" });
});

app.use(
  (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    // Keep server logs useful without accidentally recording credentials or tokens.
    console.error("Request failed");

    if (error instanceof SyntaxError && "body" in error) {
      res.status(400).json({ message: "Request body contains invalid JSON" });
      return;
    }

    if (error instanceof mongoose.Error.ValidationError) {
      const message = Object.values(error.errors)[0]?.message ?? "Invalid task";
      res.status(400).json({ message });
      return;
    }

    res.status(500).json({ message: "Something went wrong" });
  }
);

export default app;
