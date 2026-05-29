import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

router.get("/dashboard/summary", requireAuth, async (_req, res) => {
  res.json({});
});

export default router;
