import { Router } from "express";
import { db } from "@workspace/db";
import { fermentationBatchTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";

const router = Router();

router.get("/fermentations", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  try {
    const rows = await db
      .select()
      .from(fermentationBatchTable)
      .where(eq(fermentationBatchTable.userId, userId))
      .orderBy(desc(fermentationBatchTable.id))
      .limit(100);
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch fermentations");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/fermentations", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const b = req.body;
  try {
    await db.insert(fermentationBatchTable).values({
      userId,
      brewId: b.brewId ? Number(b.brewId) : null,
      teaSort: b.teaSort ?? "",
      startDate: b.startDate,
      flavoringDate: b.flavoringDate || null,
      notes: b.notes ?? "",
      vessels: Array.isArray(b.vessels) ? b.vessels : [],
    });
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to create fermentation");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/fermentations/:id", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const id = Number(req.params.id);
  const b = req.body;
  try {
    const set: Record<string, unknown> = {};
    if (b.flavoringDate !== undefined) set.flavoringDate = b.flavoringDate || null;
    if (b.notes !== undefined) set.notes = b.notes ?? "";
    if (Object.keys(set).length) {
      await db
        .update(fermentationBatchTable)
        .set(set)
        .where(and(eq(fermentationBatchTable.id, id), eq(fermentationBatchTable.userId, userId)));
    }
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to patch fermentation");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/fermentations/:id", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const id = Number(req.params.id);
  try {
    await db
      .delete(fermentationBatchTable)
      .where(and(eq(fermentationBatchTable.id, id), eq(fermentationBatchTable.userId, userId)));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete fermentation");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
