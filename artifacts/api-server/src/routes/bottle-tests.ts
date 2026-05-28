import { Router } from "express";
import { z } from "zod/v4";
import { db } from "@workspace/db";
import { bottleTestsTable, flavoringEventTable, fermentationBatchTable, brewsTable } from "@workspace/db";
import { eq, and, asc, desc, sql } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDateOnly(value: string): Date | null {
  if (!ISO_DATE_RE.test(value)) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  return isNaN(d.getTime()) ? null : d;
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  const targetDay = result.getDate();
  result.setMonth(result.getMonth() + months);
  if (result.getDate() !== targetDay) {
    result.setDate(0);
  }
  return result;
}

function daysBetween(a: string | Date | null | undefined, b: string | Date | null | undefined): number | null {
  if (!a || !b) return null;
  const msA = new Date(a).getTime();
  const msB = new Date(b).getTime();
  if (isNaN(msA) || isNaN(msB)) return null;
  return Math.round((msB - msA) / 86400000);
}

const createSchema = z.object({
  product: z.string().min(1),
  bottleId: z.string().min(1),
  bottledDate: z.string().min(1),
  intervalMonths: z.number().int().min(1).max(120),
  flavoringEventId: z.number().int().optional(),
});

const tasteSchema = z.object({
  result: z.string().min(1),
  conclusion: z.string().min(1),
  tastedDate: z.string().optional(),
});

const updateSchema = z.object({
  product: z.string().min(1),
  bottleId: z.string().min(1),
  bottledDate: z.string().min(1),
  intervalMonths: z.number().int().min(1).max(120),
  result: z.string().min(1).optional(),
  conclusion: z.string().min(1).optional(),
  tastedDate: z.string().optional(),
  flavoringEventId: z.number().int().nullable().optional(),
});

router.get("/bottle-tests", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  try {
    const items = await db
      .select()
      .from(bottleTestsTable)
      .where(eq(bottleTestsTable.userId, userId))
      .orderBy(
        sql`CASE WHEN ${bottleTestsTable.status} = 'ootab' THEN 0 ELSE 1 END`,
        asc(bottleTestsTable.nextTasting),
        desc(bottleTestsTable.tastedDate)
      );
    res.json(items);
  } catch (err) {
    req.log.error({ err }, "Failed to list bottle tests");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/bottle-tests/:id/journey", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  try {
    const [test] = await db
      .select()
      .from(bottleTestsTable)
      .where(and(eq(bottleTestsTable.id, id), eq(bottleTestsTable.userId, userId)));
    if (!test) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (!test.flavoringEventId) {
      res.json({ journey: null });
      return;
    }
    const [flavEv] = await db
      .select()
      .from(flavoringEventTable)
      .where(and(eq(flavoringEventTable.id, test.flavoringEventId), eq(flavoringEventTable.userId, userId)));
    if (!flavEv) {
      res.json({ journey: null });
      return;
    }
    let ferm = null;
    let brew = null;
    if (flavEv.fermentationBatchId) {
      const [f] = await db
        .select()
        .from(fermentationBatchTable)
        .where(eq(fermentationBatchTable.id, flavEv.fermentationBatchId));
      if (f) {
        ferm = f;
        if (f.brewId) {
          const [b] = await db.select().from(brewsTable).where(eq(brewsTable.id, f.brewId));
          if (b) brew = b;
        }
      }
    }
    const f1Days = daysBetween(ferm?.startDate, ferm?.flavoringDate ?? flavEv.date);
    const f2Days = daysBetween(flavEv.date, flavEv.bottlingDate);
    res.json({
      journey: {
        flavoringEvent: {
          id: flavEv.id,
          date: flavEv.date,
          bottlingDate: flavEv.bottlingDate,
          blocks: flavEv.blocks,
          notes: flavEv.notes,
        },
        fermentation: ferm
          ? {
              id: ferm.id,
              teaSort: ferm.teaSort,
              startDate: ferm.startDate,
              flavoringDate: ferm.flavoringDate,
              notes: ferm.notes,
              vessels: ferm.vessels,
              f1Days,
            }
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
              steepMin: brew.steepMin,
              temp: brew.temp,
              starterPct: brew.starterPct,
              starterG: brew.starterG,
            }
          : null,
        f2Days,
      },
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get journey");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/bottle-tests/:id/ai-insight", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  try {
    const [test] = await db
      .select()
      .from(bottleTestsTable)
      .where(and(eq(bottleTestsTable.id, id), eq(bottleTestsTable.userId, userId)));
    if (!test) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const parts: string[] = [];
    parts.push(`Toode: "${test.product}", pudeli ID: ${test.bottleId}.`);
    parts.push(`Villitud: ${test.bottledDate instanceof Date ? test.bottledDate.toISOString().slice(0, 10) : String(test.bottledDate)}.`);
    if (test.status === "maitsitud" && test.tastedDate) {
      parts.push(`Maitsitud: ${test.tastedDate instanceof Date ? test.tastedDate.toISOString().slice(0, 10) : String(test.tastedDate)}.`);
      if (test.result) parts.push(`Tulemus: ${test.result}.`);
      if (test.conclusion) parts.push(`Järeldus: ${test.conclusion}.`);
    } else {
      parts.push("Katse on veel ootel.");
    }
    if (test.flavoringEventId) {
      const [flavEv] = await db.select().from(flavoringEventTable).where(eq(flavoringEventTable.id, test.flavoringEventId));
      if (flavEv) {
        parts.push(`Maitsestamise kuupäev: ${flavEv.date}, villimise kuupäev: ${flavEv.bottlingDate ?? "teadmata"}.`);
        if (flavEv.fermentationBatchId) {
          const [ferm] = await db.select().from(fermentationBatchTable).where(eq(fermentationBatchTable.id, flavEv.fermentationBatchId));
          if (ferm) {
            parts.push(`Käärimise algus: ${ferm.startDate}, tee: ${ferm.teaSort ?? "teadmata"}.`);
            if (ferm.brewId) {
              const [brew] = await db.select().from(brewsTable).where(eq(brewsTable.id, ferm.brewId));
              if (brew) {
                parts.push(`Pruulimine: teed ${brew.teaG}g, suhkrut ${brew.sugarG}g, tõmbeaeg ${brew.steepMin ?? "?"}min, temp ${brew.temp ?? "?"}°C.`);
              }
            }
          }
        }
      }
    }
    const prompt = parts.join(" ");
    const response = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 250,
      messages: [
        {
          role: "system",
          content: "Oled kombuchavalmistamise ekspert. Analüüsi kestvuskatse andmeid ja anna lühike, konkreetne eestikeelne kokkuvõte: mis läks hästi, mis võiks järgmine kord teisiti olla, ja mida saab õppida selle partii pruulimisparameetritest. Maksimaalselt 3 lauset.",
        },
        { role: "user", content: prompt },
      ],
    });
    const insight = response.choices[0]?.message?.content ?? "Analüüsi ei saanud koostada.";
    res.json({ insight });
  } catch (err) {
    req.log.error({ err }, "Failed to generate AI insight");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/bottle-tests", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", issues: parsed.error.issues });
    return;
  }
  const { product, bottleId, bottledDate, intervalMonths, flavoringEventId } = parsed.data;
  const bottledDateObj = new Date(bottledDate);
  if (isNaN(bottledDateObj.getTime())) {
    res.status(400).json({ error: "Invalid bottledDate" });
    return;
  }
  const nextTasting = addMonths(bottledDateObj, intervalMonths);
  try {
    const [item] = await db
      .insert(bottleTestsTable)
      .values({
        userId,
        product,
        bottleId,
        bottledDate: bottledDateObj,
        intervalMonths,
        nextTasting,
        status: "ootab",
        flavoringEventId: flavoringEventId ?? null,
      })
      .returning();
    res.status(201).json(item);
  } catch (err) {
    req.log.error({ err }, "Failed to create bottle test");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/bottle-tests/:id/taste", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = tasteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", issues: parsed.error.issues });
    return;
  }
  const { result, conclusion, tastedDate: tastedDateStr } = parsed.data;
  let tastedDateObj = new Date();
  if (tastedDateStr) {
    const parsed2 = parseDateOnly(tastedDateStr);
    if (!parsed2) {
      res.status(400).json({ error: "Invalid tastedDate: must be YYYY-MM-DD" });
      return;
    }
    if (parsed2 > new Date()) {
      res.status(400).json({ error: "tastedDate cannot be in the future" });
      return;
    }
    tastedDateObj = parsed2;
  }
  try {
    const [existing] = await db
      .select()
      .from(bottleTestsTable)
      .where(and(eq(bottleTestsTable.id, id), eq(bottleTestsTable.userId, userId)));
    if (!existing) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (existing.status === "maitsitud") {
      res.status(409).json({ error: "Already tasted" });
      return;
    }
    const [updated] = await db
      .update(bottleTestsTable)
      .set({ status: "maitsitud", result, conclusion, tastedDate: tastedDateObj })
      .where(and(eq(bottleTestsTable.id, id), eq(bottleTestsTable.userId, userId)))
      .returning();
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to mark bottle test as tasted");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/bottle-tests/:id", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", issues: parsed.error.issues });
    return;
  }
  const { product, bottleId, bottledDate, intervalMonths, result, conclusion, tastedDate: tastedDateStr, flavoringEventId } = parsed.data;
  const bottledDateObj = new Date(bottledDate);
  if (isNaN(bottledDateObj.getTime())) {
    res.status(400).json({ error: "Invalid bottledDate" });
    return;
  }
  const nextTasting = addMonths(bottledDateObj, intervalMonths);
  let editTastedDate: Date | undefined;
  if (tastedDateStr) {
    const parsed3 = parseDateOnly(tastedDateStr);
    if (!parsed3) {
      res.status(400).json({ error: "Invalid tastedDate: must be YYYY-MM-DD" });
      return;
    }
    if (parsed3 > new Date()) {
      res.status(400).json({ error: "tastedDate cannot be in the future" });
      return;
    }
    editTastedDate = parsed3;
  }
  try {
    const [existing] = await db
      .select()
      .from(bottleTestsTable)
      .where(and(eq(bottleTestsTable.id, id), eq(bottleTestsTable.userId, userId)));
    if (!existing) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const updateFields: Record<string, unknown> = {
      product,
      bottleId,
      bottledDate: bottledDateObj,
      intervalMonths,
      nextTasting,
      flavoringEventId: flavoringEventId !== undefined ? flavoringEventId : existing.flavoringEventId,
    };
    if (existing.status === "maitsitud") {
      if (result !== undefined) updateFields.result = result;
      if (conclusion !== undefined) updateFields.conclusion = conclusion;
      if (editTastedDate !== undefined) updateFields.tastedDate = editTastedDate;
    }
    const [updated] = await db
      .update(bottleTestsTable)
      .set(updateFields)
      .where(and(eq(bottleTestsTable.id, id), eq(bottleTestsTable.userId, userId)))
      .returning();
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update bottle test");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/bottle-tests/:id", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  try {
    const [existing] = await db
      .select()
      .from(bottleTestsTable)
      .where(and(eq(bottleTestsTable.id, id), eq(bottleTestsTable.userId, userId)));
    if (!existing) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (existing.status === "maitsitud") {
      res.status(403).json({ error: "Cannot delete a tasted entry" });
      return;
    }
    await db
      .delete(bottleTestsTable)
      .where(and(eq(bottleTestsTable.id, id), eq(bottleTestsTable.userId, userId)));
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Failed to delete bottle test");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
