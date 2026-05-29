import { Router } from "express";
import { db } from "@workspace/db";
import { photosTable, brewsTable, fermentationBatchTable, flavoringEventTable } from "@workspace/db";
import { eq, and, desc, isNull, isNotNull } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";

const router = Router();

router.get("/photos", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const phase = req.query.phase as string | undefined;
  try {
    let query = db
      .select()
      .from(photosTable)
      .where(eq(photosTable.userId, userId))
      .orderBy(desc(photosTable.createdAt))
      .limit(200)
      .$dynamic();

    if (phase) {
      query = query.where(and(eq(photosTable.userId, userId), eq(photosTable.phase, phase)));
    }

    const rows = await query;
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to list photos");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/photos/active-batches", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const phase = (req.query.phase as string | undefined) ?? "";
  try {
    if (phase === "brew") {
      const rows = await db
        .select({ id: brewsTable.id, date: brewsTable.date, teaSort: brewsTable.teaSort, boiledL: brewsTable.boiledL })
        .from(brewsTable)
        .where(eq(brewsTable.userId, userId))
        .orderBy(desc(brewsTable.id))
        .limit(20);
      res.json(rows.map((r) => ({ id: r.id, label: `Pruulimine ${r.date} (${r.teaSort || "tee"}, ${r.boiledL}L)`, date: r.date })));
    } else if (phase === "fermentation") {
      const rows = await db
        .select()
        .from(fermentationBatchTable)
        .where(and(eq(fermentationBatchTable.userId, userId), isNull(fermentationBatchTable.flavoringDate)))
        .orderBy(desc(fermentationBatchTable.id))
        .limit(20);
      res.json(rows.map((r) => ({ id: r.id, label: `Käärimine #${r.id} — ${r.teaSort || "nimeta"} (${r.startDate})`, date: r.startDate })));
    } else if (phase === "flavoring") {
      const rows = await db
        .select()
        .from(flavoringEventTable)
        .where(and(eq(flavoringEventTable.userId, userId), isNull(flavoringEventTable.bottlingDate)))
        .orderBy(desc(flavoringEventTable.id))
        .limit(20);
      res.json(rows.map((r) => ({ id: r.id, label: `Maitsestamine ${r.date}`, date: r.date })));
    } else {
      res.json([]);
    }
  } catch (err) {
    req.log.error({ err }, "Failed to list active batches");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/photos", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const { objectPath, phase, stageRefId, photoDate, caption } = req.body as {
    objectPath: string;
    phase?: string;
    stageRefId?: number;
    photoDate?: string;
    caption?: string;
  };
  if (!objectPath) {
    res.status(400).json({ error: "objectPath required" });
    return;
  }
  try {
    const [row] = await db
      .insert(photosTable)
      .values({
        userId,
        objectPath,
        phase: phase ?? null,
        stageRefId: stageRefId ?? null,
        photoDate: photoDate ?? null,
        caption: caption ?? null,
      })
      .returning();
    res.status(201).json(row);
  } catch (err) {
    req.log.error({ err }, "Failed to register photo");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/photos/:id", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  try {
    await db
      .delete(photosTable)
      .where(and(eq(photosTable.id, id), eq(photosTable.userId, userId)));
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Failed to delete photo");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
