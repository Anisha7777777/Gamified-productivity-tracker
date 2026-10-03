import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import path from "node:path";
import healthRoutes from "./routes/health.routes";
import taskRoutes from "./routes/task.routes";
import playerRoutes from "./routes/player.routes";
import authRoutes from "./routes/auth.routes";
import { apiLimiter } from "./middleware/rate-limit.middleware";
import { getClientOrigin, getTrustProxy } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/error.middleware";

const app = express();

app.set("trust proxy", getTrustProxy());
app.use(helmet({ contentSecurityPolicy: false }));

app.use(
  cors({
    origin: getClientOrigin(),
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

if (process.env.NODE_ENV === "production") {
  const clientDirectory = path.resolve(__dirname, "../../client/dist");
  app.use(express.static(clientDirectory));
  app.get("/{*splat}", (_req, res) => {
    res.sendFile(path.join(clientDirectory, "index.html"));
  });
}

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
