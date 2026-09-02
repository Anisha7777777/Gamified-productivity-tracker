import { Router } from "express";
import {
  createTask,
  deleteTask,
  getTask,
  listTasks,
  updateTask,
} from "../controllers/task.controller";
import { authenticate } from "../middleware/auth.middleware";
import { requireVerifiedEmail } from "../middleware/require-verified-email.middleware";

const router = Router();

router.use(authenticate, requireVerifiedEmail);
router.route("/").get(listTasks).post(createTask);
router.route("/:id").get(getTask).patch(updateTask).delete(deleteTask);

export default router;
