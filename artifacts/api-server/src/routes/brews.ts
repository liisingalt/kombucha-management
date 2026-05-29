import { Router } from "express";
import { db } from "@workspace/db";
import { teaStockTable, sugarStockTable, sugarStockMovementsTable, brewsTable, brewSessionsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
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

router.get("/brews/sugar-stock", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  try {
    const rows = await db
      .select()
      .from(sugarStockTable)
      .where(eq(sugarStockTable.userId, userId))
      .orderBy(sugarStockTable.name);
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch sugar stock");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/brews/sugar-stock", requireAuth, async (req, res) => {
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
      .from(sugarStockTable)
      .where(and(eq(sugarStockTable.userId, userId), eq(sugarStockTable.name, trimmed)));
    if (existing) {
      await db
        .update(sugarStockTable)
        .set({ qtyG: existing.qtyG + qty })
        .where(eq(sugarStockTable.id, existing.id));
      if (qty !== 0) {
        await db.insert(sugarStockMovementsTable).values({
          userId, sugarStockId: existing.id, deltaG: qty, reason: "manual", note: trimmed,
        });
      }
    } else {
      const [inserted] = await db.insert(sugarStockTable).values({ userId, name: trimmed, qtyG: qty }).returning();
      if (qty !== 0) {
        await db.insert(sugarStockMovementsTable).values({
          userId, sugarStockId: inserted.id, deltaG: qty, reason: "manual", note: trimmed,
        });
      }
    }
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to add sugar stock");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/brews/sugar-stock/:id", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const id = Number(req.params.id);
  const { name, qtyG } = req.body;
  try {
    const update: Record<string, unknown> = {};
    if (name !== undefined) update.name = String(name).trim();
    if (qtyG !== undefined) update.qtyG = Number(qtyG);
    await db
      .update(sugarStockTable)
      .set(update)
      .where(and(eq(sugarStockTable.id, id), eq(sugarStockTable.userId, userId)));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to update sugar stock");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/brews/sugar-stock/:id", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const id = Number(req.params.id);
  try {
    await db
      .delete(sugarStockTable)
      .where(and(eq(sugarStockTable.id, id), eq(sugarStockTable.userId, userId)));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete sugar stock");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/brews/sugar-stock/:id/movements", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const id = Number(req.params.id);
  try {
    const rows = await db
      .select()
      .from(sugarStockMovementsTable)
      .where(and(eq(sugarStockMovementsTable.sugarStockId, id), eq(sugarStockMovementsTable.userId, userId)))
      .orderBy(desc(sugarStockMovementsTable.createdAt))
      .limit(50);
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch sugar stock movements");
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

  type PortionPayload = {
    boiledL: number; teaStockId: number | null; teaSort: string;
    teaG: number; steepMin: number; steepHeat: number;
    sugarG: number; coldWaterL: number; starterG: number;
  };
  const portions: PortionPayload[] = Array.isArray(b.portions) ? b.portions : [{
    boiledL: Number(b.boiledL) || 0,
    teaStockId: b.teaStockId ? Number(b.teaStockId) : null,
    teaSort: b.teaSort ?? "",
    teaG: Number(b.teaG) || 0,
    steepMin: Number(b.steepMin) || 0,
    steepHeat: Number(b.steepHeat) || 0,
    sugarG: Number(b.sugarG) || 0,
    coldWaterL: Number(b.coldWaterL) || 0,
    starterG: Number(b.starterG) || 0,
  }];

  const sugarStockId = b.sugarStockId ? Number(b.sugarStockId) : null;
  if (!sugarStockId) {
    res.status(400).json({ error: "suhkru varu on kohustuslik" });
    return;
  }

  try {
    await db.transaction(async (tx) => {
      let sessionId: number | null = null;
      if (portions.length > 1) {
        const [sess] = await tx
          .insert(brewSessionsTable)
          .values({ userId, date: b.date })
          .returning({ id: brewSessionsTable.id });
        sessionId = sess.id;
      }

      for (const p of portions) {
        const teaG = Number(p.teaG) || 0;
        const sugarG = Number(p.sugarG) || 0;
        const pTeaStockId = p.teaStockId ? Number(p.teaStockId) : null;

        await tx.insert(brewsTable).values({
          userId,
          sessionId,
          date: b.date,
          boiledL: Number(p.boiledL) || 0,
          startBoilTime: b.startBoilTime ?? "",
          tempReachedMin: b.tempReachedMin != null && b.tempReachedMin !== "" ? Number(b.tempReachedMin) : null,
          temp: b.temp != null && b.temp !== "" ? Number(b.temp) : null,
          teaStockId: pTeaStockId,
          teaSort: p.teaSort ?? "",
          teaG,
          steepMin: Number(p.steepMin) || 0,
          steepHeat: Number(p.steepHeat) || 0,
          sugarStockId,
          sugarG,
          coldWaterL: Number(p.coldWaterL) || 0,
          coolStartTime: b.coolStartTime ?? "",
          coolPlace: b.coolPlace ?? "",
          coolTemp: b.coolTemp != null && b.coolTemp !== "" ? Number(b.coolTemp) : null,
          continuedTime: b.continuedTime ?? "",
          notes: b.notes ?? "",
          starterPct: Number(b.starterPct) || 0,
          starterG: Number(p.starterG) || 0,
          electricityKwh: b.electricityKwh != null && b.electricityKwh !== "" ? Number(b.electricityKwh) : null,
        });

        if (pTeaStockId && teaG > 0) {
          const [ts] = await tx
            .select()
            .from(teaStockTable)
            .where(and(eq(teaStockTable.id, pTeaStockId), eq(teaStockTable.userId, userId)));
          if (ts) {
            await tx
              .update(teaStockTable)
              .set({ qtyG: ts.qtyG - teaG })
              .where(eq(teaStockTable.id, pTeaStockId));
          }
        }

        if (sugarStockId && sugarG > 0) {
          const [ss] = await tx
            .select()
            .from(sugarStockTable)
            .where(and(eq(sugarStockTable.id, sugarStockId), eq(sugarStockTable.userId, userId)));
          if (ss) {
            await tx
              .update(sugarStockTable)
              .set({ qtyG: ss.qtyG - sugarG })
              .where(eq(sugarStockTable.id, sugarStockId));
            await tx.insert(sugarStockMovementsTable).values({
              userId, sugarStockId, deltaG: -sugarG, reason: "brew", note: b.date ?? null,
            });
          }
        }
      }
    });
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to save brew");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/brews/tea-stock/:id/default", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const id = Number(req.params.id);
  try {
    const [row] = await db.select().from(teaStockTable).where(and(eq(teaStockTable.id, id), eq(teaStockTable.userId, userId)));
    if (!row) { res.status(404).json({ error: "ei leitud" }); return; }
    const newDefault = !row.isDefault;
    await db.update(teaStockTable).set({ isDefault: false }).where(eq(teaStockTable.userId, userId));
    if (newDefault) {
      await db.update(teaStockTable).set({ isDefault: true }).where(eq(teaStockTable.id, id));
    }
    res.json({ ok: true, isDefault: newDefault });
  } catch (err) {
    req.log.error({ err }, "Failed to set tea default");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/brews/sugar-stock/:id/default", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const id = Number(req.params.id);
  try {
    const [row] = await db.select().from(sugarStockTable).where(and(eq(sugarStockTable.id, id), eq(sugarStockTable.userId, userId)));
    if (!row) { res.status(404).json({ error: "ei leitud" }); return; }
    const newDefault = !row.isDefault;
    await db.update(sugarStockTable).set({ isDefault: false }).where(eq(sugarStockTable.userId, userId));
    if (newDefault) {
      await db.update(sugarStockTable).set({ isDefault: true }).where(eq(sugarStockTable.id, id));
    }
    res.json({ ok: true, isDefault: newDefault });
  } catch (err) {
    req.log.error({ err }, "Failed to set sugar default");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/brews/tea-stock/:id", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const id = Number(req.params.id);
  const { name } = req.body;
  if (!name || !String(name).trim()) {
    res.status(400).json({ error: "nimi puudub" });
    return;
  }
  try {
    const trimmed = String(name).trim();
    const [row] = await db
      .select()
      .from(teaStockTable)
      .where(and(eq(teaStockTable.id, id), eq(teaStockTable.userId, userId)));
    if (!row) {
      res.status(404).json({ error: "ei leitud" });
      return;
    }
    const [conflict] = await db
      .select()
      .from(teaStockTable)
      .where(and(eq(teaStockTable.userId, userId), eq(teaStockTable.name, trimmed)));
    if (conflict && conflict.id !== id) {
      res.status(409).json({ error: "Sama nimega sort on juba olemas" });
      return;
    }
    await db
      .update(teaStockTable)
      .set({ name: trimmed })
      .where(eq(teaStockTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to rename tea stock");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/brews/tea-stock/:id", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const id = Number(req.params.id);
  try {
    await db
      .delete(teaStockTable)
      .where(and(eq(teaStockTable.id, id), eq(teaStockTable.userId, userId)));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete tea stock");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/brews/:id", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const id = Number(req.params.id);
  const b = req.body;
  try {
    await db.transaction(async (tx) => {
      const [old] = await tx
        .select()
        .from(brewsTable)
        .where(and(eq(brewsTable.id, id), eq(brewsTable.userId, userId)));
      if (!old) {
        res.status(404).json({ error: "ei leitud" });
        return;
      }
      const newTeaStockId = b.teaStockId ? Number(b.teaStockId) : null;
      const newTeaG = Number(b.teaG) || 0;
      if (old.teaStockId && old.teaG > 0) {
        const [oldTs] = await tx
          .select()
          .from(teaStockTable)
          .where(and(eq(teaStockTable.id, old.teaStockId), eq(teaStockTable.userId, userId)));
        if (oldTs) {
          await tx
            .update(teaStockTable)
            .set({ qtyG: oldTs.qtyG + old.teaG })
            .where(eq(teaStockTable.id, old.teaStockId));
        }
      }
      if (newTeaStockId && newTeaG > 0) {
        const [newTs] = await tx
          .select()
          .from(teaStockTable)
          .where(and(eq(teaStockTable.id, newTeaStockId), eq(teaStockTable.userId, userId)));
        if (newTs) {
          await tx
            .update(teaStockTable)
            .set({ qtyG: newTs.qtyG - newTeaG })
            .where(eq(teaStockTable.id, newTeaStockId));
        }
      }
      const newSugarStockId = b.sugarStockId ? Number(b.sugarStockId) : null;
      const newSugarG = Number(b.sugarG) || 0;
      if (old.sugarStockId && old.sugarG > 0) {
        const [oldSs] = await tx
          .select()
          .from(sugarStockTable)
          .where(and(eq(sugarStockTable.id, old.sugarStockId), eq(sugarStockTable.userId, userId)));
        if (oldSs) {
          await tx
            .update(sugarStockTable)
            .set({ qtyG: oldSs.qtyG + old.sugarG })
            .where(eq(sugarStockTable.id, old.sugarStockId));
          await tx.insert(sugarStockMovementsTable).values({
            userId, sugarStockId: old.sugarStockId, deltaG: old.sugarG, reason: "brew_edited", brewId: id, note: old.date ?? null,
          });
        }
      }
      if (newSugarStockId && newSugarG > 0) {
        const [newSs] = await tx
          .select()
          .from(sugarStockTable)
          .where(and(eq(sugarStockTable.id, newSugarStockId), eq(sugarStockTable.userId, userId)));
        if (newSs) {
          await tx
            .update(sugarStockTable)
            .set({ qtyG: newSs.qtyG - newSugarG })
            .where(eq(sugarStockTable.id, newSugarStockId));
          await tx.insert(sugarStockMovementsTable).values({
            userId, sugarStockId: newSugarStockId, deltaG: -newSugarG, reason: "brew_edited", brewId: id, note: b.date ?? null,
          });
        }
      }
      await tx
        .update(brewsTable)
        .set({
          date: b.date,
          boiledL: Number(b.boiledL) || 0,
          startBoilTime: b.startBoilTime ?? "",
          tempReachedMin: b.tempReachedMin != null && b.tempReachedMin !== "" ? Number(b.tempReachedMin) : null,
          temp: b.temp != null && b.temp !== "" ? Number(b.temp) : null,
          teaStockId: newTeaStockId,
          teaSort: b.teaSort ?? "",
          teaG: newTeaG,
          steepMin: Number(b.steepMin) || 0,
          steepHeat: Number(b.steepHeat) || 0,
          sugarStockId: newSugarStockId,
          sugarG: newSugarG,
          coldWaterL: Number(b.coldWaterL) || 0,
          coolStartTime: b.coolStartTime ?? "",
          coolPlace: b.coolPlace ?? "",
          coolTemp: b.coolTemp != null && b.coolTemp !== "" ? Number(b.coolTemp) : null,
          continuedTime: b.continuedTime ?? "",
          notes: b.notes ?? "",
          starterPct: Number(b.starterPct) || 0,
          starterG: Number(b.starterG) || 0,
          electricityKwh: b.electricityKwh != null && b.electricityKwh !== "" ? Number(b.electricityKwh) : null,
        })
        .where(and(eq(brewsTable.id, id), eq(brewsTable.userId, userId)));
    });
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to patch brew");
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
      if (row.sugarStockId && row.sugarG > 0) {
        const [ss] = await tx
          .select()
          .from(sugarStockTable)
          .where(and(eq(sugarStockTable.id, row.sugarStockId), eq(sugarStockTable.userId, userId)));
        if (ss) {
          await tx
            .update(sugarStockTable)
            .set({ qtyG: ss.qtyG + row.sugarG })
            .where(eq(sugarStockTable.id, row.sugarStockId));
          await tx.insert(sugarStockMovementsTable).values({
            userId, sugarStockId: row.sugarStockId, deltaG: row.sugarG, reason: "brew_deleted", brewId: id, note: row.date ?? null,
          });
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
