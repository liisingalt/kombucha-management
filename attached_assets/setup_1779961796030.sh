#!/usr/bin/env bash
# =====================================================================
#  Kombucha susteem: ladu + pruulimine + kaarimine + maitsestamine
#  Replitis: ava Shell, kleebi see fail tervikuna, vajuta Enter.
#  Voi salvesta failina setup.sh ja kaivita:  bash setup.sh
# =====================================================================
set -e
if [ ! -d "shared" ] || [ ! -d "server" ]; then
  echo "HOIATUS: ei leia kaustu shared/ ja server/. Kaivita projekti juurkaustas."
fi
mkdir -p shared server client/src/pages
echo "Loon failid..."

cat > shared/kombucha-schema.ts <<'SCHEMA_EOF'
// =====================================================================
//  KOMBUCHA SÜSTEEMI TABELID (ladu + pruulimine + käärimine)
//  Asukoht: shared/kombucha-schema.ts
//  shared/schema.ts faili lisatakse rida:  export * from "./kombucha-schema";
// =====================================================================
import {
  pgTable,
  serial,
  integer,
  real,
  text,
  timestamp,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/* ---------------- LADU ---------------- */

// Pudelid: üks rida iga suuruse kohta (330, 500, 750). Sõltumatu maitsest.
export const bottleStock = pgTable("bottle_stock", {
  id: serial("id").primaryKey(),
  size: integer("size").notNull().unique(),
  qty: integer("qty").notNull().default(0),
});

// Sildid: maitse + suurus. flavorId viitab olemasolevale maitsete tabelile.
// NB! Kui maitse id on tekst/uuid, muuda integer -> text.
export const labelStock = pgTable(
  "label_stock",
  {
    id: serial("id").primaryKey(),
    flavorId: integer("flavor_id").notNull(),
    size: integer("size").notNull(),
    qty: integer("qty").notNull().default(0),
  },
  (t) => ({
    uniq: uniqueIndex("label_flavor_size_uniq").on(t.flavorId, t.size),
  })
);

// Korgid: suurus + tüüp + värv.
export const capStock = pgTable("cap_stock", {
  id: serial("id").primaryKey(),
  size: integer("size").notNull(),
  type: text("type").notNull().default(""),
  color: text("color").notNull().default(""),
  qty: integer("qty").notNull().default(0),
});

// Maitse vaikekork.
export const flavorCapDefault = pgTable(
  "flavor_cap_default",
  {
    id: serial("id").primaryKey(),
    flavorId: integer("flavor_id").notNull(),
    size: integer("size").notNull(),
    capId: integer("cap_id").notNull(),
  },
  (t) => ({
    uniq: uniqueIndex("flavor_cap_default_uniq").on(t.flavorId, t.size),
  })
);

// Liikumised: iga ost ja villimine, et kanne saaks tagasi võtta.
export const inventoryMovement = pgTable("inventory_movement", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  kind: text("kind").notNull(),
  summary: text("summary").notNull(),
  deltas: jsonb("deltas").notNull(),
});

/* ---------------- PRUULIMINE ---------------- */

// Tee varu grammides, sordi kaupa.
export const teaStock = pgTable("tea_stock", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  qtyG: integer("qty_g").notNull().default(0),
});

// Üks pruulimine.
export const brews = pgTable("brews", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  date: text("date").notNull(),
  boiledL: real("boiled_l").notNull(),
  startBoilTime: text("start_boil_time").default(""),
  tempReachedMin: integer("temp_reached_min"),
  temp: integer("temp"),
  teaStockId: integer("tea_stock_id"),
  teaSort: text("tea_sort").default(""),
  teaG: integer("tea_g").notNull().default(0),
  steepMin: integer("steep_min").default(10),
  steepHeat: integer("steep_heat").default(0),
  sugarG: integer("sugar_g").notNull().default(0),
  coldWaterL: real("cold_water_l").notNull().default(0),
  coolStartTime: text("cool_start_time").default(""),
  coolPlace: text("cool_place").default(""),
  coolTemp: integer("cool_temp"),
  continuedTime: text("continued_time").default(""),
  notes: text("notes").default(""),
  starterPct: integer("starter_pct").notNull().default(20),
  starterG: integer("starter_g").notNull().default(0),
  electricityKwh: real("electricity_kwh"),
});

/* ---------------- KÄÄRIMINE ---------------- */

// Üks käärimine. Nõud hoitakse vessels-väljas.
export const fermentationBatch = pgTable("fermentation_batch", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  brewId: integer("brew_id"),
  teaSort: text("tea_sort").default(""),
  startDate: text("start_date").notNull(),
  flavoringDate: text("flavoring_date"),
  notes: text("notes").default(""),
  vessels: jsonb("vessels").notNull(),
});

/* ---------------- MAITSESTAMINE (2F) ---------------- */

// Maitsestuse ladu: iga marja/koostisosa variant (nimi + olek + päritolu).
// coefficient = grammi liitri kohta; gramm arvutatakse: liitrid × coefficient.
export const flavoringStock = pgTable("flavoring_stock", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(), // maitsestus, nt "leedrimari"
  olek: text("olek").default(""), // kuivatatud | sügavkülmutatud | värske
  paritolu: text("paritolu").default(""), // nt "IdeaFarm", "Reena Umal"
  coefficient: real("coefficient").notNull().default(1.3),
  qtyG: real("qty_g").notNull().default(0),
});

// Töötlusviisid: kasutaja enda hallatav ripmenüü.
export const processingMethod = pgTable("processing_method", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
});

// Maitsestamine: üks sündmus, blocks hoiab eri maitsestusi.
export const flavoringEvent = pgTable("flavoring_event", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  date: text("date").notNull(), // maitsestamise kuupäev
  fermentationBatchId: integer("fermentation_batch_id"), // valikuline seos käärimisega
  bottlingDate: text("bottling_date"), // villimise aeg
  bottleFermentNote: text("bottle_ferment_note").default(""), // lisakääritus pudelis soojas
  notes: text("notes").default(""), // soovitused
  // blocks = [{ flavoringStockId, name, olek, paritolu, koguseL, vesselL, method, coefficient, gramsUsed, place, temp }]
  blocks: jsonb("blocks").notNull(),
});
SCHEMA_EOF
echo '  loodud: shared/kombucha-schema.ts'

cat > server/inventory.ts <<'INV_EOF'
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
INV_EOF
echo '  loodud: server/inventory.ts'

cat > server/brews.ts <<'BREWS_EOF'
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
BREWS_EOF
echo '  loodud: server/brews.ts'

cat > server/fermentations.ts <<'FERM_EOF'
// =====================================================================
//  KÄÄRIMISE MARSRUUT  —  salvesta failina  server/fermentations.ts
// =====================================================================
import type { Express } from "express";
import { db } from "./db"; // <-- kohanda, kui db asub mujal
import { fermentationBatch } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export function registerFermentationRoutes(app: Express) {
  app.get("/api/fermentations", async (_req, res) => {
    const rows = await db
      .select()
      .from(fermentationBatch)
      .orderBy(desc(fermentationBatch.id))
      .limit(100);
    res.json(rows);
  });

  app.post("/api/fermentations", async (req, res) => {
    const b = req.body;
    await db.insert(fermentationBatch).values({
      brewId: b.brewId ? Number(b.brewId) : null,
      teaSort: b.teaSort ?? "",
      startDate: b.startDate,
      flavoringDate: b.flavoringDate || null,
      notes: b.notes ?? "",
      vessels: Array.isArray(b.vessels) ? b.vessels : [],
    });
    res.json({ ok: true });
  });

  // Maitsestamise kuupäeva või märkmete täitmine hiljem
  app.patch("/api/fermentations/:id", async (req, res) => {
    const id = Number(req.params.id);
    const b = req.body;
    const set: any = {};
    if (b.flavoringDate !== undefined) set.flavoringDate = b.flavoringDate || null;
    if (b.notes !== undefined) set.notes = b.notes ?? "";
    if (Object.keys(set).length) {
      await db.update(fermentationBatch).set(set).where(eq(fermentationBatch.id, id));
    }
    res.json({ ok: true });
  });

  app.delete("/api/fermentations/:id", async (req, res) => {
    await db.delete(fermentationBatch).where(eq(fermentationBatch.id, Number(req.params.id)));
    res.json({ ok: true });
  });
}
FERM_EOF
echo '  loodud: server/fermentations.ts'

cat > server/flavoring.ts <<'FLAV_EOF'
// =====================================================================
//  MAITSESTAMISE MARSRUUT  —  salvesta failina  server/flavoring.ts
// =====================================================================
import type { Express } from "express";
import { db } from "./db"; // <-- kohanda, kui db asub mujal
import {
  flavoringStock,
  processingMethod,
  flavoringEvent,
  fermentationBatch,
} from "@shared/schema";
import { eq, sql, desc, asc } from "drizzle-orm";

type Block = {
  flavoringStockId?: number | null;
  gramsUsed?: number;
  [k: string]: any;
};

export function registerFlavoringRoutes(app: Express) {
  /* ---- MAITSESTUSE LADU ---- */
  app.get("/api/flavoring/stock", async (_req, res) => {
    const rows = await db.select().from(flavoringStock).orderBy(asc(flavoringStock.name));
    res.json(rows);
  });

  app.post("/api/flavoring/stock", async (req, res) => {
    const { name, olek, paritolu, coefficient, qtyG } = req.body;
    if (!name) return res.status(400).json({ error: "nimi puudub" });
    await db.insert(flavoringStock).values({
      name: String(name).trim(),
      olek: olek ?? "",
      paritolu: paritolu ?? "",
      coefficient: coefficient != null ? Number(coefficient) : 1.3,
      qtyG: Number(qtyG) || 0,
    });
    res.json({ ok: true });
  });

  // Lisa grammid olemasolevale variandile
  app.post("/api/flavoring/stock/:id/add", async (req, res) => {
    const id = Number(req.params.id);
    const add = Number(req.body.qtyG) || 0;
    await db
      .update(flavoringStock)
      .set({ qtyG: sql`${flavoringStock.qtyG} + ${add}` })
      .where(eq(flavoringStock.id, id));
    res.json({ ok: true });
  });

  // Muuda koefitsienti
  app.patch("/api/flavoring/stock/:id", async (req, res) => {
    const id = Number(req.params.id);
    const set: any = {};
    if (req.body.coefficient !== undefined) set.coefficient = Number(req.body.coefficient);
    if (req.body.olek !== undefined) set.olek = req.body.olek ?? "";
    if (req.body.paritolu !== undefined) set.paritolu = req.body.paritolu ?? "";
    if (Object.keys(set).length) {
      await db.update(flavoringStock).set(set).where(eq(flavoringStock.id, id));
    }
    res.json({ ok: true });
  });

  app.delete("/api/flavoring/stock/:id", async (req, res) => {
    await db.delete(flavoringStock).where(eq(flavoringStock.id, Number(req.params.id)));
    res.json({ ok: true });
  });

  /* ---- TÖÖTLUSVIISID ---- */
  app.get("/api/flavoring/methods", async (_req, res) => {
    const rows = await db.select().from(processingMethod).orderBy(asc(processingMethod.name));
    res.json(rows);
  });

  app.post("/api/flavoring/methods", async (req, res) => {
    const name = String(req.body.name || "").trim();
    if (!name) return res.status(400).json({ error: "nimi puudub" });
    await db.insert(processingMethod).values({ name }).onConflictDoNothing();
    res.json({ ok: true });
  });

  app.delete("/api/flavoring/methods/:id", async (req, res) => {
    await db.delete(processingMethod).where(eq(processingMethod.id, Number(req.params.id)));
    res.json({ ok: true });
  });

  /* ---- MAITSESTAMISE SÜNDMUSED ---- */
  app.get("/api/flavoring/events", async (_req, res) => {
    const rows = await db.select().from(flavoringEvent).orderBy(desc(flavoringEvent.id)).limit(100);
    res.json(rows);
  });

  app.post("/api/flavoring/events", async (req, res) => {
    const b = req.body;
    const blocks: Block[] = Array.isArray(b.blocks) ? b.blocks : [];
    const fermId = b.fermentationBatchId ? Number(b.fermentationBatchId) : null;

    await db.transaction(async (tx) => {
      await tx.insert(flavoringEvent).values({
        date: b.date,
        fermentationBatchId: fermId,
        bottlingDate: b.bottlingDate || null,
        bottleFermentNote: b.bottleFermentNote ?? "",
        notes: b.notes ?? "",
        blocks,
      });
      // Arva maitsestus laost maha
      for (const blk of blocks) {
        const g = Number(blk.gramsUsed) || 0;
        if (blk.flavoringStockId && g > 0) {
          await tx
            .update(flavoringStock)
            .set({ qtyG: sql`${flavoringStock.qtyG} - ${g}` })
            .where(eq(flavoringStock.id, Number(blk.flavoringStockId)));
        }
      }
      // Seo käärimisega: pane maitsestamise kuupäev käärimise kirjele (käärimise lõpp)
      if (fermId && b.date) {
        await tx
          .update(fermentationBatch)
          .set({ flavoringDate: b.date })
          .where(eq(fermentationBatch.id, fermId));
      }
    });
    res.json({ ok: true });
  });

  app.delete("/api/flavoring/events/:id", async (req, res) => {
    const id = Number(req.params.id);
    await db.transaction(async (tx) => {
      const [ev] = await tx.select().from(flavoringEvent).where(eq(flavoringEvent.id, id));
      if (!ev) return;
      const blocks = (ev.blocks as Block[]) || [];
      for (const blk of blocks) {
        const g = Number(blk.gramsUsed) || 0;
        if (blk.flavoringStockId && g > 0) {
          await tx
            .update(flavoringStock)
            .set({ qtyG: sql`${flavoringStock.qtyG} + ${g}` })
            .where(eq(flavoringStock.id, Number(blk.flavoringStockId)));
        }
      }
      await tx.delete(flavoringEvent).where(eq(flavoringEvent.id, id));
    });
    res.json({ ok: true });
  });
}
FLAV_EOF
echo '  loodud: server/flavoring.ts'

cat > client/src/pages/Ladu.tsx <<'LADU_EOF'
// =====================================================================
//  LAO LEHT  —  salvesta failina  client/src/pages/Ladu.tsx
//  Lisa Wouteri marsruut App.tsx-i (vt README).
//  Stiil on tahtlikult Tailwind-põhine, et ükski shadcn komponent
//  poleks kohustuslik ja leht töötaks kohe.
// =====================================================================
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const SIZES = [330, 500, 750];
const CAP_TYPES = ["kroonkork", "punnkork"];

const COLOR_HEX: Record<string, string> = {
  sinine: "#2563eb",
  punane: "#dc2626",
  kollane: "#eab308",
  roheline: "#16a34a",
  pruun: "#92400e",
  valge: "#f5f5f4",
  must: "#1c1917",
  "läbipaistev": "#d6d3d1",
};

type Flavor = { id: number; name: string };
type Cap = { id: number; size: number; type: string; color: string; qty: number };
type Label = { id: number; flavorId: number; size: number; qty: number };
type Movement = { id: number; createdAt: string; kind: string; summary: string };
type State = {
  bottles: { id: number; size: number; qty: number }[];
  labels: Label[];
  caps: Cap[];
  defaults: { flavorId: number; size: number; capId: number }[];
  movements: Movement[];
};

const capLabel = (c?: Cap) =>
  c ? `${c.size} ml · ${c.type || "kork"}${c.color ? " · " + c.color : ""}` : "";

async function post(url: string, body: any) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

function ColorDot({ color }: { color: string }) {
  const hex = COLOR_HEX[(color || "").toLowerCase()];
  if (!hex) return null;
  return (
    <span
      className="inline-block w-3 h-3 rounded-full border border-stone-300 align-middle mr-1"
      style={{ backgroundColor: hex }}
    />
  );
}

function Seg<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-stone-300 p-1 bg-stone-50">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          onClick={() => onChange(o.value)}
          className={`px-3 py-1.5 text-sm rounded-md transition ${
            value === o.value ? "bg-amber-700 text-white" : "text-stone-600 hover:bg-stone-200"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-amber-600 focus:outline-none";

export default function Ladu() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("ladu");

  const stateQ = useQuery<State>({
    queryKey: ["/api/inventory/state"],
    queryFn: () => fetch("/api/inventory/state").then((r) => r.json()),
  });
  const flavorsQ = useQuery<Flavor[]>({
    queryKey: ["/api/inventory/flavors"],
    queryFn: () => fetch("/api/inventory/flavors").then((r) => r.json()),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["/api/inventory/state"] });

  if (stateQ.isLoading || flavorsQ.isLoading)
    return <div className="p-8 text-stone-500">Laen ladu…</div>;

  const state = stateQ.data!;
  const flavors = flavorsQ.data ?? [];
  const flavorName = (id: number) => flavors.find((f) => f.id === id)?.name ?? "?";
  const bottleQty = (s: number) => state.bottles.find((b) => b.size === s)?.qty ?? 0;

  const tabs = [
    { id: "ladu", label: "Ladu" },
    { id: "villimine", label: "Villimine" },
    { id: "varu", label: "Lisa varu" },
    { id: "seaded", label: "Vaikekorgid" },
    { id: "ajalugu", label: "Ajalugu" },
  ];

  return (
    <div className="min-h-screen bg-stone-50 text-stone-800">
      <div className="mx-auto max-w-3xl px-4 pb-24 pt-6">
        <h1 className="font-serif text-2xl text-stone-900">Kombucha ladu</h1>
        <p className="text-sm text-stone-500 mt-1 mb-5">
          Pudelid, sildid ja korgid. Villimine arvab varud ise maha.
        </p>

        <nav className="flex flex-wrap gap-1 mb-6 border-b border-stone-200">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-2 text-sm -mb-px border-b-2 transition ${
                tab === t.id
                  ? "border-amber-700 text-amber-800 font-medium"
                  : "border-transparent text-stone-500 hover:text-stone-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {tab === "ladu" && (
          <LaduView state={state} flavorName={flavorName} bottleQty={bottleQty} />
        )}
        {tab === "villimine" && (
          <Villimine
            state={state}
            flavors={flavors}
            flavorName={flavorName}
            refresh={refresh}
          />
        )}
        {tab === "varu" && (
          <LisaVaru state={state} flavors={flavors} refresh={refresh} />
        )}
        {tab === "seaded" && (
          <Vaikekorgid state={state} flavors={flavors} refresh={refresh} />
        )}
        {tab === "ajalugu" && <Ajalugu state={state} refresh={refresh} />}
      </div>
    </div>
  );
}

/* ---------- LADU ---------- */
function LaduView({
  state,
  flavorName,
  bottleQty,
}: {
  state: State;
  flavorName: (id: number) => string;
  bottleQty: (s: number) => number;
}) {
  return (
    <div className="space-y-7">
      <section>
        <h2 className="font-serif text-lg mb-3">Pudelid</h2>
        <div className="grid grid-cols-3 gap-3">
          {SIZES.map((s) => {
            const n = bottleQty(s);
            return (
              <div key={s} className="rounded-xl border border-stone-200 bg-white p-4 text-center">
                <div className="text-xs text-stone-500">{s} ml</div>
                <div className={`text-2xl font-semibold ${n <= 0 ? "text-red-600" : ""}`}>{n}</div>
                {n <= 0 && <div className="text-xs text-red-600">telli juurde</div>}
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="font-serif text-lg mb-3">Sildid</h2>
        {state.labels.length === 0 ? (
          <p className="text-sm text-stone-400">Ühtegi silti pole veel lisatud.</p>
        ) : (
          <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-stone-100 text-stone-500 text-left">
                <tr>
                  <th className="px-4 py-2 font-medium">Maitse</th>
                  <th className="px-4 py-2 font-medium">Suurus</th>
                  <th className="px-4 py-2 font-medium text-right">Kogus</th>
                </tr>
              </thead>
              <tbody>
                {state.labels.map((l) => (
                  <tr key={l.id} className="border-t border-stone-100">
                    <td className="px-4 py-2">{flavorName(l.flavorId)}</td>
                    <td className="px-4 py-2 text-stone-500">{l.size} ml</td>
                    <td className={`px-4 py-2 text-right font-medium ${l.qty <= 0 ? "text-red-600" : ""}`}>
                      {l.qty}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="font-serif text-lg mb-3">Korgid</h2>
        <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-stone-100 text-stone-500 text-left">
              <tr>
                <th className="px-4 py-2 font-medium">Kork</th>
                <th className="px-4 py-2 font-medium text-right">Kogus</th>
              </tr>
            </thead>
            <tbody>
              {state.caps.map((c) => (
                <tr key={c.id} className="border-t border-stone-100">
                  <td className="px-4 py-2">
                    <ColorDot color={c.color} />
                    {capLabel(c)}
                  </td>
                  <td className={`px-4 py-2 text-right font-medium ${c.qty <= 0 ? "text-red-600" : ""}`}>
                    {c.qty}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-stone-400 mt-2">
          750 ml korke saad villimisel märkida vanadena, siis neid maha ei arvata.
        </p>
      </section>
    </div>
  );
}

/* ---------- VILLIMINE ---------- */
function Villimine({
  state,
  flavors,
  flavorName,
  refresh,
}: {
  state: State;
  flavors: Flavor[];
  flavorName: (id: number) => string;
  refresh: () => void;
}) {
  const [flavorId, setFlavorId] = useState<number>(flavors[0]?.id ?? 0);
  const [size, setSize] = useState(330);
  const [total, setTotal] = useState("");
  const [returned, setReturned] = useState("");
  const [labeled, setLabeled] = useState("");
  const [capId, setCapId] = useState<number | "">("");
  const [oldCaps, setOldCaps] = useState("");

  const sizeCaps = state.caps.filter((c) => c.size === size);

  useEffect(() => {
    const def = state.defaults.find((d) => d.flavorId === flavorId && d.size === size);
    const exists = def && sizeCaps.some((c) => c.id === def.capId);
    setCapId(exists ? def!.capId : sizeCaps[0]?.id ?? "");
    // eslint-disable-next-line
  }, [flavorId, size]);

  const t = Math.max(0, parseInt(total) || 0);
  const ret = Math.min(t, Math.max(0, parseInt(returned) || 0));
  const lab = Math.min(t - ret, Math.max(0, parseInt(labeled) || 0));
  const old = Math.min(t, Math.max(0, parseInt(oldCaps) || 0));
  const bottleDeduct = t - ret;
  const labelDeduct = t - ret - lab;
  const capDeduct = capId ? t - old : 0;

  const m = useMutation({
    mutationFn: (body: any) => post("/api/inventory/bottling", body),
    onSuccess: () => {
      refresh();
      setTotal("");
      setReturned("");
      setLabeled("");
      setOldCaps("");
    },
  });

  const villi = () => {
    if (!flavorId || t <= 0) return;
    const cap = state.caps.find((c) => c.id === capId);
    const parts = [`Villisin ${t} × ${flavorName(flavorId)} ${size} ml`];
    if (ret) parts.push(`${ret} tagasi tulnud`);
    if (lab) parts.push(`${lab} juba sildiga`);
    if (old) parts.push(`${old} vana korki`);
    if (cap) parts.push(`kork: ${capLabel(cap)}`);
    m.mutate({
      flavorId,
      size,
      total: t,
      returned: ret,
      labeled: lab,
      oldCaps: old,
      capId: capId || null,
      summary: parts.join(" · "),
    });
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-stone-200 bg-white p-5 space-y-4">
        <div>
          <label className="block text-sm text-stone-600 mb-1">Maitse</label>
          <select value={flavorId} onChange={(e) => setFlavorId(Number(e.target.value))} className={inputCls}>
            {flavors.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm text-stone-600 mb-1">Suurus</label>
          <Seg options={SIZES.map((s) => ({ value: s, label: `${s} ml` }))} value={size} onChange={setSize} />
        </div>
        <div>
          <label className="block text-sm text-stone-600 mb-1">Mitu pudelit kokku tegid?</label>
          <input type="number" value={total} onChange={(e) => setTotal(e.target.value)} className={inputCls} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-stone-600 mb-1">Tagasi tulnud pudelid</label>
            <input type="number" value={returned} onChange={(e) => setReturned(e.target.value)} className={inputCls} />
            <p className="text-xs text-stone-400 mt-1">Pudel + silt olemas</p>
          </div>
          <div>
            <label className="block text-sm text-stone-600 mb-1">Lisaks juba sildiga</label>
            <input type="number" value={labeled} onChange={(e) => setLabeled(e.target.value)} className={inputCls} />
            <p className="text-xs text-stone-400 mt-1">Ainult silt oli olemas</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-stone-600 mb-1">Kork</label>
            <select value={capId} onChange={(e) => setCapId(e.target.value ? Number(e.target.value) : "")} className={inputCls}>
              {sizeCaps.length === 0 && <option value="">korki pole</option>}
              {sizeCaps.map((c) => (
                <option key={c.id} value={c.id}>{capLabel(c)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-stone-600 mb-1">Vanu korke kasutatud</label>
            <input type="number" value={oldCaps} onChange={(e) => setOldCaps(e.target.value)} className={inputCls} />
            <p className="text-xs text-stone-400 mt-1">Peamiselt 750 ml</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
        <p className="font-medium text-amber-900 mb-2">Laost arvatakse maha:</p>
        <ul className="space-y-1">
          <li>Pudelid {size} ml: <b>{bottleDeduct}</b></li>
          <li>Sildid {flavorName(flavorId)} {size} ml: <b>{labelDeduct}</b></li>
          <li>Korgid: <b>{capId ? capDeduct : 0}</b></li>
        </ul>
      </div>

      <button
        onClick={villi}
        disabled={m.isPending}
        className="w-full rounded-lg bg-amber-700 py-3 text-white font-medium hover:bg-amber-800 disabled:opacity-50"
      >
        {m.isPending ? "Salvestan…" : "Pane villimine kirja"}
      </button>
    </div>
  );
}

/* ---------- LISA VARU ---------- */
function LisaVaru({
  state,
  flavors,
  refresh,
}: {
  state: State;
  flavors: Flavor[];
  refresh: () => void;
}) {
  const [bSize, setBSize] = useState(330);
  const [bQty, setBQty] = useState("");
  const [lFlavor, setLFlavor] = useState<number>(flavors[0]?.id ?? 0);
  const [lSize, setLSize] = useState(330);
  const [lQty, setLQty] = useState("");
  const [cMode, setCMode] = useState<"olemasolev" | "uus">("olemasolev");
  const [cExisting, setCExisting] = useState<number | "">(state.caps[0]?.id ?? "");
  const [cSize, setCSize] = useState(330);
  const [cType, setCType] = useState("kroonkork");
  const [cColor, setCColor] = useState("");
  const [cQty, setCQty] = useState("");

  const mut = useMutation({
    mutationFn: ({ url, body }: { url: string; body: any }) => post(url, body),
    onSuccess: refresh,
  });

  const flavorName = (id: number) => flavors.find((f) => f.id === id)?.name ?? "";

  const addBottles = () => {
    const q = parseInt(bQty) || 0;
    if (q <= 0) return;
    mut.mutate({ url: "/api/inventory/purchase/bottles", body: { size: bSize, qty: q, summary: `Ostsin ${q} × pudel ${bSize} ml` } });
    setBQty("");
  };
  const addLabels = () => {
    const q = parseInt(lQty) || 0;
    if (!lFlavor || q <= 0) return;
    mut.mutate({ url: "/api/inventory/purchase/labels", body: { flavorId: lFlavor, size: lSize, qty: q, summary: `Ostsin ${q} × silt ${flavorName(lFlavor)} ${lSize} ml` } });
    setLQty("");
  };
  const addCaps = () => {
    const q = parseInt(cQty) || 0;
    if (q <= 0) return;
    if (cMode === "olemasolev") {
      if (!cExisting) return;
      const c = state.caps.find((x) => x.id === cExisting);
      mut.mutate({ url: "/api/inventory/purchase/caps", body: { capId: cExisting, qty: q, summary: `Ostsin ${q} × ${capLabel(c)}` } });
    } else {
      mut.mutate({ url: "/api/inventory/purchase/caps", body: { size: cSize, type: cType, color: cColor.trim(), qty: q, summary: `Ostsin ${q} × ${cSize} ml ${cType}${cColor ? " " + cColor : ""}` } });
    }
    setCQty("");
  };

  return (
    <div className="space-y-5">
      <Card title="Pudelid">
        <Seg options={SIZES.map((s) => ({ value: s, label: `${s} ml` }))} value={bSize} onChange={setBSize} />
        <div className="mt-3 flex gap-2">
          <input type="number" value={bQty} onChange={(e) => setBQty(e.target.value)} className={inputCls} />
          <button onClick={addBottles} className="rounded-lg bg-amber-700 px-4 text-white">Lisa</button>
        </div>
      </Card>

      <Card title="Sildid">
        <div className="grid grid-cols-2 gap-3">
          <select value={lFlavor} onChange={(e) => setLFlavor(Number(e.target.value))} className={inputCls}>
            {flavors.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
          <Seg options={SIZES.map((s) => ({ value: s, label: `${s}` }))} value={lSize} onChange={setLSize} />
        </div>
        <div className="mt-3 flex gap-2">
          <input type="number" value={lQty} onChange={(e) => setLQty(e.target.value)} className={inputCls} />
          <button onClick={addLabels} className="rounded-lg bg-amber-700 px-4 text-white">Lisa</button>
        </div>
      </Card>

      <Card title="Korgid">
        <Seg
          options={[
            { value: "olemasolev", label: "Olemasolev kork" },
            { value: "uus", label: "Uus kork" },
          ]}
          value={cMode}
          onChange={setCMode}
        />
        {cMode === "olemasolev" ? (
          <select value={cExisting} onChange={(e) => setCExisting(e.target.value ? Number(e.target.value) : "")} className={`${inputCls} mt-3`}>
            {state.caps.map((c) => (
              <option key={c.id} value={c.id}>{capLabel(c)}</option>
            ))}
          </select>
        ) : (
          <div className="mt-3 grid grid-cols-3 gap-2">
            <select value={cSize} onChange={(e) => setCSize(Number(e.target.value))} className={inputCls}>
              {SIZES.map((s) => <option key={s} value={s}>{s} ml</option>)}
            </select>
            <select value={cType} onChange={(e) => setCType(e.target.value)} className={inputCls}>
              {CAP_TYPES.map((tp) => <option key={tp} value={tp}>{tp}</option>)}
            </select>
            <input value={cColor} onChange={(e) => setCColor(e.target.value)} placeholder="värv" className={inputCls} />
          </div>
        )}
        <div className="mt-3 flex gap-2">
          <input type="number" value={cQty} onChange={(e) => setCQty(e.target.value)} className={inputCls} />
          <button onClick={addCaps} className="rounded-lg bg-amber-700 px-4 text-white">Lisa</button>
        </div>
      </Card>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-5">
      <h3 className="font-serif text-lg mb-3">{title}</h3>
      {children}
    </div>
  );
}

/* ---------- VAIKEKORGID ---------- */
function Vaikekorgid({
  state,
  flavors,
  refresh,
}: {
  state: State;
  flavors: Flavor[];
  refresh: () => void;
}) {
  const [flavorId, setFlavorId] = useState<number>(flavors[0]?.id ?? 0);
  const [size, setSize] = useState(330);
  const [capId, setCapId] = useState<number | "">("");

  const mut = useMutation({
    mutationFn: (body: any) => post("/api/inventory/flavor-cap-default", body),
    onSuccess: refresh,
  });

  const sizeCaps = state.caps.filter((c) => c.size === size);

  return (
    <div className="space-y-5">
      <Card title="Määra maitse vaikekork">
        <p className="text-sm text-stone-500 mb-3">
          Villimisel pakutakse seda korki automaatselt. Saad selle villimisel alati üle valida.
        </p>
        <div className="space-y-3">
          <select value={flavorId} onChange={(e) => setFlavorId(Number(e.target.value))} className={inputCls}>
            {flavors.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
          <Seg options={SIZES.map((s) => ({ value: s, label: `${s} ml` }))} value={size} onChange={setSize} />
          <select value={capId} onChange={(e) => setCapId(e.target.value ? Number(e.target.value) : "")} className={inputCls}>
            <option value="">— vali kork —</option>
            {sizeCaps.map((c) => (
              <option key={c.id} value={c.id}>{capLabel(c)}</option>
            ))}
          </select>
          <button
            onClick={() => capId && mut.mutate({ flavorId, size, capId })}
            className="rounded-lg bg-amber-700 px-4 py-2 text-white"
          >
            Salvesta vaikekork
          </button>
        </div>
      </Card>

      {state.defaults.length > 0 && (
        <div className="rounded-xl border border-stone-200 bg-white overflow-hidden text-sm">
          {state.defaults.map((d, i) => {
            const f = flavors.find((x) => x.id === d.flavorId);
            const c = state.caps.find((x) => x.id === d.capId);
            return (
              <div key={i} className="px-4 py-2 border-b border-stone-100 last:border-0">
                {f?.name ?? "?"} {d.size} ml → {capLabel(c)}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------- AJALUGU ---------- */
function Ajalugu({ state, refresh }: { state: State; refresh: () => void }) {
  const undo = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/inventory/movements/${id}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: refresh,
  });

  if (state.movements.length === 0)
    return <p className="text-sm text-stone-400">Veel ühtegi kannet pole.</p>;

  return (
    <div className="space-y-2">
      {state.movements.map((m) => (
        <div key={m.id} className="flex items-start justify-between rounded-xl border border-stone-200 bg-white px-4 py-3">
          <div className="pr-3">
            <div className="flex items-center gap-2 mb-0.5">
              <span className={`text-xs px-2 py-0.5 rounded-full ${m.kind === "villimine" ? "bg-amber-100 text-amber-800" : "bg-stone-100 text-stone-600"}`}>
                {m.kind}
              </span>
              <span className="text-xs text-stone-400">
                {new Date(m.createdAt).toLocaleString("et-EE")}
              </span>
            </div>
            <div className="text-sm text-stone-700">{m.summary}</div>
          </div>
          <button
            onClick={() => undo.mutate(m.id)}
            className="text-stone-400 hover:text-amber-700 text-xs shrink-0"
          >
            tagasi
          </button>
        </div>
      ))}
    </div>
  );
}
LADU_EOF
echo '  loodud: client/src/pages/Ladu.tsx'

cat > client/src/pages/Valmistamine.tsx <<'VALM_EOF'
// =====================================================================
//  PRUULIMISE LEHT  —  salvesta failina  client/src/pages/Valmistamine.tsx
//  Lisa Wouteri marsruut App.tsx-i (vt README).
//
//  Valemid (arvutatakse automaatselt):
//    Tee, g       = keema läinud L × 5 + 5
//    Suhkur, g    = (keema läinud L + külm vesi L) × 80
//    Juuretis, g  = (keema läinud L + külm vesi L) × 10 × juuretise %
//  Vaikimisi võrdub külm vesi keema läinud veega, kuid seda saab muuta.
//  Enter viib järgmisse lahtrisse.
// =====================================================================
import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

type Tea = { id: number; name: string; qtyG: number };
type Brew = {
  id: number;
  date: string;
  boiledL: number;
  teaSort: string;
  teaG: number;
  sugarG: number;
  starterG: number;
  electricityKwh: number | null;
};

const inputCls =
  "w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-amber-600 focus:outline-none";
const calcCls =
  "w-full rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900 font-medium";

async function post(url: string, body: any) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="block text-sm text-stone-600 mb-1">{label}</label>
      {children}
      {hint && <p className="text-xs text-stone-400 mt-1">{hint}</p>}
    </div>
  );
}

export default function Valmistamine() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("uus");

  const teaQ = useQuery<Tea[]>({
    queryKey: ["/api/brews/tea-stock"],
    queryFn: () => fetch("/api/brews/tea-stock").then((r) => r.json()),
  });
  const brewsQ = useQuery<Brew[]>({
    queryKey: ["/api/brews"],
    queryFn: () => fetch("/api/brews").then((r) => r.json()),
  });

  const teas = teaQ.data ?? [];

  const tabs = [
    { id: "uus", label: "Uus pruulimine" },
    { id: "tee", label: "Tee varu" },
    { id: "ajalugu", label: "Ajalugu" },
  ];

  return (
    <div className="min-h-screen bg-stone-50 text-stone-800">
      <div className="mx-auto max-w-2xl px-4 pb-24 pt-6">
        <h1 className="font-serif text-2xl text-stone-900">Kombucha valmistamine</h1>
        <p className="text-sm text-stone-500 mt-1 mb-5">
          Sisesta vesi ja kogused, valemid arvutavad tee, suhkru ja juuretise ise.
        </p>

        <nav className="flex flex-wrap gap-1 mb-6 border-b border-stone-200">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-2 text-sm -mb-px border-b-2 transition ${
                tab === t.id
                  ? "border-amber-700 text-amber-800 font-medium"
                  : "border-transparent text-stone-500 hover:text-stone-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {tab === "uus" && (
          <UusPruulimine
            teas={teas}
            onSaved={() => {
              qc.invalidateQueries({ queryKey: ["/api/brews"] });
              qc.invalidateQueries({ queryKey: ["/api/brews/tea-stock"] });
            }}
          />
        )}
        {tab === "tee" && (
          <TeeVaru teas={teas} onChange={() => qc.invalidateQueries({ queryKey: ["/api/brews/tea-stock"] })} />
        )}
        {tab === "ajalugu" && (
          <Ajalugu
            brews={brewsQ.data ?? []}
            onChange={() => {
              qc.invalidateQueries({ queryKey: ["/api/brews"] });
              qc.invalidateQueries({ queryKey: ["/api/brews/tea-stock"] });
            }}
          />
        )}
      </div>
    </div>
  );
}

/* ---------- UUS PRUULIMINE ---------- */
function UusPruulimine({ teas, onSaved }: { teas: Tea[]; onSaved: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [boiledL, setBoiledL] = useState("");
  const [startBoilTime, setStartBoilTime] = useState("");
  const [tempReachedMin, setTempReachedMin] = useState("");
  const [temp, setTemp] = useState("");
  const [teaStockId, setTeaStockId] = useState<number | "">("");
  const [steepMin, setSteepMin] = useState("10");
  const [steepHeat, setSteepHeat] = useState("0");
  const [coldEdited, setColdEdited] = useState(false);
  const [coldWaterL, setColdWaterL] = useState("");
  const [coolStartTime, setCoolStartTime] = useState("");
  const [coolPlace, setCoolPlace] = useState("");
  const [coolTemp, setCoolTemp] = useState("");
  const [continuedTime, setContinuedTime] = useState("");
  const [notes, setNotes] = useState("");
  const [starterPct, setStarterPct] = useState("20");
  const [electricityKwh, setElectricityKwh] = useState("");

  const boiled = parseFloat(boiledL) || 0;
  const cold = coldEdited ? parseFloat(coldWaterL) || 0 : boiled;
  const totalL = boiled + cold;
  const teaG = boiled > 0 ? Math.round(boiled * 5 + 5) : 0;
  const sugarG = Math.round(totalL * 80);
  const pct = parseInt(starterPct) || 0;
  const starterG = Math.round(totalL * 10 * pct);

  const formRef = useRef<HTMLDivElement>(null);
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== "Enter") return;
    const target = e.target as HTMLElement;
    if (target.tagName === "TEXTAREA") return;
    e.preventDefault();
    const els = Array.from(
      formRef.current?.querySelectorAll<HTMLElement>("input, select, textarea") ?? []
    ).filter((el) => !(el as HTMLInputElement).disabled && !(el as HTMLInputElement).readOnly);
    const idx = els.indexOf(target);
    els[idx + 1]?.focus();
  };

  const m = useMutation({
    mutationFn: (body: any) => post("/api/brews", body),
    onSuccess: () => {
      onSaved();
      setBoiledL("");
      setStartBoilTime("");
      setTempReachedMin("");
      setTemp("");
      setColdEdited(false);
      setColdWaterL("");
      setCoolStartTime("");
      setCoolPlace("");
      setCoolTemp("");
      setContinuedTime("");
      setNotes("");
      setElectricityKwh("");
    },
  });

  const save = () => {
    if (boiled <= 0) return;
    const tea = teas.find((t) => t.id === teaStockId);
    m.mutate({
      date,
      boiledL: boiled,
      startBoilTime,
      tempReachedMin,
      temp,
      teaStockId: teaStockId || null,
      teaSort: tea?.name ?? "",
      teaG,
      steepMin,
      steepHeat,
      sugarG,
      coldWaterL: cold,
      coolStartTime,
      coolPlace,
      coolTemp,
      continuedTime,
      notes,
      starterPct: pct,
      starterG,
      electricityKwh,
    });
  };

  return (
    <div className="space-y-5" ref={formRef} onKeyDown={onKey}>
      <div className="rounded-xl border border-stone-200 bg-white p-5 space-y-4">
        <h3 className="font-serif text-lg">Keetmine</h3>
        <Field label="Kuupäev">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Vesi keema, L" hint="Sellest arvutatakse tee, suhkur ja juuretis.">
          <input type="number" value={boiledL} onChange={(e) => setBoiledL(e.target.value)} className={inputCls} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Alustasin keetmist kl">
            <input type="time" value={startBoilTime} onChange={(e) => setStartBoilTime(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Temp saavutas, min">
            <input type="number" value={tempReachedMin} onChange={(e) => setTempReachedMin(e.target.value)} className={inputCls} />
          </Field>
        </div>
        <Field label="Temp, °C">
          <input type="number" value={temp} onChange={(e) => setTemp(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Tee sort">
          <select value={teaStockId} onChange={(e) => setTeaStockId(e.target.value ? Number(e.target.value) : "")} className={inputCls}>
            <option value="">— vali tee —</option>
            {teas.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.qtyG} g laos)
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tee, g" hint="Arvutatud: L × 5 + 5">
          <input value={teaG} readOnly className={calcCls} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Min tõmbab">
            <input type="number" value={steepMin} onChange={(e) => setSteepMin(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Tõmbamise kuumus">
            <input type="number" value={steepHeat} onChange={(e) => setSteepHeat(e.target.value)} className={inputCls} />
          </Field>
        </div>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-5 space-y-4">
        <h3 className="font-serif text-lg">Suhkur ja vesi</h3>
        <Field label="Suhkur, g" hint="Arvutatud: kogu vedelik × 80">
          <input value={sugarG} readOnly className={calcCls} />
        </Field>
        <Field label="Külm vesi, L" hint="Vaikimisi sama mis keema läinud vesi, saad muuta.">
          <input
            type="number"
            value={coldEdited ? coldWaterL : boiled || ""}
            onChange={(e) => {
              setColdEdited(true);
              setColdWaterL(e.target.value);
            }}
            className={inputCls}
          />
        </Field>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-5 space-y-4">
        <h3 className="font-serif text-lg">Jahtumine</h3>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Jahtuma kl">
            <input type="time" value={coolStartTime} onChange={(e) => setCoolStartTime(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Jahtumiskoha temp, °C">
            <input type="number" value={coolTemp} onChange={(e) => setCoolTemp(e.target.value)} className={inputCls} />
          </Field>
        </div>
        <Field label="Jahtumiskoht">
          <input value={coolPlace} onChange={(e) => setCoolPlace(e.target.value)} list="cool-places" className={inputCls} placeholder="nt sahver" />
          <datalist id="cool-places">
            <option value="sahver" />
            <option value="kelder" />
            <option value="köök" />
          </datalist>
        </Field>
        <Field label="Tegutsesin edasi kl">
          <input type="time" value={continuedTime} onChange={(e) => setContinuedTime(e.target.value)} className={inputCls} />
        </Field>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-5 space-y-4">
        <h3 className="font-serif text-lg">Juuretis ja kulu</h3>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Juuretise %">
            <input type="number" value={starterPct} onChange={(e) => setStarterPct(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Juuretis, g" hint="Arvutatud">
            <input value={starterG} readOnly className={calcCls} />
          </Field>
        </div>
        <Field label="Elektrikulu, kW/h">
          <input type="number" value={electricityKwh} onChange={(e) => setElectricityKwh(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Soovitused">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputCls} />
        </Field>
      </div>

      <button
        onClick={save}
        disabled={m.isPending}
        className="w-full rounded-lg bg-amber-700 py-3 text-white font-medium hover:bg-amber-800 disabled:opacity-50"
      >
        {m.isPending ? "Salvestan…" : "Salvesta pruulimine"}
      </button>
    </div>
  );
}

/* ---------- TEE VARU ---------- */
function TeeVaru({ teas, onChange }: { teas: Tea[]; onChange: () => void }) {
  const [name, setName] = useState("");
  const [existing, setExisting] = useState<number | "">("");
  const [qty, setQty] = useState("");
  const [mode, setMode] = useState<"olemasolev" | "uus">("olemasolev");

  const mut = useMutation({
    mutationFn: (body: any) => post("/api/brews/tea-stock", body),
    onSuccess: () => {
      onChange();
      setQty("");
      setName("");
    },
  });

  const add = () => {
    const q = parseInt(qty) || 0;
    if (mode === "olemasolev") {
      const t = teas.find((x) => x.id === existing);
      if (!t) return;
      mut.mutate({ name: t.name, qtyG: q });
    } else {
      if (!name.trim()) return;
      mut.mutate({ name: name.trim(), qtyG: q });
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-stone-200 bg-white p-5 space-y-3">
        <h3 className="font-serif text-lg">Lisa teed lattu</h3>
        <div className="inline-flex rounded-lg border border-stone-300 p-1 bg-stone-50">
          {(["olemasolev", "uus"] as const).map((mm) => (
            <button
              key={mm}
              onClick={() => setMode(mm)}
              className={`px-3 py-1.5 text-sm rounded-md ${mode === mm ? "bg-amber-700 text-white" : "text-stone-600"}`}
            >
              {mm === "olemasolev" ? "Olemasolev sort" : "Uus sort"}
            </button>
          ))}
        </div>
        {mode === "olemasolev" ? (
          <select value={existing} onChange={(e) => setExisting(e.target.value ? Number(e.target.value) : "")} className={inputCls}>
            <option value="">— vali sort —</option>
            {teas.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        ) : (
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="nt roheline Mozum" className={inputCls} />
        )}
        <div className="flex gap-2">
          <input type="number" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="grammid" className={inputCls} />
          <button onClick={add} className="rounded-lg bg-amber-700 px-4 text-white shrink-0">Lisa</button>
        </div>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-stone-100 text-stone-500 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Tee sort</th>
              <th className="px-4 py-2 font-medium text-right">Grammid</th>
            </tr>
          </thead>
          <tbody>
            {teas.length === 0 ? (
              <tr><td className="px-4 py-3 text-stone-400" colSpan={2}>Ühtegi sorti pole veel lisatud.</td></tr>
            ) : (
              teas.map((t) => (
                <tr key={t.id} className="border-t border-stone-100">
                  <td className="px-4 py-2">{t.name}</td>
                  <td className={`px-4 py-2 text-right font-medium ${t.qtyG <= 0 ? "text-red-600" : ""}`}>{t.qtyG}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- AJALUGU ---------- */
function Ajalugu({ brews, onChange }: { brews: Brew[]; onChange: () => void }) {
  const del = useMutation({
    mutationFn: (id: number) => fetch(`/api/brews/${id}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: onChange,
  });

  if (brews.length === 0) return <p className="text-sm text-stone-400">Veel ühtegi pruulimist pole.</p>;

  return (
    <div className="space-y-2">
      {brews.map((b) => (
        <div key={b.id} className="flex items-start justify-between rounded-xl border border-stone-200 bg-white px-4 py-3">
          <div>
            <div className="text-sm font-medium">
              {new Date(b.date).toLocaleDateString("et-EE")} · {b.boiledL} L · {b.teaSort || "tee märkimata"}
            </div>
            <div className="text-xs text-stone-500 mt-0.5">
              Tee {b.teaG} g · suhkur {b.sugarG} g · juuretis {b.starterG} g
              {b.electricityKwh != null ? ` · ${b.electricityKwh} kW/h` : ""}
            </div>
          </div>
          <button onClick={() => del.mutate(b.id)} className="text-stone-400 hover:text-red-600 text-xs shrink-0">
            kustuta
          </button>
        </div>
      ))}
    </div>
  );
}
VALM_EOF
echo '  loodud: client/src/pages/Valmistamine.tsx'

cat > client/src/pages/Kaarimine.tsx <<'KAAR_EOF'
// =====================================================================
//  KÄÄRIMISE LEHT (1F)  —  salvesta failina  client/src/pages/Kaarimine.tsx
//  Lisa Wouteri marsruut App.tsx-i (vt allpool juhist chatis).
//
//  Käärimise aeg (päevades) = maitsestamise kuupäev − käärima panemise kuupäev.
//  Maitsestamise kuupäeva saad täita hiljem, kui maitsestamine algab.
// =====================================================================
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

type Tea = { id: number; name: string; qtyG: number };
type Brew = { id: number; date: string; teaSort: string; boiledL: number };
type Vessel = { volumeL: number; vesselL: number; count: number; place: string; temp: number | null };
type Batch = {
  id: number;
  teaSort: string;
  startDate: string;
  flavoringDate: string | null;
  notes: string;
  vessels: Vessel[];
};

const inputCls =
  "w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-amber-600 focus:outline-none";

async function send(url: string, method: string, body?: any) {
  const r = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

function days(start?: string, end?: string | null) {
  if (!start || !end) return null;
  const d = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000);
  return isNaN(d) ? null : d;
}

type VesselForm = { volumeL: string; vesselL: string; count: string; place: string; temp: string };
const emptyVessel = (): VesselForm => ({ volumeL: "", vesselL: "", count: "1", place: "", temp: "" });

export default function Kaarimine() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("uus");

  const teaQ = useQuery<Tea[]>({
    queryKey: ["/api/brews/tea-stock"],
    queryFn: () => fetch("/api/brews/tea-stock").then((r) => r.json()),
  });
  const brewsQ = useQuery<Brew[]>({
    queryKey: ["/api/brews"],
    queryFn: () => fetch("/api/brews").then((r) => r.json()),
  });
  const batchQ = useQuery<Batch[]>({
    queryKey: ["/api/fermentations"],
    queryFn: () => fetch("/api/fermentations").then((r) => r.json()),
  });

  const teas = teaQ.data ?? [];
  const brews = brewsQ.data ?? [];

  return (
    <div className="min-h-screen bg-stone-50 text-stone-800">
      <div className="mx-auto max-w-2xl px-4 pb-24 pt-6">
        <h1 className="font-serif text-2xl text-stone-900">Käärimine</h1>
        <p className="text-sm text-stone-500 mt-1 mb-5">
          Märgi, mis tee millistes nõudes ja mis temperatuuril käärib.
        </p>

        <nav className="flex gap-1 mb-6 border-b border-stone-200">
          {[
            { id: "uus", label: "Uus käärimine" },
            { id: "ajalugu", label: "Ajalugu" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-2 text-sm -mb-px border-b-2 transition ${
                tab === t.id
                  ? "border-amber-700 text-amber-800 font-medium"
                  : "border-transparent text-stone-500 hover:text-stone-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {tab === "uus" && (
          <Uus
            teas={teas}
            brews={brews}
            onSaved={() => qc.invalidateQueries({ queryKey: ["/api/fermentations"] })}
          />
        )}
        {tab === "ajalugu" && (
          <Ajalugu
            batches={batchQ.data ?? []}
            onChange={() => qc.invalidateQueries({ queryKey: ["/api/fermentations"] })}
          />
        )}
      </div>
    </div>
  );
}

/* ---------- UUS KÄÄRIMINE ---------- */
function Uus({ teas, brews, onSaved }: { teas: Tea[]; brews: Brew[]; onSaved: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [brewId, setBrewId] = useState<number | "">("");
  const [teaSort, setTeaSort] = useState("");
  const [startDate, setStartDate] = useState(today);
  const [flavoringDate, setFlavoringDate] = useState("");
  const [notes, setNotes] = useState("");
  const [vessels, setVessels] = useState<VesselForm[]>([emptyVessel()]);

  const onPickBrew = (id: number | "") => {
    setBrewId(id);
    const br = brews.find((x) => x.id === id);
    if (br) {
      if (br.teaSort) setTeaSort(br.teaSort);
      if (br.date) setStartDate(br.date);
    }
  };

  const setVessel = (i: number, key: keyof VesselForm, val: string) =>
    setVessels((v) => v.map((x, idx) => (idx === i ? { ...x, [key]: val } : x)));
  const addVessel = () => setVessels((v) => [...v, emptyVessel()]);
  const removeVessel = (i: number) => setVessels((v) => v.filter((_, idx) => idx !== i));

  const totalLiquid = vessels.reduce(
    (s, v) => s + (parseFloat(v.volumeL) || 0) * (parseInt(v.count) || 0),
    0
  );
  const d = days(startDate, flavoringDate);

  const m = useMutation({
    mutationFn: (body: any) => send("/api/fermentations", "POST", body),
    onSuccess: () => {
      onSaved();
      setVessels([emptyVessel()]);
      setNotes("");
      setFlavoringDate("");
    },
  });

  const save = () => {
    if (!startDate) return;
    const cleaned: Vessel[] = vessels
      .filter((v) => v.volumeL || v.vesselL)
      .map((v) => ({
        volumeL: parseFloat(v.volumeL) || 0,
        vesselL: parseFloat(v.vesselL) || 0,
        count: parseInt(v.count) || 1,
        place: v.place,
        temp: v.temp === "" ? null : Number(v.temp),
      }));
    m.mutate({
      brewId: brewId || null,
      teaSort,
      startDate,
      flavoringDate: flavoringDate || null,
      notes,
      vessels: cleaned,
    });
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-stone-200 bg-white p-5 space-y-4">
        <div>
          <label className="block text-sm text-stone-600 mb-1">Seo pruulimisega (valikuline)</label>
          <select value={brewId} onChange={(e) => onPickBrew(e.target.value ? Number(e.target.value) : "")} className={inputCls}>
            <option value="">— vali pruulimine —</option>
            {brews.map((br) => (
              <option key={br.id} value={br.id}>
                {new Date(br.date).toLocaleDateString("et-EE")} · {br.teaSort || "tee märkimata"} · {br.boiledL} L
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-stone-600 mb-1">Tee sort</label>
            <select value={teaSort} onChange={(e) => setTeaSort(e.target.value)} className={inputCls}>
              <option value="">— vali tee —</option>
              {teas.map((t) => (
                <option key={t.id} value={t.name}>{t.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-stone-600 mb-1">Käärima pandi</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-stone-600 mb-1">Maitsestamise kuupäev</label>
            <input type="date" value={flavoringDate} onChange={(e) => setFlavoringDate(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm text-stone-600 mb-1">Käärimise aeg</label>
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900 font-medium">
              {d != null ? `${d} päeva` : "—"}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-lg">Nõud</h3>
          <button onClick={addVessel} className="text-sm text-amber-700 hover:text-amber-900">+ lisa nõu</button>
        </div>
        {vessels.map((v, i) => (
          <div key={i} className="rounded-xl border border-stone-200 bg-white p-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-stone-500 mb-1">Kogus nõus, L</label>
                <input type="number" value={v.volumeL} onChange={(e) => setVessel(i, "volumeL", e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-stone-500 mb-1">Nõu maht, L</label>
                <input type="number" value={v.vesselL} onChange={(e) => setVessel(i, "vesselL", e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-stone-500 mb-1">Mitu sellist nõud</label>
                <input type="number" value={v.count} onChange={(e) => setVessel(i, "count", e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-stone-500 mb-1">Temp, °C</label>
                <input type="number" value={v.temp} onChange={(e) => setVessel(i, "temp", e.target.value)} className={inputCls} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-stone-500 mb-1">Käärimiskoht</label>
                <input value={v.place} onChange={(e) => setVessel(i, "place", e.target.value)} list="ferm-places" className={inputCls} placeholder="nt köögis kapi peal" />
                <datalist id="ferm-places">
                  <option value="köögis kapi peal" />
                  <option value="sahver" />
                  <option value="kelder" />
                </datalist>
              </div>
            </div>
            {vessels.length > 1 && (
              <button onClick={() => removeVessel(i)} className="mt-2 text-xs text-stone-400 hover:text-red-600">
                eemalda nõu
              </button>
            )}
          </div>
        ))}
        <p className="text-xs text-stone-400">Kokku vedelikku nõudes: {totalLiquid} L</p>
      </div>

      <div>
        <label className="block text-sm text-stone-600 mb-1">Märkmed</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputCls} placeholder="kuidas maitses, kas käärimine oli piisav" />
      </div>

      <button
        onClick={save}
        disabled={m.isPending}
        className="w-full rounded-lg bg-amber-700 py-3 text-white font-medium hover:bg-amber-800 disabled:opacity-50"
      >
        {m.isPending ? "Salvestan…" : "Salvesta käärimine"}
      </button>
    </div>
  );
}

/* ---------- AJALUGU ---------- */
function Ajalugu({ batches, onChange }: { batches: Batch[]; onChange: () => void }) {
  if (batches.length === 0) return <p className="text-sm text-stone-400">Veel ühtegi käärimist pole.</p>;
  return (
    <div className="space-y-3">
      {batches.map((b) => (
        <BatchCard key={b.id} batch={b} onChange={onChange} />
      ))}
    </div>
  );
}

function BatchCard({ batch, onChange }: { batch: Batch; onChange: () => void }) {
  const [flavoringDate, setFlavoringDate] = useState(batch.flavoringDate ?? "");
  const d = days(batch.startDate, flavoringDate || batch.flavoringDate);

  const patch = useMutation({
    mutationFn: (body: any) => send(`/api/fermentations/${batch.id}`, "PATCH", body),
    onSuccess: onChange,
  });
  const del = useMutation({
    mutationFn: () => send(`/api/fermentations/${batch.id}`, "DELETE"),
    onSuccess: onChange,
  });

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-medium">
            {new Date(batch.startDate).toLocaleDateString("et-EE")} · {batch.teaSort || "tee märkimata"}
          </div>
          <div className="text-xs text-stone-500 mt-0.5">
            {batch.vessels.map((v, i) => (
              <span key={i}>
                {i > 0 ? " · " : ""}
                {v.count} × {v.vesselL} L ({v.volumeL} L, {v.temp ?? "?"} °C{v.place ? ", " + v.place : ""})
              </span>
            ))}
          </div>
        </div>
        <button onClick={() => del.mutate()} className="text-xs text-stone-400 hover:text-red-600 shrink-0">kustuta</button>
      </div>
      <div className="mt-3 flex items-end gap-2 border-t border-stone-100 pt-3">
        <div className="flex-1">
          <label className="block text-xs text-stone-500 mb-1">Maitsestamise kuupäev</label>
          <input type="date" value={flavoringDate} onChange={(e) => setFlavoringDate(e.target.value)} className={inputCls} />
        </div>
        <div className="text-sm text-stone-600 pb-2">{d != null ? `${d} päeva` : "—"}</div>
        <button
          onClick={() => patch.mutate({ flavoringDate })}
          className="rounded-lg bg-amber-700 px-3 py-2 text-white text-sm shrink-0"
        >
          Salvesta
        </button>
      </div>
      {batch.notes && <p className="mt-2 text-sm text-stone-600">{batch.notes}</p>}
    </div>
  );
}
KAAR_EOF
echo '  loodud: client/src/pages/Kaarimine.tsx'

cat > client/src/pages/Maitsestamine.tsx <<'MAIT_EOF'
// =====================================================================
//  MAITSESTAMISE LEHT (2F)  —  salvesta failina  client/src/pages/Maitsestamine.tsx
//
//  Maitsestuse gramm = kombucha liitrid × variandi koefitsient.
//  Koefitsienti saad muuta Maitsestuse ladu vahekaardil iga variandi all.
//  Salvestamisel arvatakse grammid maitsestuse laost maha. Kui seod
//  maitsestamise käärimisega, läheb maitsestamise kuupäev käärimise kirjele.
// =====================================================================
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

type Variant = { id: number; name: string; olek: string; paritolu: string; coefficient: number; qtyG: number };
type Method = { id: number; name: string };
type Ferm = { id: number; teaSort: string; startDate: string };
type EventBlock = {
  name: string; olek: string; paritolu: string;
  koguseL: number; vesselL: number; method: string;
  coefficient: number; gramsUsed: number; place: string; temp: number | null;
};
type FlavEvent = {
  id: number; date: string; bottlingDate: string | null;
  bottleFermentNote: string; notes: string; blocks: EventBlock[];
};

const inputCls =
  "w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-amber-600 focus:outline-none";
const round2 = (n: number) => Math.round(n * 100) / 100;

async function send(url: string, method: string, body?: any) {
  const r = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
function days(a?: string, b?: string | null) {
  if (!a || !b) return null;
  const d = Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
  return isNaN(d) ? null : d;
}
const variantLabel = (v: Variant) =>
  `${v.name}${v.olek ? " · " + v.olek : ""}${v.paritolu ? " · " + v.paritolu : ""} (${v.qtyG} g)`;

export default function Maitsestamine() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("uus");

  const stockQ = useQuery<Variant[]>({ queryKey: ["/api/flavoring/stock"], queryFn: () => fetch("/api/flavoring/stock").then((r) => r.json()) });
  const methodsQ = useQuery<Method[]>({ queryKey: ["/api/flavoring/methods"], queryFn: () => fetch("/api/flavoring/methods").then((r) => r.json()) });
  const fermQ = useQuery<Ferm[]>({ queryKey: ["/api/fermentations"], queryFn: () => fetch("/api/fermentations").then((r) => r.json()) });
  const eventsQ = useQuery<FlavEvent[]>({ queryKey: ["/api/flavoring/events"], queryFn: () => fetch("/api/flavoring/events").then((r) => r.json()) });

  const stock = stockQ.data ?? [];
  const methods = methodsQ.data ?? [];

  const tabs = [
    { id: "uus", label: "Uus maitsestamine" },
    { id: "ladu", label: "Maitsestuse ladu" },
    { id: "viisid", label: "Töötlusviisid" },
    { id: "ajalugu", label: "Ajalugu" },
  ];

  return (
    <div className="min-h-screen bg-stone-50 text-stone-800">
      <div className="mx-auto max-w-2xl px-4 pb-24 pt-6">
        <h1 className="font-serif text-2xl text-stone-900">Maitsestamine</h1>
        <p className="text-sm text-stone-500 mt-1 mb-5">
          Märgi, mis maitsestust ja kui palju kasutasid. Grammid arvutatakse ja arvatakse laost maha.
        </p>
        <nav className="flex flex-wrap gap-1 mb-6 border-b border-stone-200">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-3 py-2 text-sm -mb-px border-b-2 transition ${tab === t.id ? "border-amber-700 text-amber-800 font-medium" : "border-transparent text-stone-500 hover:text-stone-700"}`}>
              {t.label}
            </button>
          ))}
        </nav>

        {tab === "uus" && (
          <Uus stock={stock} methods={methods} ferms={fermQ.data ?? []}
            onSaved={() => {
              qc.invalidateQueries({ queryKey: ["/api/flavoring/events"] });
              qc.invalidateQueries({ queryKey: ["/api/flavoring/stock"] });
              qc.invalidateQueries({ queryKey: ["/api/fermentations"] });
            }} />
        )}
        {tab === "ladu" && (
          <Ladu stock={stock} onChange={() => qc.invalidateQueries({ queryKey: ["/api/flavoring/stock"] })} />
        )}
        {tab === "viisid" && (
          <Viisid methods={methods} onChange={() => qc.invalidateQueries({ queryKey: ["/api/flavoring/methods"] })} />
        )}
        {tab === "ajalugu" && (
          <Ajalugu events={eventsQ.data ?? []} onChange={() => {
            qc.invalidateQueries({ queryKey: ["/api/flavoring/events"] });
            qc.invalidateQueries({ queryKey: ["/api/flavoring/stock"] });
          }} />
        )}
      </div>
    </div>
  );
}

/* ---------- UUS MAITSESTAMINE ---------- */
type BlockForm = {
  stockId: string; koguseL: string; vesselL: string; method: string;
  coefficient: string; grams: string; gEdited: boolean; place: string; temp: string;
};
const emptyBlock = (): BlockForm => ({
  stockId: "", koguseL: "", vesselL: "", method: "", coefficient: "1.3", grams: "", gEdited: false, place: "", temp: "",
});

function Uus({ stock, methods, ferms, onSaved }: { stock: Variant[]; methods: Method[]; ferms: Ferm[]; onSaved: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [fermId, setFermId] = useState<number | "">("");
  const [bottlingDate, setBottlingDate] = useState("");
  const [bottleNote, setBottleNote] = useState("");
  const [notes, setNotes] = useState("");
  const [blocks, setBlocks] = useState<BlockForm[]>([emptyBlock()]);

  const recompute = (b: BlockForm): BlockForm => {
    if (b.gEdited) return b;
    const L = parseFloat(b.koguseL) || 0;
    const c = parseFloat(b.coefficient) || 0;
    return { ...b, grams: L > 0 ? String(round2(L * c)) : "" };
  };
  const update = (i: number, patch: Partial<BlockForm>) =>
    setBlocks((arr) => arr.map((b, idx) => (idx === i ? recompute({ ...b, ...patch }) : b)));
  const pickVariant = (i: number, stockId: string) => {
    const v = stock.find((x) => x.id === Number(stockId));
    update(i, { stockId, coefficient: v ? String(v.coefficient) : blocks[i].coefficient });
  };
  const addBlock = () => setBlocks((a) => [...a, emptyBlock()]);
  const removeBlock = (i: number) => setBlocks((a) => a.filter((_, idx) => idx !== i));

  const d = days(date, bottlingDate);

  const m = useMutation({
    mutationFn: (body: any) => send("/api/flavoring/events", "POST", body),
    onSuccess: () => {
      onSaved();
      setBlocks([emptyBlock()]);
      setBottlingDate(""); setBottleNote(""); setNotes(""); setFermId("");
    },
  });

  const save = () => {
    if (!date) return;
    const out: EventBlock[] = blocks
      .filter((b) => b.stockId || b.koguseL)
      .map((b) => {
        const v = stock.find((x) => x.id === Number(b.stockId));
        return {
          name: v?.name ?? "", olek: v?.olek ?? "", paritolu: v?.paritolu ?? "",
          flavoringStockId: v?.id ?? null,
          koguseL: parseFloat(b.koguseL) || 0,
          vesselL: parseFloat(b.vesselL) || 0,
          method: b.method,
          coefficient: parseFloat(b.coefficient) || 0,
          gramsUsed: parseFloat(b.grams) || 0,
          place: b.place,
          temp: b.temp === "" ? null : Number(b.temp),
        } as any;
      });
    m.mutate({
      date,
      fermentationBatchId: fermId || null,
      bottlingDate: bottlingDate || null,
      bottleFermentNote: bottleNote,
      notes,
      blocks: out,
    });
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-stone-200 bg-white p-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-stone-600 mb-1">Maitsestamise kuupäev</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm text-stone-600 mb-1">Seo käärimisega</label>
            <select value={fermId} onChange={(e) => setFermId(e.target.value ? Number(e.target.value) : "")} className={inputCls}>
              <option value="">— valikuline —</option>
              {ferms.map((f) => (
                <option key={f.id} value={f.id}>
                  {new Date(f.startDate).toLocaleDateString("et-EE")} · {f.teaSort || "tee märkimata"}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-xs text-stone-400">Kui seod käärimisega, läheb see kuupäev käärimise kirjele käärimise lõpuks.</p>
      </div>

      <datalist id="flavor-methods">
        {methods.map((mm) => <option key={mm.id} value={mm.name} />)}
      </datalist>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-lg">Maitsestused</h3>
          <button onClick={addBlock} className="text-sm text-amber-700 hover:text-amber-900">+ lisa maitsestus</button>
        </div>

        {blocks.map((b, i) => {
          const v = stock.find((x) => x.id === Number(b.stockId));
          return (
            <div key={i} className="rounded-xl border border-stone-200 bg-white p-4 space-y-3">
              <div>
                <label className="block text-xs text-stone-500 mb-1">Maitsestus</label>
                <select value={b.stockId} onChange={(e) => pickVariant(i, e.target.value)} className={inputCls}>
                  <option value="">— vali maitsestus —</option>
                  {stock.map((x) => (
                    <option key={x.id} value={x.id}>{variantLabel(x)}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-stone-500 mb-1">Kombucha, L</label>
                  <input type="number" value={b.koguseL} onChange={(e) => update(i, { koguseL: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs text-stone-500 mb-1">Nõu maht, L</label>
                  <input type="number" value={b.vesselL} onChange={(e) => update(i, { vesselL: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs text-stone-500 mb-1">Koefitsient (g/L)</label>
                  <input type="number" value={b.coefficient} onChange={(e) => update(i, { coefficient: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs text-stone-500 mb-1">Kogus, g</label>
                  <input type="number" value={b.grams}
                    onChange={(e) => setBlocks((arr) => arr.map((x, idx) => idx === i ? { ...x, grams: e.target.value, gEdited: true } : x))}
                    className="w-full rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900 font-medium" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-stone-500 mb-1">Töötlusviis</label>
                <input value={b.method} onChange={(e) => update(i, { method: e.target.value })} list="flavor-methods" className={inputCls} placeholder="nt purustamine" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-stone-500 mb-1">Käärimiskoht</label>
                  <input value={b.place} onChange={(e) => update(i, { place: e.target.value })} className={inputCls} placeholder="nt köögis kapi peal" />
                </div>
                <div>
                  <label className="block text-xs text-stone-500 mb-1">Temp, °C</label>
                  <input type="number" value={b.temp} onChange={(e) => update(i, { temp: e.target.value })} className={inputCls} />
                </div>
              </div>
              {v && v.qtyG < (parseFloat(b.grams) || 0) && (
                <p className="text-xs text-red-600">Laos on {v.qtyG} g, kasutad {b.grams} g. Laoseis läheb miinusesse.</p>
              )}
              {blocks.length > 1 && (
                <button onClick={() => removeBlock(i)} className="text-xs text-stone-400 hover:text-red-600">eemalda maitsestus</button>
              )}
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-stone-600 mb-1">Villimise aeg</label>
            <input type="date" value={bottlingDate} onChange={(e) => setBottlingDate(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm text-stone-600 mb-1">Käärimise aeg (2F)</label>
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900 font-medium">
              {d != null ? `${d} päeva` : "—"}
            </div>
          </div>
        </div>
        <div>
          <label className="block text-sm text-stone-600 mb-1">Lisakääritus pudelis soojas</label>
          <input value={bottleNote} onChange={(e) => setBottleNote(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-sm text-stone-600 mb-1">Soovitused</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputCls} />
        </div>
      </div>

      <button onClick={save} disabled={m.isPending}
        className="w-full rounded-lg bg-amber-700 py-3 text-white font-medium hover:bg-amber-800 disabled:opacity-50">
        {m.isPending ? "Salvestan…" : "Salvesta maitsestamine"}
      </button>
    </div>
  );
}

/* ---------- MAITSESTUSE LADU ---------- */
function Ladu({ stock, onChange }: { stock: Variant[]; onChange: () => void }) {
  const [name, setName] = useState("");
  const [olek, setOlek] = useState("kuivatatud");
  const [paritolu, setParitolu] = useState("");
  const [coefficient, setCoefficient] = useState("1.3");
  const [qtyG, setQtyG] = useState("");

  const addM = useMutation({ mutationFn: (b: any) => send("/api/flavoring/stock", "POST", b), onSuccess: () => { onChange(); setName(""); setParitolu(""); setQtyG(""); } });

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-stone-200 bg-white p-5 space-y-3">
        <h3 className="font-serif text-lg">Lisa maitsestus lattu</h3>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="nt leedrimari" className={inputCls} />
        <div className="grid grid-cols-2 gap-3">
          <select value={olek} onChange={(e) => setOlek(e.target.value)} className={inputCls}>
            <option value="kuivatatud">kuivatatud</option>
            <option value="sügavkülmutatud">sügavkülmutatud</option>
            <option value="värske">värske</option>
          </select>
          <input value={paritolu} onChange={(e) => setParitolu(e.target.value)} placeholder="päritolu, nt IdeaFarm" className={inputCls} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-stone-500 mb-1">Koefitsient (g/L)</label>
            <input type="number" value={coefficient} onChange={(e) => setCoefficient(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-stone-500 mb-1">Algkogus, g</label>
            <input type="number" value={qtyG} onChange={(e) => setQtyG(e.target.value)} className={inputCls} />
          </div>
        </div>
        <button onClick={() => name.trim() && addM.mutate({ name, olek, paritolu, coefficient, qtyG })}
          className="rounded-lg bg-amber-700 px-4 py-2 text-white">Lisa</button>
      </div>

      <div className="space-y-2">
        {stock.length === 0 ? (
          <p className="text-sm text-stone-400">Ühtegi maitsestust pole veel lisatud.</p>
        ) : (
          stock.map((v) => <StockRow key={v.id} v={v} onChange={onChange} />)
        )}
      </div>
    </div>
  );
}

function StockRow({ v, onChange }: { v: Variant; onChange: () => void }) {
  const [coef, setCoef] = useState(String(v.coefficient));
  const [add, setAdd] = useState("");
  const patch = useMutation({ mutationFn: (b: any) => send(`/api/flavoring/stock/${v.id}`, "PATCH", b), onSuccess: onChange });
  const topup = useMutation({ mutationFn: (b: any) => send(`/api/flavoring/stock/${v.id}/add`, "POST", b), onSuccess: () => { onChange(); setAdd(""); } });
  const del = useMutation({ mutationFn: () => send(`/api/flavoring/stock/${v.id}`, "DELETE"), onSuccess: onChange });

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-medium">{v.name}</div>
          <div className="text-xs text-stone-500">{[v.olek, v.paritolu].filter(Boolean).join(" · ")}</div>
        </div>
        <div className="text-right">
          <div className={`font-semibold ${v.qtyG <= 0 ? "text-red-600" : ""}`}>{v.qtyG} g</div>
          <button onClick={() => del.mutate()} className="text-xs text-stone-400 hover:text-red-600">kustuta</button>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-stone-100 pt-3">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className="block text-xs text-stone-500 mb-1">Koefitsient</label>
            <input type="number" value={coef} onChange={(e) => setCoef(e.target.value)} className={inputCls} />
          </div>
          <button onClick={() => patch.mutate({ coefficient: coef })} className="rounded-lg bg-stone-700 px-3 py-2 text-white text-sm">Salvesta</button>
        </div>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className="block text-xs text-stone-500 mb-1">Lisa grammid</label>
            <input type="number" value={add} onChange={(e) => setAdd(e.target.value)} className={inputCls} />
          </div>
          <button onClick={() => add && topup.mutate({ qtyG: Number(add) })} className="rounded-lg bg-amber-700 px-3 py-2 text-white text-sm">Lisa</button>
        </div>
      </div>
    </div>
  );
}

/* ---------- TÖÖTLUSVIISID ---------- */
function Viisid({ methods, onChange }: { methods: Method[]; onChange: () => void }) {
  const [name, setName] = useState("");
  const add = useMutation({ mutationFn: (b: any) => send("/api/flavoring/methods", "POST", b), onSuccess: () => { onChange(); setName(""); } });
  const del = useMutation({ mutationFn: (id: number) => send(`/api/flavoring/methods/${id}`, "DELETE"), onSuccess: onChange });

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-stone-200 bg-white p-5 space-y-3">
        <h3 className="font-serif text-lg">Lisa töötlusviis</h3>
        <div className="flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="nt sulatasin kuuma veega ja muljusin käega" className={inputCls} />
          <button onClick={() => name.trim() && add.mutate({ name })} className="rounded-lg bg-amber-700 px-4 text-white shrink-0">Lisa</button>
        </div>
      </div>
      <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
        {methods.length === 0 ? (
          <p className="px-4 py-3 text-sm text-stone-400">Ühtegi viisi pole veel lisatud.</p>
        ) : (
          methods.map((mm) => (
            <div key={mm.id} className="flex items-center justify-between px-4 py-2 border-b border-stone-100 last:border-0">
              <span className="text-sm">{mm.name}</span>
              <button onClick={() => del.mutate(mm.id)} className="text-xs text-stone-400 hover:text-red-600">kustuta</button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ---------- AJALUGU ---------- */
function Ajalugu({ events, onChange }: { events: FlavEvent[]; onChange: () => void }) {
  const del = useMutation({ mutationFn: (id: number) => send(`/api/flavoring/events/${id}`, "DELETE"), onSuccess: onChange });
  if (events.length === 0) return <p className="text-sm text-stone-400">Veel ühtegi maitsestamist pole.</p>;
  return (
    <div className="space-y-3">
      {events.map((ev) => (
        <div key={ev.id} className="rounded-xl border border-stone-200 bg-white p-4">
          <div className="flex items-start justify-between">
            <div className="font-medium">{new Date(ev.date).toLocaleDateString("et-EE")}</div>
            <button onClick={() => del.mutate(ev.id)} className="text-xs text-stone-400 hover:text-red-600 shrink-0">kustuta</button>
          </div>
          <div className="text-sm text-stone-600 mt-1 space-y-0.5">
            {ev.blocks.map((bl, i) => (
              <div key={i}>{bl.name || "?"} · {bl.koguseL} L → {bl.gramsUsed} g{bl.method ? " · " + bl.method : ""}</div>
            ))}
          </div>
          {ev.bottlingDate && (
            <div className="text-xs text-stone-400 mt-1">
              Villitud {new Date(ev.bottlingDate).toLocaleDateString("et-EE")}
              {days(ev.date, ev.bottlingDate) != null ? ` · 2F ${days(ev.date, ev.bottlingDate)} päeva` : ""}
            </div>
          )}
          {ev.notes && <p className="text-sm text-stone-600 mt-1">{ev.notes}</p>}
        </div>
      ))}
    </div>
  );
}
MAIT_EOF
echo '  loodud: client/src/pages/Maitsestamine.tsx'

if [ -f "shared/schema.ts" ]; then
  if ! grep -q "kombucha-schema" shared/schema.ts; then
    printf '\nexport * from "./kombucha-schema";\n' >> shared/schema.ts
    echo "  lisatud re-eksport faili shared/schema.ts"
  else
    echo "  re-eksport on juba olemas"
  fi
else
  echo "HOIATUS: shared/schema.ts puudub. Lisa kasitsi: export * from \"./kombucha-schema\";"
fi

echo ""
echo "============================================================"
echo "FAILID LOODUD. Veel kolm kasitsi sammu:"
echo ""
echo "1) server/routes.ts (funktsiooni sees):"
echo "   import { registerInventoryRoutes } from \"./inventory\";"
echo "   import { registerBrewRoutes } from \"./brews\";"
echo "   import { registerFermentationRoutes } from \"./fermentations\";"
echo "   import { registerFlavoringRoutes } from \"./flavoring\";"
echo "   registerInventoryRoutes(app);"
echo "   registerBrewRoutes(app);"
echo "   registerFermentationRoutes(app);"
echo "   registerFlavoringRoutes(app);"
echo ""
echo "2) client/src/App.tsx (Wouter):"
echo "   import Ladu from \"@/pages/Ladu\";"
echo "   import Valmistamine from \"@/pages/Valmistamine\";"
echo "   import Kaarimine from \"@/pages/Kaarimine\";"
echo "   import Maitsestamine from \"@/pages/Maitsestamine\";"
echo "   <Route path=\"/ladu\" component={Ladu} />"
echo "   <Route path=\"/valmistamine\" component={Valmistamine} />"
echo "   <Route path=\"/kaarimine\" component={Kaarimine} />"
echo "   <Route path=\"/maitsestamine\" component={Maitsestamine} />"
echo ""
echo "3) npm run db:push"
echo ""
echo "NB: server/inventory.ts impordib maitsete tabeli nimega 'flavors'."
echo "Kui Sinu maitsete tabel on teise nimega, muuda see."
echo "============================================================"
