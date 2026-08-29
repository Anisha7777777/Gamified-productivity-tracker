import type { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import { User } from "../models/user.model";
import { verifyAuthToken } from "../services/auth.service";
import { AUTH_COOKIE_NAME } from "../services/cookie.service";

const unauthorized = (
  res: Response,
  code: "AUTH_REQUIRED" | "SESSION_INVALID" = "AUTH_REQUIRED"
) => {
  res.status(401).json({ message: "Authentication required", code });
};

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const cookieToken = req.cookies?.[AUTH_COOKIE_NAME];
  const authorization = req.headers.authorization;
  const [scheme, bearerToken, extra] = authorization?.split(" ") ?? [];
  const validBearer = scheme === "Bearer" && bearerToken && !extra;
  const token =
    typeof cookieToken === "string"
      ? cookieToken
      : validBearer
        ? bearerToken
        : null;

  if (!token) {
    unauthorized(res);
    return;
  }

  let userId: string;
  let tokenVersion: number;

  try {
    const payload = verifyAuthToken(token);
    userId = payload.userId;
    tokenVersion = payload.tokenVersion;
  } catch {
    unauthorized(res, "SESSION_INVALID");
    return;
  }

  if (!mongoose.isObjectIdOrHexString(userId)) {
    unauthorized(res);
    return;
  }

  try {
    const user = await User.findById(userId).select("+tokenVersion");

    if (!user || (user.tokenVersion ?? 0) !== tokenVersion) {
      unauthorized(res, "SESSION_INVALID");
      return;
    }

    req.userId = userId;
    next();
  } catch (error) {
    next(error);
  }
};
