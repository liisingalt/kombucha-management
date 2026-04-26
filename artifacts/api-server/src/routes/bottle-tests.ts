import { Router } from "express";
import { z } from "zod/v4";
import { db } from "@workspace/db";
import { bottleTestsTable } from "@workspace/db";
import { eq, and, asc, desc, sql } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";

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

const createSchema = z.object({
  product: z.string().min(1),
  bottleId: z.string().min(1),
  bottledDate: z.string().min(1),
  intervalMonths: z.number().int().min(1).max(120),
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

router.post("/bottle-tests", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", issues: parsed.error.issues });
    return;
  }
  const { product, bottleId, bottledDate, intervalMonths } = parsed.data;
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
  const { product, bottleId, bottledDate, intervalMonths, result, conclusion, tastedDate: tastedDateStr } = parsed.data;
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
