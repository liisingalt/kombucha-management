import { Router } from "express";
import { z } from "zod/v4";
import { db } from "@workspace/db";
import {
  laduFlavorsTable,
  laduBottlesTable,
  laduLabelsTable,
  laduCapsTable,
  laduCustomLabelBottlesTable,
  laduWireCagesTable,
  laduReusableCapsTable,
  laduMovementsTable,
  laduBlankLabelTypesTable,
  laduBlankLabelsTable,
} from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";

const router = Router();

const deltaSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("bottle"),
    key: z.number().int(),
    amount: z.number().int(),
  }),
  z.object({
    kind: z.literal("label"),
    flavorId: z.number().int(),
    size: z.number().int(),
    amount: z.number().int(),
  }),
  z.object({
    kind: z.literal("cap"),
    key: z.number().int(),
    amount: z.number().int(),
    create: z
      .object({
        size: z.number().int(),
        type: z.string(),
        color: z.string(),
      })
      .optional(),
  }),
  z.object({
    kind: z.literal("custom_label_bottle"),
    size: z.number().int(),
    amount: z.number().int(),
  }),
  z.object({
    kind: z.literal("wire_cage"),
    amount: z.number().int(),
  }),
  z.object({
    kind: z.literal("reusable_cap"),
    size: z.number().int(),
    amount: z.number().int(),
  }),
  z.object({
    kind: z.literal("blank_label"),
    blankLabelTypeId: z.number().int(),
    size: z.number().int(),
    amount: z.number().int(),
  }),
]);

const commitSchema = z.object({
  type: z.string().min(1),
  summary: z.string().min(1),
  deltas: z.array(deltaSchema),
});

const flavorSchema = z.object({
  name: z.string().min(1),
  defaultCapId: z.number().int().nullable().optional(),
});

const capUpdateSchema = z.object({
  size: z.number().int(),
  type: z.string().min(1),
  color: z.string(),
});

const blankLabelTypeSchema = z.object({
  name: z.string().min(1),
});

type StoredDelta =
  | { kind: "bottle"; key: number; amount: number }
  | { kind: "label"; flavorId: number; size: number; amount: number }
  | { kind: "cap"; key: number; amount: number }
  | { kind: "custom_label_bottle"; size: number; amount: number }
  | { kind: "wire_cage"; amount: number }
  | { kind: "reusable_cap"; size: number; amount: number }
  | { kind: "blank_label"; blankLabelTypeId: number; size: number; amount: number };

async function fetchAll(userId: string) {
  const [
    flavors,
    bottles,
    labels,
    caps,
    customLabelBottles,
    wireCageRows,
    reusableCapRows,
    movements,
    blankLabelTypes,
    blankLabels,
  ] = await Promise.all([
    db.select().from(laduFlavorsTable).where(eq(laduFlavorsTable.userId, userId)),
    db.select().from(laduBottlesTable).where(eq(laduBottlesTable.userId, userId)),
    db.select().from(laduLabelsTable).where(eq(laduLabelsTable.userId, userId)),
    db.select().from(laduCapsTable).where(eq(laduCapsTable.userId, userId)),
    db.select().from(laduCustomLabelBottlesTable).where(eq(laduCustomLabelBottlesTable.userId, userId)),
    db.select().from(laduWireCagesTable).where(eq(laduWireCagesTable.userId, userId)),
    db.select().from(laduReusableCapsTable).where(eq(laduReusableCapsTable.userId, userId)),
    db
      .select()
      .from(laduMovementsTable)
      .where(eq(laduMovementsTable.userId, userId))
      .orderBy(laduMovementsTable.createdAt),
    db.select().from(laduBlankLabelTypesTable).where(eq(laduBlankLabelTypesTable.userId, userId)),
    db.select().from(laduBlankLabelsTable).where(eq(laduBlankLabelsTable.userId, userId)),
  ]);
  return {
    flavors,
    bottles,
    labels,
    caps,
    customLabelBottles,
    wireCageQty: wireCageRows[0]?.qty ?? 0,
    reusableCaps: reusableCapRows.map((r) => ({ size: r.size, qty: r.qty })),
    movements: movements.reverse().slice(0, 200),
    blankLabelTypes,
    blankLabels,
  };
}

router.get("/ladu", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  try {
    res.json(await fetchAll(userId));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch ladu");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/ladu/commit", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const parsed = commitSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", issues: parsed.error.issues });
    return;
  }
  const { type, summary, deltas } = parsed.data;

  try {
    await db.transaction(async (tx) => {
      const storedDeltas: StoredDelta[] = [];

      for (const delta of deltas) {
        if (delta.kind === "bottle") {
          const [existing] = await tx
            .select()
            .from(laduBottlesTable)
            .where(and(eq(laduBottlesTable.userId, userId), eq(laduBottlesTable.size, delta.key)));
          if (existing) {
            await tx
              .update(laduBottlesTable)
              .set({ qty: existing.qty + delta.amount })
              .where(eq(laduBottlesTable.id, existing.id));
          } else {
            await tx.insert(laduBottlesTable).values({ userId, size: delta.key, qty: delta.amount });
          }
          storedDeltas.push({ kind: "bottle", key: delta.key, amount: delta.amount });
        } else if (delta.kind === "label") {
          const [existing] = await tx
            .select()
            .from(laduLabelsTable)
            .where(
              and(
                eq(laduLabelsTable.userId, userId),
                eq(laduLabelsTable.flavorId, delta.flavorId),
                eq(laduLabelsTable.size, delta.size)
              )
            );
          if (existing) {
            await tx
              .update(laduLabelsTable)
              .set({ qty: existing.qty + delta.amount })
              .where(eq(laduLabelsTable.id, existing.id));
          } else {
            await tx
              .insert(laduLabelsTable)
              .values({ userId, flavorId: delta.flavorId, size: delta.size, qty: delta.amount });
          }
          storedDeltas.push({ kind: "label", flavorId: delta.flavorId, size: delta.size, amount: delta.amount });
        } else if (delta.kind === "cap") {
          if (delta.key !== 0) {
            const [existing] = await tx
              .select()
              .from(laduCapsTable)
              .where(and(eq(laduCapsTable.userId, userId), eq(laduCapsTable.id, delta.key)));
            if (existing) {
              await tx
                .update(laduCapsTable)
                .set({ qty: existing.qty + delta.amount })
                .where(eq(laduCapsTable.id, existing.id));
            }
            storedDeltas.push({ kind: "cap", key: delta.key, amount: delta.amount });
          } else if (delta.create) {
            const { size, type, color } = delta.create;
            const [existingVariant] = await tx
              .select()
              .from(laduCapsTable)
              .where(
                and(
                  eq(laduCapsTable.userId, userId),
                  eq(laduCapsTable.size, size),
                  eq(laduCapsTable.type, type),
                  eq(laduCapsTable.color, color)
                )
              );
            if (existingVariant) {
              await tx
                .update(laduCapsTable)
                .set({ qty: existingVariant.qty + delta.amount })
                .where(eq(laduCapsTable.id, existingVariant.id));
              storedDeltas.push({ kind: "cap", key: existingVariant.id, amount: delta.amount });
            } else {
              const [inserted] = await tx
                .insert(laduCapsTable)
                .values({ userId, size, type, color, qty: delta.amount })
                .returning();
              storedDeltas.push({ kind: "cap", key: inserted.id, amount: delta.amount });
            }
          }
        } else if (delta.kind === "custom_label_bottle") {
          const [existing] = await tx
            .select()
            .from(laduCustomLabelBottlesTable)
            .where(
              and(
                eq(laduCustomLabelBottlesTable.userId, userId),
                eq(laduCustomLabelBottlesTable.size, delta.size)
              )
            );
          if (existing) {
            await tx
              .update(laduCustomLabelBottlesTable)
              .set({ qty: existing.qty + delta.amount })
              .where(eq(laduCustomLabelBottlesTable.id, existing.id));
          } else {
            await tx
              .insert(laduCustomLabelBottlesTable)
              .values({ userId, size: delta.size, qty: delta.amount });
          }
          storedDeltas.push({ kind: "custom_label_bottle", size: delta.size, amount: delta.amount });
        } else if (delta.kind === "wire_cage") {
          const [existing] = await tx
            .select()
            .from(laduWireCagesTable)
            .where(eq(laduWireCagesTable.userId, userId));
          if (existing) {
            await tx
              .update(laduWireCagesTable)
              .set({ qty: existing.qty + delta.amount })
              .where(eq(laduWireCagesTable.id, existing.id));
          } else {
            await tx
              .insert(laduWireCagesTable)
              .values({ userId, qty: delta.amount });
          }
          storedDeltas.push({ kind: "wire_cage", amount: delta.amount });
        } else if (delta.kind === "reusable_cap") {
          const [existing] = await tx
            .select()
            .from(laduReusableCapsTable)
            .where(and(eq(laduReusableCapsTable.userId, userId), eq(laduReusableCapsTable.size, delta.size)));
          if (existing) {
            await tx
              .update(laduReusableCapsTable)
              .set({ qty: existing.qty + delta.amount })
              .where(eq(laduReusableCapsTable.id, existing.id));
          } else {
            await tx.insert(laduReusableCapsTable).values({ userId, size: delta.size, qty: delta.amount });
          }
          storedDeltas.push({ kind: "reusable_cap", size: delta.size, amount: delta.amount });
        } else if (delta.kind === "blank_label") {
          const [existing] = await tx
            .select()
            .from(laduBlankLabelsTable)
            .where(
              and(
                eq(laduBlankLabelsTable.userId, userId),
                eq(laduBlankLabelsTable.blankLabelTypeId, delta.blankLabelTypeId),
                eq(laduBlankLabelsTable.size, delta.size)
              )
            );
          if (existing) {
            await tx
              .update(laduBlankLabelsTable)
              .set({ qty: existing.qty + delta.amount })
              .where(eq(laduBlankLabelsTable.id, existing.id));
          } else {
            await tx.insert(laduBlankLabelsTable).values({
              userId,
              blankLabelTypeId: delta.blankLabelTypeId,
              size: delta.size,
              qty: delta.amount,
            });
          }
          storedDeltas.push({
            kind: "blank_label",
            blankLabelTypeId: delta.blankLabelTypeId,
            size: delta.size,
            amount: delta.amount,
          });
        }
      }

      await tx
        .insert(laduMovementsTable)
        .values({ userId, type, summary, deltas: storedDeltas as unknown[] });
    });

    res.json(await fetchAll(userId));
  } catch (err) {
    req.log.error({ err }, "Failed to commit ladu transaction");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/ladu/movements/:id", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  try {
    const [movement] = await db
      .select()
      .from(laduMovementsTable)
      .where(and(eq(laduMovementsTable.id, id), eq(laduMovementsTable.userId, userId)));
    if (!movement) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const deltas = movement.deltas as StoredDelta[];
    await db.transaction(async (tx) => {
      for (const delta of deltas) {
        if (delta.kind === "bottle") {
          const [existing] = await tx
            .select()
            .from(laduBottlesTable)
            .where(and(eq(laduBottlesTable.userId, userId), eq(laduBottlesTable.size, delta.key)));
          if (existing) {
            await tx
              .update(laduBottlesTable)
              .set({ qty: existing.qty - delta.amount })
              .where(eq(laduBottlesTable.id, existing.id));
          }
        } else if (delta.kind === "label") {
          const [existing] = await tx
            .select()
            .from(laduLabelsTable)
            .where(
              and(
                eq(laduLabelsTable.userId, userId),
                eq(laduLabelsTable.flavorId, delta.flavorId),
                eq(laduLabelsTable.size, delta.size)
              )
            );
          if (existing) {
            await tx
              .update(laduLabelsTable)
              .set({ qty: existing.qty - delta.amount })
              .where(eq(laduLabelsTable.id, existing.id));
          }
        } else if (delta.kind === "cap") {
          const [existing] = await tx
            .select()
            .from(laduCapsTable)
            .where(and(eq(laduCapsTable.userId, userId), eq(laduCapsTable.id, delta.key)));
          if (existing) {
            await tx
              .update(laduCapsTable)
              .set({ qty: existing.qty - delta.amount })
              .where(eq(laduCapsTable.id, existing.id));
          }
        } else if (delta.kind === "custom_label_bottle") {
          const [existing] = await tx
            .select()
            .from(laduCustomLabelBottlesTable)
            .where(
              and(
                eq(laduCustomLabelBottlesTable.userId, userId),
                eq(laduCustomLabelBottlesTable.size, delta.size)
              )
            );
          if (existing) {
            await tx
              .update(laduCustomLabelBottlesTable)
              .set({ qty: existing.qty - delta.amount })
              .where(eq(laduCustomLabelBottlesTable.id, existing.id));
          }
        } else if (delta.kind === "wire_cage") {
          const [existing] = await tx
            .select()
            .from(laduWireCagesTable)
            .where(eq(laduWireCagesTable.userId, userId));
          if (existing) {
            await tx
              .update(laduWireCagesTable)
              .set({ qty: existing.qty - delta.amount })
              .where(eq(laduWireCagesTable.id, existing.id));
          }
        } else if (delta.kind === "reusable_cap") {
          const [existing] = await tx
            .select()
            .from(laduReusableCapsTable)
            .where(and(eq(laduReusableCapsTable.userId, userId), eq(laduReusableCapsTable.size, delta.size)));
          if (existing) {
            await tx
              .update(laduReusableCapsTable)
              .set({ qty: existing.qty - delta.amount })
              .where(eq(laduReusableCapsTable.id, existing.id));
          }
        } else if (delta.kind === "blank_label") {
          const [existing] = await tx
            .select()
            .from(laduBlankLabelsTable)
            .where(
              and(
                eq(laduBlankLabelsTable.userId, userId),
                eq(laduBlankLabelsTable.blankLabelTypeId, delta.blankLabelTypeId),
                eq(laduBlankLabelsTable.size, delta.size)
              )
            );
          if (existing) {
            await tx
              .update(laduBlankLabelsTable)
              .set({ qty: existing.qty - delta.amount })
              .where(eq(laduBlankLabelsTable.id, existing.id));
          }
        }
      }
      await tx.delete(laduMovementsTable).where(eq(laduMovementsTable.id, id));
    });
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Failed to undo movement");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/ladu/flavors", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const parsed = flavorSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", issues: parsed.error.issues });
    return;
  }
  try {
    const [flavor] = await db
      .insert(laduFlavorsTable)
      .values({
        userId,
        name: parsed.data.name,
        defaultCapId: parsed.data.defaultCapId ?? null,
      })
      .returning();
    res.status(201).json(flavor);
  } catch (err) {
    req.log.error({ err }, "Failed to create flavor");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/ladu/flavors/:id", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = flavorSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", issues: parsed.error.issues });
    return;
  }
  try {
    const [existing] = await db
      .select()
      .from(laduFlavorsTable)
      .where(and(eq(laduFlavorsTable.id, id), eq(laduFlavorsTable.userId, userId)));
    if (!existing) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const [updated] = await db
      .update(laduFlavorsTable)
      .set({ name: parsed.data.name, defaultCapId: parsed.data.defaultCapId ?? null })
      .where(eq(laduFlavorsTable.id, id))
      .returning();
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update flavor");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/ladu/flavors/:id", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  try {
    const labels = await db
      .select()
      .from(laduLabelsTable)
      .where(and(eq(laduLabelsTable.userId, userId), eq(laduLabelsTable.flavorId, id)));
    if (labels.length > 0) {
      res.status(409).json({ error: "Flavor has label records — delete them first or reset inventory" });
      return;
    }
    const customLabelBottles = await db
      .select()
      .from(laduCustomLabelBottlesTable)
      .where(and(eq(laduCustomLabelBottlesTable.userId, userId), gt(laduCustomLabelBottlesTable.qty, 0)));
    if (customLabelBottles.length > 0) {
      res.status(409).json({ error: "Custom label bottle stock exists — reset inventory before deleting a flavor" });
      return;
    }
    await db
      .delete(laduFlavorsTable)
      .where(and(eq(laduFlavorsTable.id, id), eq(laduFlavorsTable.userId, userId)));
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Failed to delete flavor");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/ladu/caps/:id", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = capUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", issues: parsed.error.issues });
    return;
  }
  try {
    const [existing] = await db
      .select()
      .from(laduCapsTable)
      .where(and(eq(laduCapsTable.id, id), eq(laduCapsTable.userId, userId)));
    if (!existing) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const [updated] = await db
      .update(laduCapsTable)
      .set({ size: parsed.data.size, type: parsed.data.type, color: parsed.data.color })
      .where(eq(laduCapsTable.id, id))
      .returning();
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update cap");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/ladu/blank-label-types", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const parsed = blankLabelTypeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", issues: parsed.error.issues });
    return;
  }
  try {
    const [type] = await db
      .insert(laduBlankLabelTypesTable)
      .values({ userId, name: parsed.data.name.trim() })
      .returning();
    res.status(201).json(type);
  } catch (err) {
    req.log.error({ err }, "Failed to create blank label type");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/ladu/blank-label-types/:id", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  try {
    const stockRows = await db
      .select()
      .from(laduBlankLabelsTable)
      .where(
        and(
          eq(laduBlankLabelsTable.userId, userId),
          eq(laduBlankLabelsTable.blankLabelTypeId, id)
        )
      );
    const hasStock = stockRows.some((r) => r.qty !== 0);
    if (hasStock) {
      res.status(409).json({ error: "Sildil on laovaru — esmalt too kogused nullini" });
      return;
    }
    await db.transaction(async (tx) => {
      await tx
        .delete(laduBlankLabelsTable)
        .where(and(eq(laduBlankLabelsTable.userId, userId), eq(laduBlankLabelsTable.blankLabelTypeId, id)));
      await tx
        .delete(laduBlankLabelTypesTable)
        .where(and(eq(laduBlankLabelTypesTable.id, id), eq(laduBlankLabelTypesTable.userId, userId)));
    });
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Failed to delete blank label type");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/ladu/reset", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  try {
    await db.transaction(async (tx) => {
      await tx.delete(laduMovementsTable).where(eq(laduMovementsTable.userId, userId));
      await tx.delete(laduLabelsTable).where(eq(laduLabelsTable.userId, userId));
      await tx.delete(laduCustomLabelBottlesTable).where(eq(laduCustomLabelBottlesTable.userId, userId));
      await tx.delete(laduWireCagesTable).where(eq(laduWireCagesTable.userId, userId));
      await tx.delete(laduBottlesTable).where(eq(laduBottlesTable.userId, userId));
      await tx.delete(laduCapsTable).where(eq(laduCapsTable.userId, userId));
      await tx.delete(laduFlavorsTable).where(eq(laduFlavorsTable.userId, userId));
      await tx.delete(laduBlankLabelsTable).where(eq(laduBlankLabelsTable.userId, userId));
      await tx.delete(laduBlankLabelTypesTable).where(eq(laduBlankLabelTypesTable.userId, userId));
    });
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Failed to reset ladu");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
