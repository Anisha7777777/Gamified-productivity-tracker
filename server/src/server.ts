import "dotenv/config";
import type { Server } from "node:http";
import mongoose from "mongoose";
import app from "./app";
import { connectDB } from "./config/db";
import { validateEnvironment } from "./config/env";

const port = process.env.PORT || 5000;
let httpServer: Server | undefined;
let shuttingDown = false;

export const startServer = async () => {
  try {
    validateEnvironment();
    await connectDB();

    httpServer = app.listen(port, () => {
      console.log(`Server running on http://localhost:${port}`);
    });
  } catch (error) {
    console.error("Failed to start server safely");
    process.exit(1);
  }
};

const shutdown = (signal: "SIGINT" | "SIGTERM") => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received. Shutting down safely.`);

  const finish = async (exitCode: number) => {
    try {
      await mongoose.disconnect();
    } finally {
      process.exit(exitCode);
    }
  };

  if (!httpServer) {
    void finish(0);
    return;
  }

  httpServer.close((error) => {
    void finish(error ? 1 : 0);
  });
};

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));

if (require.main === module) {
  void startServer();
}
