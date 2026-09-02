import type { NextFunction, Request, Response } from "express";
import { User } from "../models/user.model";

export const requireVerifiedEmail = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = await User.findById(req.userId);

    if (!user) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }

    if (user.emailVerified !== true) {
      res.status(403).json({
        message: "Verify your email before accessing tasks and player progress.",
        code: "EMAIL_VERIFICATION_REQUIRED",
      });
      return;
    }

    next();
  } catch (error) {
    next(error);
  }
};
