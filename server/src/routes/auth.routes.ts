import { Router } from "express";
import {
  getCurrentUser,
  login,
  logout,
  updateAccount,
  updatePassword,
  register,
  forgotPassword,
  resetPassword,
} from "../controllers/auth.controller";
import { authenticate } from "../middleware/auth.middleware";
import {
  authLimiter,
  passwordResetLimiter,
} from "../middleware/rate-limit.middleware";

const router = Router();

router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);
router.post("/forgot-password", passwordResetLimiter, forgotPassword);
router.post("/reset-password", passwordResetLimiter, resetPassword);
router.post("/logout", logout);
router.get("/me", authenticate, getCurrentUser);
router.patch("/me", authenticate, updateAccount);
router.patch("/password", authenticate, updatePassword);

export default router;
