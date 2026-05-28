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
  laduFinishedGoodsTable,
  laduMaterialsTable,
} from "@workspace/db";
import { eq, and, gt, ne } from "drizzle-orm";
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
  z.object({
    kind: z.literal("finished_goods"),
    flavorId: z.number().int(),
    size: z.number().int(),
    amount: z.number().int(),
  }),
  z.object({
    kind: z.literal("material"),
    materialId: z.number().int(),
    amount: z.number(),
  }),
]);

const commitSchema = z.object({
  type: z.string().min(1),
  summary: z.string().min(1),
  deltas: z.array(deltaSchema),
  villimineGoods: z
    .object({ flavorId: z.number().int(), size: z.number().int(), amount: z.number().int().min(1) })
    .optional(),
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

const finishedGoodsCommitSchema = z.object({
  flavorId: z.number().int(),
  size: z.number().int(),
  sold: z.number().int().min(0),
  given: z.number().int().min(0),
  note: z.string().optional(),
});

type StoredDelta =
  | { kind: "bottle"; key: number; amount: number }
  | { kind: "label"; flavorId: number; size: number; amount: number }
  | { kind: "cap"; key: number; amount: number }
  | { kind: "custom_label_bottle"; size: number; amount: number }
  | { kind: "wire_cage"; amount: number }
  | { kind: "reusable_cap"; size: number; amount: number }
  | { kind: "blank_label"; blankLabelTypeId: number; size: number; amount: number }
  | { kind: "finished_goods"; flavorId: number; size: number; amount: number }
  | { kind: "material"; materialId: number; amount: number };

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function resolveDefaultBlankLabelType(tx: DbTx, userId: string): Promise<number> {
  // Find or create the canonical "__default__" type — never returns a named type
  let defaultType = (
    await tx
      .select()
      .from(laduBlankLabelTypesTable)
      .where(and(eq(laduBlankLabelTypesTable.userId, userId), eq(laduBlankLabelTypesTable.name, "__default__")))
  )[0];

  if (!defaultType) {
    [defaultType] = await tx
      .insert(laduBlankLabelTypesTable)
      .values({ userId, name: "__default__" })
      .returning();
  }

  const defaultTypeId = defaultType.id;

  // Consolidate stock from all non-default types into the default type (always, not
  // just on creation — handles the case where default existed but named types still have stock)
  const allTypes = await tx
    .select()
    .from(laduBlankLabelTypesTable)
    .where(eq(laduBlankLabelTypesTable.userId, userId));

  const otherTypeIds = new Set(allTypes.filter((t) => t.id !== defaultTypeId).map((t) => t.id));

  if (otherTypeIds.size > 0) {
    const allStock = await tx
      .select()
      .from(laduBlankLabelsTable)
      .where(eq(laduBlankLabelsTable.userId, userId));

    // Only migrate rows with non-zero qty (idempotent: already-zeroed rows are skipped)
    const otherStock = allStock.filter((r) => otherTypeIds.has(r.blankLabelTypeId) && r.qty !== 0);

    if (otherStock.length > 0) {
      // Aggregate net qty per size — preserving negative values exactly
      const bySize: Record<number, number> = {};
      for (const row of otherStock) {
        bySize[row.size] = (bySize[row.size] ?? 0) + row.qty;
      }

      for (const [sizeStr, qty] of Object.entries(bySize)) {
        if (qty === 0) continue;
        const size = Number(sizeStr);
        // Add to existing default row, or insert a new one
        const defaultRow = allStock.find((r) => r.blankLabelTypeId === defaultTypeId && r.size === size);
        if (defaultRow) {
          await tx
            .update(laduBlankLabelsTable)
            .set({ qty: defaultRow.qty + qty })
            .where(eq(laduBlankLabelsTable.id, defaultRow.id));
        } else {
          await tx.insert(laduBlankLabelsTable).values({ userId, blankLabelTypeId: defaultTypeId, size, qty });
        }
      }

      // Zero out migrated rows so they are not double-counted on future calls
      for (const row of otherStock) {
        await tx.update(laduBlankLabelsTable).set({ qty: 0 }).where(eq(laduBlankLabelsTable.id, row.id));
      }
    }
  }

  return defaultTypeId;
}

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
    finishedGoods,
    materials,
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
    db.select().from(laduFinishedGoodsTable).where(eq(laduFinishedGoodsTable.userId, userId)),
    db.select().from(laduMaterialsTable).where(eq(laduMaterialsTable.userId, userId)),
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
    finishedGoods,
    materials,
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
  const { type, summary, deltas, villimineGoods } = parsed.data;

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
          const resolvedTypeId = delta.blankLabelTypeId === 0
            ? await resolveDefaultBlankLabelType(tx, userId)
            : delta.blankLabelTypeId;
          const [existing] = await tx
            .select()
            .from(laduBlankLabelsTable)
            .where(
              and(
                eq(laduBlankLabelsTable.userId, userId),
                eq(laduBlankLabelsTable.blankLabelTypeId, resolvedTypeId),
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
              blankLabelTypeId: resolvedTypeId,
              size: delta.size,
              qty: delta.amount,
            });
          }
          storedDeltas.push({
            kind: "blank_label",
            blankLabelTypeId: resolvedTypeId,
            size: delta.size,
            amount: delta.amount,
          });
        } else if (delta.kind === "finished_goods") {
          const [existing] = await tx
            .select()
            .from(laduFinishedGoodsTable)
            .where(
              and(
                eq(laduFinishedGoodsTable.userId, userId),
                eq(laduFinishedGoodsTable.flavorId, delta.flavorId),
                eq(laduFinishedGoodsTable.size, delta.size)
              )
            );
          const currentQty = existing?.qty ?? 0;
          if (currentQty + delta.amount < 0) {
            const insufficientErr = new Error(`Laos pole piisavalt valmistoodangut — laos ${currentQty}, sooviti ${-delta.amount}`);
            (insufficientErr as any).code = "INSUFFICIENT_STOCK";
            throw insufficientErr;
          }
          if (existing) {
            await tx
              .update(laduFinishedGoodsTable)
              .set({ qty: currentQty + delta.amount })
              .where(eq(laduFinishedGoodsTable.id, existing.id));
          } else {
            await tx.insert(laduFinishedGoodsTable).values({
              userId,
              flavorId: delta.flavorId,
              size: delta.size,
              qty: delta.amount,
            });
          }
          storedDeltas.push({
            kind: "finished_goods",
            flavorId: delta.flavorId,
            size: delta.size,
            amount: delta.amount,
          });
        } else if (delta.kind === "material") {
          const [existing] = await tx
            .select()
            .from(laduMaterialsTable)
            .where(and(eq(laduMaterialsTable.userId, userId), eq(laduMaterialsTable.id, delta.materialId)));
          if (existing) {
            await tx
              .update(laduMaterialsTable)
              .set({ qty: existing.qty + delta.amount })
              .where(eq(laduMaterialsTable.id, existing.id));
            storedDeltas.push({ kind: "material", materialId: delta.materialId, amount: delta.amount });
          }
        }
      }

      if (villimineGoods) {
        const { flavorId: vFlavorId, size: vSize, amount: vAmount } = villimineGoods;
        const [vExisting] = await tx
          .select()
          .from(laduFinishedGoodsTable)
          .where(
            and(
              eq(laduFinishedGoodsTable.userId, userId),
              eq(laduFinishedGoodsTable.flavorId, vFlavorId),
              eq(laduFinishedGoodsTable.size, vSize)
            )
          );
        if (vExisting) {
          await tx
            .update(laduFinishedGoodsTable)
            .set({ qty: vExisting.qty + vAmount })
            .where(eq(laduFinishedGoodsTable.id, vExisting.id));
        } else {
          await tx.insert(laduFinishedGoodsTable).values({ userId, flavorId: vFlavorId, size: vSize, qty: vAmount });
        }
        storedDeltas.push({ kind: "finished_goods", flavorId: vFlavorId, size: vSize, amount: vAmount });
      }

      await tx
        .insert(laduMovementsTable)
        .values({ userId, type, summary, deltas: storedDeltas as unknown[] });
    });

    res.json(await fetchAll(userId));
  } catch (err) {
    if ((err as any).code === "INSUFFICIENT_STOCK") {
      res.status(409).json({ error: (err as Error).message });
      return;
    }
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
        } else if (delta.kind === "finished_goods") {
          const [existing] = await tx
            .select()
            .from(laduFinishedGoodsTable)
            .where(
              and(
                eq(laduFinishedGoodsTable.userId, userId),
                eq(laduFinishedGoodsTable.flavorId, delta.flavorId),
                eq(laduFinishedGoodsTable.size, delta.size)
              )
            );
          if (existing) {
            await tx
              .update(laduFinishedGoodsTable)
              .set({ qty: existing.qty - delta.amount })
              .where(eq(laduFinishedGoodsTable.id, existing.id));
          }
        } else if (delta.kind === "material") {
          const [existing] = await tx
            .select()
            .from(laduMaterialsTable)
            .where(and(eq(laduMaterialsTable.userId, userId), eq(laduMaterialsTable.id, delta.materialId)));
          if (existing) {
            await tx
              .update(laduMaterialsTable)
              .set({ qty: existing.qty - delta.amount })
              .where(eq(laduMaterialsTable.id, existing.id));
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
    const finishedGoodsRows = await db
      .select()
      .from(laduFinishedGoodsTable)
      .where(and(eq(laduFinishedGoodsTable.userId, userId), eq(laduFinishedGoodsTable.flavorId, id), gt(laduFinishedGoodsTable.qty, 0)));
    if (finishedGoodsRows.length > 0) {
      res.status(409).json({ error: "Flavor has finished goods in stock — clear the stock first before deleting" });
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

router.get("/ladu/finished-goods", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  try {
    const rows = await db
      .select({
        id: laduFinishedGoodsTable.id,
        flavorId: laduFinishedGoodsTable.flavorId,
        flavorName: laduFlavorsTable.name,
        size: laduFinishedGoodsTable.size,
        qty: laduFinishedGoodsTable.qty,
      })
      .from(laduFinishedGoodsTable)
      .innerJoin(laduFlavorsTable, eq(laduFinishedGoodsTable.flavorId, laduFlavorsTable.id))
      .where(eq(laduFinishedGoodsTable.userId, userId));
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch finished goods");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/ladu/finished-goods/commit", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const parsed = finishedGoodsCommitSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", issues: parsed.error.issues });
    return;
  }
  const { flavorId, size, sold, given, note } = parsed.data;
  const totalOut = sold + given;
  if (totalOut <= 0) {
    res.status(400).json({ error: "Sisesta müüdud või ära antud kogus" });
    return;
  }
  try {
    await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(laduFinishedGoodsTable)
        .where(
          and(
            eq(laduFinishedGoodsTable.userId, userId),
            eq(laduFinishedGoodsTable.flavorId, flavorId),
            eq(laduFinishedGoodsTable.size, size)
          )
        );
      const currentQty = existing?.qty ?? 0;
      if (currentQty < totalOut) {
        const insufficientErr = new Error(`Laos pole piisavalt valmistoodangut — laos ${currentQty}, sooviti ${totalOut}`);
        (insufficientErr as any).code = "INSUFFICIENT_STOCK";
        throw insufficientErr;
      }
      const [flavor] = await tx
        .select()
        .from(laduFlavorsTable)
        .where(and(eq(laduFlavorsTable.id, flavorId), eq(laduFlavorsTable.userId, userId)));
      const flavorName = flavor?.name ?? String(flavorId);
      await tx
        .update(laduFinishedGoodsTable)
        .set({ qty: currentQty - totalOut })
        .where(eq(laduFinishedGoodsTable.id, existing!.id));
      const parts: string[] = [`${flavorName} ${size} ml`];
      if (sold > 0) parts.push(`müüdud: ${sold}`);
      if (given > 0) parts.push(`ära antud: ${given}`);
      if (note?.trim()) parts.push(note.trim());
      const type = sold > 0 && given > 0 ? "väljastamine" : sold > 0 ? "müük" : "kinkimine";
      const storedDelta: StoredDelta = { kind: "finished_goods", flavorId, size, amount: -totalOut };
      await tx.insert(laduMovementsTable).values({ userId, type, summary: parts.join(" · "), deltas: [storedDelta] as unknown[] });
    });
    res.json(await fetchAll(userId));
  } catch (err) {
    if ((err as any).code === "INSUFFICIENT_STOCK") {
      res.status(409).json({ error: (err as Error).message });
      return;
    }
    req.log.error({ err }, "Failed to commit finished goods");
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

const materialSchema = z.object({
  name: z.string().min(1),
  unit: z.string().min(1),
});

router.post("/ladu/materials", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const parsed = materialSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", issues: parsed.error.issues });
    return;
  }
  try {
    const [material] = await db
      .insert(laduMaterialsTable)
      .values({ userId, name: parsed.data.name.trim(), unit: parsed.data.unit.trim(), qty: 0 })
      .returning();
    res.status(201).json(material);
  } catch (err) {
    req.log.error({ err }, "Failed to create material");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/ladu/materials/:id", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = materialSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", issues: parsed.error.issues });
    return;
  }
  try {
    const [existing] = await db
      .select()
      .from(laduMaterialsTable)
      .where(and(eq(laduMaterialsTable.id, id), eq(laduMaterialsTable.userId, userId)));
    if (!existing) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const [updated] = await db
      .update(laduMaterialsTable)
      .set({ name: parsed.data.name.trim(), unit: parsed.data.unit.trim() })
      .where(eq(laduMaterialsTable.id, id))
      .returning();
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update material");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/ladu/materials/:id", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  try {
    const [existing] = await db
      .select()
      .from(laduMaterialsTable)
      .where(and(eq(laduMaterialsTable.id, id), eq(laduMaterialsTable.userId, userId)));
    if (!existing) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    await db
      .delete(laduMaterialsTable)
      .where(and(eq(laduMaterialsTable.id, id), eq(laduMaterialsTable.userId, userId)));
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Failed to delete material");
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
      await tx.delete(laduFinishedGoodsTable).where(eq(laduFinishedGoodsTable.userId, userId));
      await tx.delete(laduMaterialsTable).where(eq(laduMaterialsTable.userId, userId));
    });
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Failed to reset ladu");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
