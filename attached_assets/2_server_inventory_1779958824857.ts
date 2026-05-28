// =====================================================================
//  LAO MARSRUUT  —  salvesta see failina  server/inventory.ts
//  Registreerimine: vt all olevat juhist failis README.
//  Kohanda kahte importi, kui Sinu projektis on teised teed/nimed.
// =====================================================================
import type { Express } from "express";
import { db } from "./db"; // <-- kohanda, kui Sinu db asub mujal
import {
  bottleStock,
  labelStock,
  capStock,
  flavorCapDefault,
  inventoryMovement,
  flavors, // <-- kohanda, kui Sinu maitsete tabel on teise nimega
} from "@shared/schema";
import { eq, sql, desc } from "drizzle-orm";

type Delta =
  | { kind: "bottle"; size: number; amount: number }
  | { kind: "label"; flavorId: number; size: number; amount: number }
  | { kind: "cap"; capId: number; amount: number };

// Rakendab laoseisu muudatused. Negatiivne amount tähendab maha arvamist.
async function applyDeltas(tx: any, deltas: Delta[]) {
  for (const d of deltas) {
    if (d.kind === "bottle") {
      await tx
        .insert(bottleStock)
        .values({ size: d.size, qty: d.amount })
        .onConflictDoUpdate({
          target: bottleStock.size,
          set: { qty: sql`${bottleStock.qty} + ${d.amount}` },
        });
    } else if (d.kind === "label") {
      await tx
        .insert(labelStock)
        .values({ flavorId: d.flavorId, size: d.size, qty: d.amount })
        .onConflictDoUpdate({
          target: [labelStock.flavorId, labelStock.size],
          set: { qty: sql`${labelStock.qty} + ${d.amount}` },
        });
    } else if (d.kind === "cap") {
      await tx
        .update(capStock)
        .set({ qty: sql`${capStock.qty} + ${d.amount}` })
        .where(eq(capStock.id, d.capId));
    }
  }
}

export function registerInventoryRoutes(app: Express) {
  // Kogu laoseis korraga
  app.get("/api/inventory/state", async (_req, res) => {
    const [bottles, labels, caps, defaults, movements] = await Promise.all([
      db.select().from(bottleStock),
      db.select().from(labelStock),
      db.select().from(capStock),
      db.select().from(flavorCapDefault),
      db.select().from(inventoryMovement).orderBy(desc(inventoryMovement.id)).limit(50),
    ]);
    res.json({ bottles, labels, caps, defaults, movements });
  });

  // Maitsed Sinu olemasolevast tabelist (kohanda veeru nime, kui pole "name")
  app.get("/api/inventory/flavors", async (_req, res) => {
    const rows = await db.select({ id: flavors.id, name: flavors.name }).from(flavors);
    res.json(rows);
  });

  // Ost: pudelid
  app.post("/api/inventory/purchase/bottles", async (req, res) => {
    const { size, qty, summary } = req.body;
    const deltas: Delta[] = [{ kind: "bottle", size: Number(size), amount: Number(qty) }];
    await db.transaction(async (tx) => {
      await applyDeltas(tx, deltas);
      await tx.insert(inventoryMovement).values({
        kind: "ost",
        summary: summary ?? `Ostsin ${qty} × pudel ${size} ml`,
        deltas,
      });
    });
    res.json({ ok: true });
  });

  // Ost: sildid
  app.post("/api/inventory/purchase/labels", async (req, res) => {
    const { flavorId, size, qty, summary } = req.body;
    const deltas: Delta[] = [
      { kind: "label", flavorId: Number(flavorId), size: Number(size), amount: Number(qty) },
    ];
    await db.transaction(async (tx) => {
      await applyDeltas(tx, deltas);
      await tx.insert(inventoryMovement).values({
        kind: "ost",
        summary: summary ?? `Ostsin ${qty} × silt ${size} ml`,
        deltas,
      });
    });
    res.json({ ok: true });
  });

  // Ost: korgid (olemasolev kork capId kaudu, või uus kork size/type/color kaudu)
  app.post("/api/inventory/purchase/caps", async (req, res) => {
    const { capId, size, type, color, qty, summary } = req.body;
    await db.transaction(async (tx) => {
      let id = capId ? Number(capId) : null;
      if (!id) {
        const [row] = await tx
          .insert(capStock)
          .values({ size: Number(size), type: type ?? "", color: color ?? "", qty: 0 })
          .returning({ id: capStock.id });
        id = row.id;
      }
      const deltas: Delta[] = [{ kind: "cap", capId: id as number, amount: Number(qty) }];
      await applyDeltas(tx, deltas);
      await tx.insert(inventoryMovement).values({
        kind: "ost",
        summary: summary ?? `Ostsin ${qty} korki`,
        deltas,
      });
    });
    res.json({ ok: true });
  });

  // Villimine: server arvutab maha arvamise ise, et tulemus oleks alati õige
  app.post("/api/inventory/bottling", async (req, res) => {
    const b = req.body;
    const total = Math.max(0, Number(b.total) || 0);
    const returned = Math.min(total, Math.max(0, Number(b.returned) || 0));
    const labeled = Math.min(total - returned, Math.max(0, Number(b.labeled) || 0));
    const oldCaps = Math.min(total, Math.max(0, Number(b.oldCaps) || 0));
    const size = Number(b.size);
    const flavorId = Number(b.flavorId);
    const capId = b.capId ? Number(b.capId) : null;

    const bottleDeduct = total - returned;
    const labelDeduct = total - returned - labeled;
    const capDeduct = capId ? total - oldCaps : 0;

    const deltas: Delta[] = [];
    if (bottleDeduct > 0) deltas.push({ kind: "bottle", size, amount: -bottleDeduct });
    if (labelDeduct > 0) deltas.push({ kind: "label", flavorId, size, amount: -labelDeduct });
    if (capId && capDeduct > 0) deltas.push({ kind: "cap", capId, amount: -capDeduct });

    await db.transaction(async (tx) => {
      await applyDeltas(tx, deltas);
      await tx.insert(inventoryMovement).values({
        kind: "villimine",
        summary: b.summary ?? `Villisin ${total} × ${size} ml`,
        deltas,
      });
    });
    res.json({ ok: true });
  });

  // Maitse vaikekork
  app.post("/api/inventory/flavor-cap-default", async (req, res) => {
    const { flavorId, size, capId } = req.body;
    await db
      .insert(flavorCapDefault)
      .values({ flavorId: Number(flavorId), size: Number(size), capId: Number(capId) })
      .onConflictDoUpdate({
        target: [flavorCapDefault.flavorId, flavorCapDefault.size],
        set: { capId: Number(capId) },
      });
    res.json({ ok: true });
  });

  // Võta kanne tagasi (taastab laoseisu)
  app.delete("/api/inventory/movements/:id", async (req, res) => {
    const id = Number(req.params.id);
    await db.transaction(async (tx) => {
      const [m] = await tx.select().from(inventoryMovement).where(eq(inventoryMovement.id, id));
      if (!m) return;
      const reverse = (m.deltas as Delta[]).map((x) => ({ ...x, amount: -x.amount }));
      await applyDeltas(tx, reverse);
      await tx.delete(inventoryMovement).where(eq(inventoryMovement.id, id));
    });
    res.json({ ok: true });
  });
}
