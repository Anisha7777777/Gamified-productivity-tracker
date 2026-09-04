import type { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";

export const notFoundHandler = (_req: Request, res: Response) => {
  res.status(404).json({ message: "Route not found" });
};

export const errorHandler = (
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  if (error instanceof SyntaxError && "body" in error) {
    res.status(400).json({ message: "Request body contains invalid JSON" });
    return;
  }

  if (error instanceof mongoose.Error.ValidationError) {
    const message = Object.values(error.errors)[0]?.message ?? "Invalid request";
    res.status(400).json({ message });
    return;
  }

  if (error instanceof mongoose.Error.CastError) {
    res.status(400).json({ message: "Invalid request value" });
    return;
  }

  if (error instanceof mongoose.mongo.MongoServerError && error.code === 11000) {
    res.status(409).json({ message: "A record with that value already exists" });
    return;
  }

  // Do not serialize error details: they can contain database or request data.
  console.error("Unexpected request error", {
    name: error instanceof Error ? error.name : "UnknownError",
  });
  res.status(500).json({ message: "Something went wrong" });
};
