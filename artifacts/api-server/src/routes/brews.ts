import { Router } from "express";
import { db } from "@workspace/db";
import { teaStockTable, brewsTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";

const router = Router();

router.get("/brews/tea-stock", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  try {
    const rows = await db
      .select()
      .from(teaStockTable)
      .where(eq(teaStockTable.userId, userId))
      .orderBy(teaStockTable.name);
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch tea stock");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/brews/tea-stock", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const { name, qtyG } = req.body;
  if (!name) {
    res.status(400).json({ error: "nimi puudub" });
    return;
  }
  try {
    const trimmed = String(name).trim();
    const qty = Number(qtyG) || 0;
    const [existing] = await db
      .select()
      .from(teaStockTable)
      .where(and(eq(teaStockTable.userId, userId), eq(teaStockTable.name, trimmed)));
    if (existing) {
      await db
        .update(teaStockTable)
        .set({ qtyG: existing.qtyG + qty })
        .where(eq(teaStockTable.id, existing.id));
    } else {
      await db.insert(teaStockTable).values({ userId, name: trimmed, qtyG: qty });
    }
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to add tea stock");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/brews", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  try {
    const rows = await db
      .select()
      .from(brewsTable)
      .where(eq(brewsTable.userId, userId))
      .orderBy(desc(brewsTable.id))
      .limit(50);
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch brews");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/brews", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const b = req.body;
  const teaG = Number(b.teaG) || 0;
  const teaStockId = b.teaStockId ? Number(b.teaStockId) : null;
  try {
    await db.transaction(async (tx) => {
      await tx.insert(brewsTable).values({
        userId,
        date: b.date,
        boiledL: Number(b.boiledL) || 0,
        startBoilTime: b.startBoilTime ?? "",
        tempReachedMin: b.tempReachedMin != null && b.tempReachedMin !== "" ? Number(b.tempReachedMin) : null,
        temp: b.temp != null && b.temp !== "" ? Number(b.temp) : null,
        teaStockId,
        teaSort: b.teaSort ?? "",
        teaG,
        steepMin: Number(b.steepMin) || 0,
        steepHeat: Number(b.steepHeat) || 0,
        sugarG: Number(b.sugarG) || 0,
        coldWaterL: Number(b.coldWaterL) || 0,
        coolStartTime: b.coolStartTime ?? "",
        coolPlace: b.coolPlace ?? "",
        coolTemp: b.coolTemp != null && b.coolTemp !== "" ? Number(b.coolTemp) : null,
        continuedTime: b.continuedTime ?? "",
        notes: b.notes ?? "",
        starterPct: Number(b.starterPct) || 0,
        starterG: Number(b.starterG) || 0,
        electricityKwh: b.electricityKwh != null && b.electricityKwh !== "" ? Number(b.electricityKwh) : null,
      });
      if (teaStockId && teaG > 0) {
        const [ts] = await tx
          .select()
          .from(teaStockTable)
          .where(and(eq(teaStockTable.id, teaStockId), eq(teaStockTable.userId, userId)));
        if (ts) {
          await tx
            .update(teaStockTable)
            .set({ qtyG: ts.qtyG - teaG })
            .where(eq(teaStockTable.id, teaStockId));
        }
      }
    });
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to save brew");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/brews/:id", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const id = Number(req.params.id);
  try {
    await db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(brewsTable)
        .where(and(eq(brewsTable.id, id), eq(brewsTable.userId, userId)));
      if (!row) return;
      if (row.teaStockId && row.teaG > 0) {
        const [ts] = await tx
          .select()
          .from(teaStockTable)
          .where(and(eq(teaStockTable.id, row.teaStockId), eq(teaStockTable.userId, userId)));
        if (ts) {
          await tx
            .update(teaStockTable)
            .set({ qtyG: ts.qtyG + row.teaG })
            .where(eq(teaStockTable.id, row.teaStockId));
        }
      }
      await tx.delete(brewsTable).where(eq(brewsTable.id, id));
    });
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete brew");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
