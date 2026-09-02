import { Router } from "express";
import { getPlayer } from "../controllers/player.controller";
import { authenticate } from "../middleware/auth.middleware";
import { requireVerifiedEmail } from "../middleware/require-verified-email.middleware";

const router = Router();

router.get("/", authenticate, requireVerifiedEmail, getPlayer);

export default router;
