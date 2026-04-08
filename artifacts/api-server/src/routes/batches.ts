import { Router } from "express";
import { db } from "@workspace/db";
import { batchesTable, logsTable, photosTable } from "@workspace/db";
import { eq, and, count, desc, sql } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";

const router = Router();

function daysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

async function batchWithCounts(batch: typeof batchesTable.$inferSelect) {
  const [logCountResult] = await db
    .select({ count: count() })
    .from(logsTable)
    .where(eq(logsTable.batchId, batch.id));
  const [photoCountResult] = await db
    .select({ count: count() })
    .from(photosTable)
    .where(eq(photosTable.batchId, batch.id));

  return {
    ...batch,
    logCount: Number(logCountResult?.count ?? 0),
    photoCount: Number(photoCountResult?.count ?? 0),
    daysSinceStart: daysSince(batch.startedAt),
  };
}

router.get("/batches", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  try {
    const batches = await db.query.batchesTable.findMany({
      where: eq(batchesTable.userId, userId),
      orderBy: [desc(batchesTable.createdAt)],
    });
    const result = await Promise.all(batches.map(batchWithCounts));
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to list batches");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/batches", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const { name, startedAt, teaType, notes } = req.body;

  if (!name) {
    res.status(400).json({ error: "Name is required" });
    return;
  }

  try {
    const [batch] = await db.insert(batchesTable).values({
      userId,
      name,
      startedAt: startedAt ? new Date(startedAt) : new Date(),
      teaType,
      notes,
      status: "active",
    }).returning();

    const result = await batchWithCounts(batch);
    res.status(201).json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to create batch");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/batches/:batchId", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const batchId = parseInt(String(req.params.batchId));

  try {
    const batch = await db.query.batchesTable.findFirst({
      where: and(eq(batchesTable.id, batchId), eq(batchesTable.userId, userId)),
    });

    if (!batch) {
      res.status(404).json({ error: "Batch not found" });
      return;
    }

    const result = await batchWithCounts(batch);
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to get batch");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/batches/:batchId", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const batchId = parseInt(String(req.params.batchId));
  const { name, status, teaType, notes } = req.body;

  try {
    const existing = await db.query.batchesTable.findFirst({
      where: and(eq(batchesTable.id, batchId), eq(batchesTable.userId, userId)),
    });

    if (!existing) {
      res.status(404).json({ error: "Batch not found" });
      return;
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined) updates.name = name;
    if (status !== undefined) updates.status = status;
    if (teaType !== undefined) updates.teaType = teaType;
    if (notes !== undefined) updates.notes = notes;

    const [batch] = await db.update(batchesTable)
      .set(updates)
      .where(and(eq(batchesTable.id, batchId), eq(batchesTable.userId, userId)))
      .returning();

    const result = await batchWithCounts(batch);
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to update batch");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/batches/:batchId", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const batchId = parseInt(String(req.params.batchId));

  try {
    const existing = await db.query.batchesTable.findFirst({
      where: and(eq(batchesTable.id, batchId), eq(batchesTable.userId, userId)),
    });

    if (!existing) {
      res.status(404).json({ error: "Batch not found" });
      return;
    }

    await db.delete(batchesTable).where(and(eq(batchesTable.id, batchId), eq(batchesTable.userId, userId)));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete batch");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
