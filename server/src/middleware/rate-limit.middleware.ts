import rateLimit from "express-rate-limit";
import type { Request, Response } from "express";
import {
  getApiRateLimit,
  getAuthRateLimit,
  getPasswordResetRateLimit,
  getVerificationResendRateLimit,
} from "../config/env";

const jsonLimitHandler = (_request: Request, response: Response) => {
  response.status(429).json({
    message: "Too many requests. Please wait a few minutes and try again.",
  });
};

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1_000,
  limit: getApiRateLimit(),
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: jsonLimitHandler,
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1_000,
  limit: getAuthRateLimit(),
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: jsonLimitHandler,
});

export const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1_000,
  limit: getPasswordResetRateLimit(),
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: jsonLimitHandler,
});

export const verificationResendLimiter = rateLimit({
  windowMs: 15 * 60 * 1_000,
  limit: getVerificationResendRateLimit(),
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: jsonLimitHandler,
});
