import { Router } from "express";
import { db } from "@workspace/db";
import { batchesTable, photosTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";
const router = Router({ mergeParams: true });

router.get("/batches/:batchId/photos", requireAuth, async (req, res) => {
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

    const photos = await db.query.photosTable.findMany({
      where: eq(photosTable.batchId, batchId),
      orderBy: [desc(photosTable.takenAt)],
    });

    res.json(photos);
  } catch (err) {
    req.log.error({ err }, "Failed to list photos");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/batches/:batchId/photos", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const batchId = parseInt(String(req.params.batchId));
  const { objectPath, caption, dayNumber, takenAt, analyzeWithAi } = req.body;

  if (!objectPath) {
    res.status(400).json({ error: "objectPath is required" });
    return;
  }

  try {
    const batch = await db.query.batchesTable.findFirst({
      where: and(eq(batchesTable.id, batchId), eq(batchesTable.userId, userId)),
    });

    if (!batch) {
      res.status(404).json({ error: "Batch not found" });
      return;
    }

    const [photo] = await db.insert(photosTable).values({
      batchId,
      objectPath,
      caption: caption ?? null,
      dayNumber: dayNumber ?? null,
      aiAnalysis: null,
      takenAt: takenAt ? new Date(takenAt) : new Date(),
    }).returning();

    res.status(201).json(photo);
  } catch (err) {
    req.log.error({ err }, "Failed to create photo");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/batches/:batchId/photos/:photoId", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const batchId = parseInt(String(req.params.batchId));
  const photoId = parseInt(String(req.params.photoId));

  try {
    const batch = await db.query.batchesTable.findFirst({
      where: and(eq(batchesTable.id, batchId), eq(batchesTable.userId, userId)),
    });

    if (!batch) {
      res.status(404).json({ error: "Batch not found" });
      return;
    }

    const photo = await db.query.photosTable.findFirst({
      where: and(eq(photosTable.id, photoId), eq(photosTable.batchId, batchId)),
    });

    if (!photo) {
      res.status(404).json({ error: "Photo not found" });
      return;
    }

    await db.delete(photosTable).where(and(eq(photosTable.id, photoId), eq(photosTable.batchId, batchId)));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete photo");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
