import { Router } from "express";
import { db } from "@workspace/db";
import { fermentationBatchTable, brewsTable, flavoringEventTable } from "@workspace/db";
import { eq, and, desc, inArray } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";

const router = Router();

function daysBetween(a: string | null | undefined, b: string | null | undefined): number | null {
  if (!a || !b) return null;
  const msA = new Date(a).getTime();
  const msB = new Date(b).getTime();
  if (isNaN(msA) || isNaN(msB)) return null;
  return Math.round((msB - msA) / 86400000);
}

function totalVolumeL(vessels: unknown): number {
  if (!Array.isArray(vessels)) return 0;
  return vessels.reduce((s: number, v: { volumeL?: number; count?: number }) => {
    return s + (v.volumeL ?? 0) * (v.count ?? 1);
  }, 0);
}

function totalBottles(blocks: unknown): number {
  if (!Array.isArray(blocks)) return 0;
  return blocks.reduce((s: number, b: { koguseL?: number; vesselL?: number }) => {
    const vL = b.vesselL ?? 0;
    return s + (vL > 0 ? Math.floor((b.koguseL ?? 0) / vL) : 0);
  }, 0);
}

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

router.get("/fermentations/lifecycle", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  try {
    const batches = await db
      .select()
      .from(fermentationBatchTable)
      .where(eq(fermentationBatchTable.userId, userId))
      .orderBy(desc(fermentationBatchTable.startDate))
      .limit(200);

    if (batches.length === 0) {
      res.json([]);
      return;
    }

    const brewIds = batches.map((b) => b.brewId).filter(Boolean) as number[];
    const batchIds = batches.map((b) => b.id);

    const [brews, flavEvents, starterBatches] = await Promise.all([
      brewIds.length > 0
        ? db.select().from(brewsTable).where(inArray(brewsTable.id, brewIds))
        : Promise.resolve([]),
      db
        .select()
        .from(flavoringEventTable)
        .where(and(eq(flavoringEventTable.userId, userId), inArray(flavoringEventTable.fermentationBatchId, batchIds))),
      (() => {
        const srcIds = batches
          .map((b) => b.starterSourceBatchId)
          .filter(Boolean) as number[];
        return srcIds.length > 0
          ? db.select().from(fermentationBatchTable).where(inArray(fermentationBatchTable.id, srcIds))
          : Promise.resolve([]);
      })(),
    ]);

    const brewMap = new Map(brews.map((b) => [b.id, b]));
    const flavMap = new Map<number, (typeof flavEvents)[0]>();
    for (const ev of flavEvents) {
      if (ev.fermentationBatchId != null && !flavMap.has(ev.fermentationBatchId)) {
        flavMap.set(ev.fermentationBatchId, ev);
      }
    }
    const starterMap = new Map(starterBatches.map((b) => [b.id, b]));

    const result = batches.map((b) => {
      const brew = b.brewId ? brewMap.get(b.brewId) ?? null : null;
      const flavEv = flavMap.get(b.id) ?? null;
      const starterSrc = b.starterSourceBatchId ? starterMap.get(b.starterSourceBatchId) ?? null : null;
      const f1Days = daysBetween(b.startDate, b.flavoringDate);
      const f2Days = flavEv ? daysBetween(flavEv.date, flavEv.bottlingDate) : null;
      const bottles = flavEv ? totalBottles((flavEv.blocks as unknown[])) : 0;
      const volL = totalVolumeL(b.vessels as unknown[]);

      return {
        id: b.id,
        teaSort: b.teaSort,
        startDate: b.startDate,
        flavoringDate: b.flavoringDate,
        notes: b.notes,
        vessels: b.vessels,
        starterSourceBatchId: b.starterSourceBatchId,
        starterSourceBatch: starterSrc
          ? { id: starterSrc.id, teaSort: starterSrc.teaSort, startDate: starterSrc.startDate }
          : null,
        brew: brew
          ? {
              id: brew.id,
              date: brew.date,
              teaSort: brew.teaSort,
              teaG: brew.teaG,
              sugarG: brew.sugarG,
              boiledL: brew.boiledL,
              coldWaterL: brew.coldWaterL,
              starterPct: brew.starterPct,
              starterG: brew.starterG,
              steepMin: brew.steepMin,
            }
          : null,
        flavoringEvent: flavEv
          ? {
              id: flavEv.id,
              date: flavEv.date,
              bottlingDate: flavEv.bottlingDate,
              blocks: flavEv.blocks,
              notes: flavEv.notes,
            }
          : null,
        totalVolumeL: volL,
        f1Days,
        f2Days,
        totalBottles: bottles,
      };
    });

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch lifecycle");
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

router.patch("/fermentations/:id/starter-source", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const id = Number(req.params.id);
  const { starterSourceBatchId } = req.body as { starterSourceBatchId: number | null };
  try {
    await db
      .update(fermentationBatchTable)
      .set({ starterSourceBatchId: starterSourceBatchId ?? null })
      .where(and(eq(fermentationBatchTable.id, id), eq(fermentationBatchTable.userId, userId)));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to update starter source");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/fermentations/:id", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const id = Number(req.params.id);
  const b = req.body;
  try {
    const set: Record<string, unknown> = {};
    if (b.teaSort !== undefined) set.teaSort = b.teaSort ?? "";
    if (b.startDate !== undefined) set.startDate = b.startDate;
    if (b.flavoringDate !== undefined) set.flavoringDate = b.flavoringDate || null;
    if (b.notes !== undefined) set.notes = b.notes ?? "";
    if (b.vessels !== undefined) set.vessels = Array.isArray(b.vessels) ? b.vessels : [];
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
