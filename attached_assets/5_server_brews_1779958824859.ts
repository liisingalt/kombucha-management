// =====================================================================
//  PRUULIMISE MARSRUUT  —  salvesta failina  server/brews.ts
//  Registreerimine: vt README.
// =====================================================================
import type { Express } from "express";
import { db } from "./db"; // <-- kohanda, kui db asub mujal
import { teaStock, brews } from "@shared/schema";
import { eq, sql, desc } from "drizzle-orm";

export function registerBrewRoutes(app: Express) {
  // Tee varu nimekiri (kasutatakse ka Tee sordi rippmenüüks)
  app.get("/api/brews/tea-stock", async (_req, res) => {
    const rows = await db.select().from(teaStock).orderBy(teaStock.name);
    res.json(rows);
  });

  // Lisa teed lattu (uus sort või olemasoleva juurde)
  app.post("/api/brews/tea-stock", async (req, res) => {
    const { name, qtyG } = req.body;
    if (!name) return res.status(400).json({ error: "nimi puudub" });
    await db
      .insert(teaStock)
      .values({ name: String(name).trim(), qtyG: Number(qtyG) || 0 })
      .onConflictDoUpdate({
        target: teaStock.name,
        set: { qtyG: sql`${teaStock.qtyG} + ${Number(qtyG) || 0}` },
      });
    res.json({ ok: true });
  });

  // Pruulimiste ajalugu
  app.get("/api/brews", async (_req, res) => {
    const rows = await db.select().from(brews).orderBy(desc(brews.id)).limit(50);
    res.json(rows);
  });

  // Uus pruulimine: salvestab kirje ja arvab tee laost maha
  app.post("/api/brews", async (req, res) => {
    const b = req.body;
    const teaG = Number(b.teaG) || 0;
    const teaStockId = b.teaStockId ? Number(b.teaStockId) : null;

    await db.transaction(async (tx) => {
      await tx.insert(brews).values({
        date: b.date,
        boiledL: Number(b.boiledL) || 0,
        startBoilTime: b.startBoilTime ?? "",
        tempReachedMin: b.tempReachedMin != null ? Number(b.tempReachedMin) : null,
        temp: b.temp != null ? Number(b.temp) : null,
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
        await tx
          .update(teaStock)
          .set({ qtyG: sql`${teaStock.qtyG} - ${teaG}` })
          .where(eq(teaStock.id, teaStockId));
      }
    });
    res.json({ ok: true });
  });

  // Kustuta pruulimine ja taasta tee laoseis
  app.delete("/api/brews/:id", async (req, res) => {
    const id = Number(req.params.id);
    await db.transaction(async (tx) => {
      const [row] = await tx.select().from(brews).where(eq(brews.id, id));
      if (!row) return;
      if (row.teaStockId && row.teaG > 0) {
        await tx
          .update(teaStock)
          .set({ qtyG: sql`${teaStock.qtyG} + ${row.teaG}` })
          .where(eq(teaStock.id, row.teaStockId));
      }
      await tx.delete(brews).where(eq(brews.id, id));
    });
    res.json({ ok: true });
  });
}
