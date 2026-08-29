import { Router } from "express";
import { getPlayer } from "../controllers/player.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

router.get("/", authenticate, getPlayer);

export default router;
