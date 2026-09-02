import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import { User } from "../models/user.model";
import { createAuthToken } from "../services/auth.service";
import { verifyAuthToken } from "../services/auth.service";
import {
  AUTH_COOKIE_NAME,
  clearAuthCookie,
  setAuthCookie,
} from "../services/cookie.service";
import { getOrCreatePlayer } from "../services/player.service";
import {
  getClientOrigin,
  getPasswordResetExpiryMs,
} from "../config/env";
import {
  isEmailDeliveryConfigured,
  sendPasswordResetEmail,
} from "../services/email.service";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;
const HASH_ROUNDS = 12;
const PASSWORD_RESET_RESPONSE = {
  message:
    "If an account uses that email, a password-reset link will be sent shortly.",
};

const validateCredentials = (
  body: unknown,
  options: { requireName?: boolean } = {}
) => {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return "Request body must be an object";
  }

  const values = body as Record<string, unknown>;

  if (options.requireName) {
    if (typeof values.name !== "string" || !values.name.trim()) {
      return "Name is required";
    }

    if (values.name.trim().length > 80) {
      return "Name cannot be longer than 80 characters";
    }
  }

  if (
    typeof values.email !== "string" ||
    !EMAIL_PATTERN.test(values.email.trim())
  ) {
    return "Enter a valid email address";
  }

  if (
    typeof values.password !== "string" ||
    values.password.length < PASSWORD_MIN_LENGTH ||
    values.password.length > PASSWORD_MAX_LENGTH
  ) {
    return `Password must be between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters`;
  }

  return null;
};

const safeUser = (user: { _id: unknown; name: string; email: string }) => ({
  id: String(user._id),
  name: user.name,
  email: user.email,
});

const readRequestToken = (req: Request) => {
  const cookieToken = req.cookies?.[AUTH_COOKIE_NAME];

  if (typeof cookieToken === "string") {
    return cookieToken;
  }

  const [scheme, token, extra] = req.headers.authorization?.split(" ") ?? [];
  return scheme === "Bearer" && token && !extra ? token : null;
};

const isDuplicateEmailError = (error: unknown) =>
  error instanceof mongoose.mongo.MongoServerError && error.code === 11000;

const hashResetToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

const createPasswordResetUrl = (token: string) => {
  const resetUrl = new URL(getClientOrigin());
  resetUrl.searchParams.set("resetPasswordToken", token);
  return resetUrl.toString();
};

export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const validationError = validateCredentials(req.body, { requireName: true });

  if (validationError) {
    res.status(400).json({ message: validationError });
    return;
  }

  const name = req.body.name.trim();
  const email = req.body.email.trim().toLowerCase();
  const password = req.body.password;

  try {
    if (await User.exists({ email })) {
      res.status(409).json({ message: "An account with that email already exists" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, HASH_ROUNDS);
    const session = await mongoose.startSession();
    let createdUser;

    try {
      createdUser = await session.withTransaction(async () => {
        const users = await User.create(
          [{ name, email, password: passwordHash }],
          { session }
        );

        const user = users[0];

        if (!user) {
          throw new Error("User creation failed");
        }

        await getOrCreatePlayer(String(user._id), session);
        return user;
      });
    } finally {
      await session.endSession();
    }

    if (!createdUser) {
      throw new Error("User creation failed");
    }

    const token = createAuthToken(
      String(createdUser._id),
      createdUser.tokenVersion ?? 0
    );
    setAuthCookie(res, token);
    res.status(201).json({ user: safeUser(createdUser) });
  } catch (error) {
    if (isDuplicateEmailError(error)) {
      res.status(409).json({ message: "An account with that email already exists" });
      return;
    }

    next(error);
  }
};

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const validationError = validateCredentials(req.body);

  if (validationError) {
    res.status(400).json({ message: validationError });
    return;
  }

  const email = req.body.email.trim().toLowerCase();

  try {
    const user = await User.findOne({ email }).select(
      "+password +tokenVersion"
    );
    const passwordMatches = user
      ? await bcrypt.compare(req.body.password, user.password)
      : false;

    if (!user || !passwordMatches) {
      res.status(401).json({ message: "Invalid email or password" });
      return;
    }

    const token = createAuthToken(String(user._id), user.tokenVersion ?? 0);
    setAuthCookie(res, token);
    res.json({ user: safeUser(user) });
  } catch (error) {
    next(error);
  }
};

export const getCurrentUser = async (
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

    res.json({ user: safeUser(user) });
  } catch (error) {
    next(error);
  }
};

export const logout = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const token = readRequestToken(req);
  clearAuthCookie(res);

  if (!token) {
    res.json({ message: "Signed out successfully" });
    return;
  }

  try {
    try {
      const payload = verifyAuthToken(token);

      if (mongoose.isObjectIdOrHexString(payload.userId)) {
        const user = await User.findById(payload.userId).select("+tokenVersion");

        if (user && (user.tokenVersion ?? 0) === payload.tokenVersion) {
          user.tokenVersion = (user.tokenVersion ?? 0) + 1;
          await user.save();
        }
      }
    } catch {
      // Logout stays safe and idempotent for absent, expired, or invalid cookies.
    }

    res.json({ message: "Signed out successfully" });
  } catch (error) {
    next(error);
  }
};

export const updateAccount = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    res.status(400).json({ message: "Request body must be an object" });
    return;
  }

  const values = req.body as Record<string, unknown>;
  const fields = Object.keys(values);

  if (
    fields.length === 0 ||
    fields.some((field) => field !== "name" && field !== "email")
  ) {
    res.status(400).json({ message: "Only name and email can be changed" });
    return;
  }

  if (
    "name" in values &&
    (typeof values.name !== "string" ||
      !values.name.trim() ||
      values.name.trim().length > 80)
  ) {
    res.status(400).json({
      message: "Name must be between 1 and 80 characters",
    });
    return;
  }

  if (
    "email" in values &&
    (typeof values.email !== "string" ||
      !EMAIL_PATTERN.test(values.email.trim()))
  ) {
    res.status(400).json({ message: "Enter a valid email address" });
    return;
  }

  try {
    const updates: { name?: string; email?: string } = {};

    if (typeof values.name === "string") {
      updates.name = values.name.trim();
    }

    if (typeof values.email === "string") {
      updates.email = values.email.trim().toLowerCase();

      const emailOwner = await User.exists({
        email: updates.email,
        _id: { $ne: req.userId },
      });

      if (emailOwner) {
        res.status(409).json({ message: "That email is already in use" });
        return;
      }
    }

    const user = await User.findByIdAndUpdate(req.userId, updates, {
      new: true,
      runValidators: true,
    });

    if (!user) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }

    res.json({ user: safeUser(user) });
  } catch (error) {
    if (isDuplicateEmailError(error)) {
      res.status(409).json({ message: "That email is already in use" });
      return;
    }

    next(error);
  }
};

export const updatePassword = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    res.status(400).json({ message: "Request body must be an object" });
    return;
  }

  const { currentPassword, newPassword, confirmPassword } = req.body as Record<
    string,
    unknown
  >;
  const passwordFields = Object.keys(req.body);

  if (
    passwordFields.some(
      (field) =>
        field !== "currentPassword" &&
        field !== "newPassword" &&
        field !== "confirmPassword"
    )
  ) {
    res.status(400).json({
      message:
        "Only currentPassword, newPassword, and confirmPassword are allowed",
    });
    return;
  }

  if (typeof currentPassword !== "string" || !currentPassword) {
    res.status(400).json({ message: "Current password is required" });
    return;
  }

  if (
    typeof newPassword !== "string" ||
    newPassword.length < PASSWORD_MIN_LENGTH ||
    newPassword.length > PASSWORD_MAX_LENGTH
  ) {
    res.status(400).json({
      message: `New password must be between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters`,
    });
    return;
  }

  if (confirmPassword !== newPassword) {
    res.status(400).json({ message: "New password confirmation does not match" });
    return;
  }

  try {
    const user = await User.findById(req.userId).select(
      "+password +tokenVersion"
    );

    if (!user) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }

    const passwordMatches = await bcrypt.compare(
      currentPassword,
      user.password
    );

    if (!passwordMatches) {
      res.status(400).json({ message: "Current password is incorrect" });
      return;
    }

    user.password = await bcrypt.hash(newPassword, HASH_ROUNDS);
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    await user.save();
    clearAuthCookie(res);

    res.json({
      message: "Password changed. Please sign in again.",
    });
  } catch (error) {
    next(error);
  }
};

export const forgotPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!isEmailDeliveryConfigured()) {
    res.status(503).json({
      message: "Password recovery is temporarily unavailable. Please try again later.",
    });
    return;
  }

  const body = req.body as Record<string, unknown> | undefined;
  const email =
    typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

  // A generic result avoids revealing whether an email address has an account.
  if (!EMAIL_PATTERN.test(email)) {
    res.json(PASSWORD_RESET_RESPONSE);
    return;
  }

  try {
    const user = await User.findOne({ email });

    if (!user) {
      res.json(PASSWORD_RESET_RESPONSE);
      return;
    }

    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = hashResetToken(rawToken);
    const expiresAt = new Date(Date.now() + getPasswordResetExpiryMs());

    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          passwordResetTokenHash: tokenHash,
          passwordResetExpiresAt: expiresAt,
        },
      }
    );

    try {
      await sendPasswordResetEmail({
        email: user.email,
        resetUrl: createPasswordResetUrl(rawToken),
      });
    } catch {
      // A link that could not be delivered should not remain usable.
      await User.updateOne(
        { _id: user._id, passwordResetTokenHash: tokenHash },
        { $unset: { passwordResetTokenHash: 1, passwordResetExpiresAt: 1 } }
      );
    }

    res.json(PASSWORD_RESET_RESPONSE);
  } catch (error) {
    next(error);
  }
};

export const resetPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    res.status(400).json({ message: "Request body must be an object" });
    return;
  }

  const values = req.body as Record<string, unknown>;
  const fields = Object.keys(values);

  if (
    fields.some(
      (field) =>
        field !== "token" && field !== "newPassword" && field !== "confirmPassword"
    )
  ) {
    res.status(400).json({
      message: "Only token, newPassword, and confirmPassword are allowed",
    });
    return;
  }

  const token = typeof values.token === "string" ? values.token : "";
  const newPassword =
    typeof values.newPassword === "string" ? values.newPassword : "";
  const confirmPassword =
    typeof values.confirmPassword === "string" ? values.confirmPassword : "";

  if (!token) {
    res.status(400).json({ message: "Password-reset link is invalid or expired" });
    return;
  }

  if (
    newPassword.length < PASSWORD_MIN_LENGTH ||
    newPassword.length > PASSWORD_MAX_LENGTH
  ) {
    res.status(400).json({
      message: `New password must be between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters`,
    });
    return;
  }

  if (newPassword !== confirmPassword) {
    res.status(400).json({ message: "New password confirmation does not match" });
    return;
  }

  try {
    const passwordHash = await bcrypt.hash(newPassword, HASH_ROUNDS);
    const user = await User.findOneAndUpdate(
      {
        passwordResetTokenHash: hashResetToken(token),
        passwordResetExpiresAt: { $gt: new Date() },
      },
      {
        $set: { password: passwordHash },
        $unset: { passwordResetTokenHash: 1, passwordResetExpiresAt: 1 },
        $inc: { tokenVersion: 1 },
      },
      { new: false }
    );

    if (!user) {
      res.status(400).json({ message: "Password-reset link is invalid or expired" });
      return;
    }

    clearAuthCookie(res);
    res.json({ message: "Password reset. Please sign in with your new password." });
  } catch (error) {
    next(error);
  }
};
