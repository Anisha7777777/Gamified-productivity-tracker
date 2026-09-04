import type { Request, Response } from "express";
import * as db from "../config/db";

export const getHealth = (_req: Request, res: Response) => {
  res.json({
    status: "ok",
  });
};

export const getReady = (_req: Request, res: Response) => {
  if (!db.isDatabaseReady()) {
    res.status(503).json({ status: "not_ready" });
    return;
  }

  res.json({ status: "ready" });
};
