import type { NextFunction, Request, Response } from "express";
import {
  getOrCreatePlayer,
  toPlayerResponse,
} from "../services/player.service";

export const getPlayer = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.userId) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }

    const player = await getOrCreatePlayer(req.userId);
    res.json(toPlayerResponse(player));
  } catch (error) {
    next(error);
  }
};
