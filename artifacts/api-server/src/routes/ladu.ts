import { Router } from "express";
import { z } from "zod/v4";
import { db } from "@workspace/db";
import {
  laduFlavorsTable,
  laduBottlesTable,
  laduLabelsTable,
  laduCapsTable,
  laduMovementsTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
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

router.get("/ladu", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  try {
    const [flavors, bottles, labels, caps, movements] = await Promise.all([
      db.select().from(laduFlavorsTable).where(eq(laduFlavorsTable.userId, userId)),
      db.select().from(laduBottlesTable).where(eq(laduBottlesTable.userId, userId)),
      db.select().from(laduLabelsTable).where(eq(laduLabelsTable.userId, userId)),
      db.select().from(laduCapsTable).where(eq(laduCapsTable.userId, userId)),
      db
        .select()
        .from(laduMovementsTable)
        .where(eq(laduMovementsTable.userId, userId))
        .orderBy(laduMovementsTable.createdAt),
    ]);
    res.json({
      flavors,
      bottles,
      labels,
      caps,
      movements: movements.reverse().slice(0, 200),
    });
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
        } else if (delta.kind === "cap") {
          const [existing] = await tx
            .select()
            .from(laduCapsTable)
            .where(and(eq(laduCapsTable.userId, userId), eq(laduCapsTable.id, delta.key)));
          if (existing) {
            await tx
              .update(laduCapsTable)
              .set({ qty: existing.qty + delta.amount })
              .where(eq(laduCapsTable.id, existing.id));
          } else if (delta.create) {
            await tx.insert(laduCapsTable).values({
              userId,
              size: delta.create.size,
              type: delta.create.type,
              color: delta.create.color,
              qty: delta.amount,
            });
          }
        }
      }
      await tx
        .insert(laduMovementsTable)
        .values({ userId, type, summary, deltas: deltas as unknown[] });
    });

    const [flavors, bottles, labels, caps, movements] = await Promise.all([
      db.select().from(laduFlavorsTable).where(eq(laduFlavorsTable.userId, userId)),
      db.select().from(laduBottlesTable).where(eq(laduBottlesTable.userId, userId)),
      db.select().from(laduLabelsTable).where(eq(laduLabelsTable.userId, userId)),
      db.select().from(laduCapsTable).where(eq(laduCapsTable.userId, userId)),
      db
        .select()
        .from(laduMovementsTable)
        .where(eq(laduMovementsTable.userId, userId))
        .orderBy(laduMovementsTable.createdAt),
    ]);
    res.json({
      flavors,
      bottles,
      labels,
      caps,
      movements: movements.reverse().slice(0, 200),
    });
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
    const deltas = movement.deltas as Array<{ kind: string; key?: number; flavorId?: number; size?: number; amount: number }>;
    await db.transaction(async (tx) => {
      for (const delta of deltas) {
        if (delta.kind === "bottle" && delta.key != null) {
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
        } else if (delta.kind === "label" && delta.flavorId != null && delta.size != null) {
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
        } else if (delta.kind === "cap" && delta.key != null) {
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
    if (labels.some((l) => l.qty > 0)) {
      res.status(409).json({ error: "Flavor has labels in stock" });
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

router.delete("/ladu/reset", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  try {
    await db.transaction(async (tx) => {
      await tx.delete(laduMovementsTable).where(eq(laduMovementsTable.userId, userId));
      await tx.delete(laduLabelsTable).where(eq(laduLabelsTable.userId, userId));
      await tx.delete(laduBottlesTable).where(eq(laduBottlesTable.userId, userId));
      await tx.delete(laduCapsTable).where(eq(laduCapsTable.userId, userId));
      await tx.delete(laduFlavorsTable).where(eq(laduFlavorsTable.userId, userId));
    });
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Failed to reset ladu");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
