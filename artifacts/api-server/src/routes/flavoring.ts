import { Router } from "express";
import { db } from "@workspace/db";
import { flavoringStockTable, processingMethodTable, flavoringEventTable, fermentationBatchTable } from "@workspace/db";
import { eq, and, asc, desc } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";

const router = Router();

type Block = {
  flavoringStockId?: number | null;
  gramsUsed?: number;
  [k: string]: unknown;
};

/* ---- MAITSESTUSE LADU ---- */

router.get("/flavoring/stock", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  try {
    const rows = await db
      .select()
      .from(flavoringStockTable)
      .where(eq(flavoringStockTable.userId, userId))
      .orderBy(asc(flavoringStockTable.name));
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch flavoring stock");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/flavoring/stock", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const { name, olek, paritolu, coefficient, qtyG } = req.body;
  if (!name) {
    res.status(400).json({ error: "nimi puudub" });
    return;
  }
  try {
    await db.insert(flavoringStockTable).values({
      userId,
      name: String(name).trim(),
      olek: olek ?? "",
      paritolu: paritolu ?? "",
      coefficient: coefficient != null ? Number(coefficient) : 1.3,
      qtyG: Number(qtyG) || 0,
    });
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to add flavoring stock");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/flavoring/stock/:id/add", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const id = Number(req.params.id);
  const add = Number(req.body.qtyG) || 0;
  try {
    const [row] = await db
      .select()
      .from(flavoringStockTable)
      .where(and(eq(flavoringStockTable.id, id), eq(flavoringStockTable.userId, userId)));
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    await db
      .update(flavoringStockTable)
      .set({ qtyG: row.qtyG + add })
      .where(eq(flavoringStockTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to add to flavoring stock");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/flavoring/stock/:id", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const id = Number(req.params.id);
  try {
    const set: Record<string, unknown> = {};
    if (req.body.coefficient !== undefined) set.coefficient = Number(req.body.coefficient);
    if (req.body.olek !== undefined) set.olek = req.body.olek ?? "";
    if (req.body.paritolu !== undefined) set.paritolu = req.body.paritolu ?? "";
    if (Object.keys(set).length) {
      await db
        .update(flavoringStockTable)
        .set(set)
        .where(and(eq(flavoringStockTable.id, id), eq(flavoringStockTable.userId, userId)));
    }
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to patch flavoring stock");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/flavoring/stock/:id", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const id = Number(req.params.id);
  try {
    await db
      .delete(flavoringStockTable)
      .where(and(eq(flavoringStockTable.id, id), eq(flavoringStockTable.userId, userId)));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete flavoring stock");
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ---- TÖÖTLUSVIISID ---- */

router.get("/flavoring/methods", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  try {
    const rows = await db
      .select()
      .from(processingMethodTable)
      .where(eq(processingMethodTable.userId, userId))
      .orderBy(asc(processingMethodTable.name));
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch processing methods");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/flavoring/methods", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const name = String(req.body.name || "").trim();
  if (!name) {
    res.status(400).json({ error: "nimi puudub" });
    return;
  }
  try {
    await db.insert(processingMethodTable).values({ userId, name });
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to add processing method");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/flavoring/methods/:id", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const id = Number(req.params.id);
  try {
    await db
      .delete(processingMethodTable)
      .where(and(eq(processingMethodTable.id, id), eq(processingMethodTable.userId, userId)));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete processing method");
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ---- MAITSESTAMISE SÜNDMUSED ---- */

router.get("/flavoring/events", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  try {
    const rows = await db
      .select()
      .from(flavoringEventTable)
      .where(eq(flavoringEventTable.userId, userId))
      .orderBy(desc(flavoringEventTable.id))
      .limit(100);
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch flavoring events");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/flavoring/events", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const b = req.body;
  const blocks: Block[] = Array.isArray(b.blocks) ? b.blocks : [];
  const fermId = b.fermentationBatchId ? Number(b.fermentationBatchId) : null;
  try {
    await db.transaction(async (tx) => {
      await tx.insert(flavoringEventTable).values({
        userId,
        date: b.date,
        fermentationBatchId: fermId,
        bottlingDate: b.bottlingDate || null,
        bottleFermentNote: b.bottleFermentNote ?? "",
        notes: b.notes ?? "",
        blocks,
      });
      for (const blk of blocks) {
        const g = Number(blk.gramsUsed) || 0;
        if (blk.flavoringStockId && g > 0) {
          const sid = Number(blk.flavoringStockId);
          const [row] = await tx
            .select()
            .from(flavoringStockTable)
            .where(and(eq(flavoringStockTable.id, sid), eq(flavoringStockTable.userId, userId)));
          if (row) {
            await tx
              .update(flavoringStockTable)
              .set({ qtyG: row.qtyG - g })
              .where(eq(flavoringStockTable.id, sid));
          }
        }
      }
      if (fermId && b.date) {
        await tx
          .update(fermentationBatchTable)
          .set({ flavoringDate: b.date })
          .where(and(eq(fermentationBatchTable.id, fermId), eq(fermentationBatchTable.userId, userId)));
      }
    });
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to create flavoring event");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/flavoring/events/:id", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const id = Number(req.params.id);
  const { bottlingDate } = req.body as { bottlingDate?: string | null };
  try {
    await db
      .update(flavoringEventTable)
      .set({ bottlingDate: bottlingDate || null })
      .where(and(eq(flavoringEventTable.id, id), eq(flavoringEventTable.userId, userId)));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to patch flavoring event");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/flavoring/events/:id", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const id = Number(req.params.id);
  try {
    await db.transaction(async (tx) => {
      const [ev] = await tx
        .select()
        .from(flavoringEventTable)
        .where(and(eq(flavoringEventTable.id, id), eq(flavoringEventTable.userId, userId)));
      if (!ev) return;
      const blocks = (ev.blocks as Block[]) || [];
      for (const blk of blocks) {
        const g = Number(blk.gramsUsed) || 0;
        if (blk.flavoringStockId && g > 0) {
          const sid = Number(blk.flavoringStockId);
          const [row] = await tx
            .select()
            .from(flavoringStockTable)
            .where(and(eq(flavoringStockTable.id, sid), eq(flavoringStockTable.userId, userId)));
          if (row) {
            await tx
              .update(flavoringStockTable)
              .set({ qtyG: row.qtyG + g })
              .where(eq(flavoringStockTable.id, sid));
          }
        }
      }
      await tx.delete(flavoringEventTable).where(eq(flavoringEventTable.id, id));
    });
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete flavoring event");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
