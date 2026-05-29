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
  laduReturnedBottlesTable,
  flavoringEventTable,
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
  z.object({
    kind: z.literal("returned_bottle"),
    flavorId: z.number().int(),
    size: z.number().int(),
    amount: z.number().int(),
  }),
]);

const commitSchema = z.object({
  type: z.string().min(1),
  summary: z.string().min(1),
  deltas: z.array(deltaSchema),
  bottlingDate: z.string().optional(),
  villimineGoods: z
    .object({
      flavorId: z.number().int(),
      size: z.number().int(),
      amount: z.number().int().min(1),
      flavoringEventId: z.number().int().optional(),
      savedStarterG: z.number().int().min(0).optional(),
    })
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
  | { kind: "material"; materialId: number; amount: number }
  | { kind: "returned_bottle"; flavorId: number; size: number; amount: number }
  | { kind: "trace"; flavoringEventId: number };

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
    returnedBottles,
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
    db.select().from(laduReturnedBottlesTable).where(eq(laduReturnedBottlesTable.userId, userId)),
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
    returnedBottles,
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
  const { type, summary, deltas, villimineGoods, bottlingDate } = parsed.data;

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
        } else if (delta.kind === "returned_bottle") {
          const [existing] = await tx
            .select()
            .from(laduReturnedBottlesTable)
            .where(
              and(
                eq(laduReturnedBottlesTable.userId, userId),
                eq(laduReturnedBottlesTable.flavorId, delta.flavorId),
                eq(laduReturnedBottlesTable.size, delta.size)
              )
            );
          const currentQty = existing?.qty ?? 0;
          if (currentQty + delta.amount < 0) {
            const insufficientErr = new Error(`Tagastatud pudeleid pole piisavalt — laos ${currentQty}, sooviti ${-delta.amount}`);
            (insufficientErr as any).code = "INSUFFICIENT_STOCK";
            throw insufficientErr;
          }
          if (existing) {
            await tx
              .update(laduReturnedBottlesTable)
              .set({ qty: currentQty + delta.amount })
              .where(eq(laduReturnedBottlesTable.id, existing.id));
          } else {
            await tx.insert(laduReturnedBottlesTable).values({
              userId,
              flavorId: delta.flavorId,
              size: delta.size,
              qty: delta.amount,
            });
          }
          storedDeltas.push({ kind: "returned_bottle", flavorId: delta.flavorId, size: delta.size, amount: delta.amount });
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
        if (villimineGoods.flavoringEventId != null) {
          storedDeltas.push({ kind: "trace", flavoringEventId: villimineGoods.flavoringEventId });
          const eventUpdate: { savedStarterG?: number; bottlingDate?: string } = {};
          if (villimineGoods.savedStarterG != null) eventUpdate.savedStarterG = villimineGoods.savedStarterG;
          if (bottlingDate) eventUpdate.bottlingDate = bottlingDate;
          if (Object.keys(eventUpdate).length > 0) {
            await tx
              .update(flavoringEventTable)
              .set(eventUpdate)
              .where(and(eq(flavoringEventTable.id, villimineGoods.flavoringEventId), eq(flavoringEventTable.userId, userId)));
          }
        }
      }

      const movementCreatedAt = bottlingDate ? new Date(bottlingDate) : undefined;
      await tx
        .insert(laduMovementsTable)
        .values({
          userId, type, summary, deltas: storedDeltas as unknown[],
          ...(movementCreatedAt ? { createdAt: movementCreatedAt } : {}),
        });
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

class UserError extends Error {}

const patchSaleMovementSchema = z.object({
  sold: z.number().int().min(0),
  given: z.number().int().min(0),
  note: z.string().optional(),
});

router.patch("/ladu/movements/:id", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = patchSaleMovementSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", issues: parsed.error.issues });
    return;
  }
  const { sold, given, note } = parsed.data;
  const totalOut = sold + given;
  if (totalOut <= 0) {
    res.status(400).json({ error: "Sisesta müüdud või ära antud kogus" });
    return;
  }
  try {
    await db.transaction(async (tx) => {
      const [movement] = await tx
        .select()
        .from(laduMovementsTable)
        .where(and(eq(laduMovementsTable.id, id), eq(laduMovementsTable.userId, userId)));
      if (!movement) {
        throw Object.assign(new Error("Kannet ei leitud"), { code: "NOT_FOUND" });
      }
      if (!["müük", "väljastamine", "kinkimine"].includes(movement.type)) {
        throw Object.assign(new Error("Seda tüüpi kannet ei saa muuta"), { code: "FORBIDDEN" });
      }
      const deltas = movement.deltas as StoredDelta[];
      const fgDelta = deltas.find((d): d is Extract<StoredDelta, { kind: "finished_goods" }> => d.kind === "finished_goods");
      if (!fgDelta) {
        throw Object.assign(new Error("Kanne pole korrektne"), { code: "BAD_REQUEST" });
      }
      const oldAmount = fgDelta.amount;
      const newAmount = -totalOut;
      const diff = newAmount - oldAmount;
      const [existing] = await tx
        .select()
        .from(laduFinishedGoodsTable)
        .where(and(
          eq(laduFinishedGoodsTable.userId, userId),
          eq(laduFinishedGoodsTable.flavorId, fgDelta.flavorId),
          eq(laduFinishedGoodsTable.size, fgDelta.size)
        ));
      const currentQty = existing?.qty ?? 0;
      const newQty = currentQty + diff;
      if (newQty < 0) {
        const insufficientErr = new Error(`Laos pole piisavalt valmistoodangut — laos ${currentQty + (-oldAmount)}, sooviti ${totalOut}`);
        (insufficientErr as any).code = "INSUFFICIENT_STOCK";
        throw insufficientErr;
      }
      if (existing) {
        await tx.update(laduFinishedGoodsTable)
          .set({ qty: newQty })
          .where(eq(laduFinishedGoodsTable.id, existing.id));
      } else {
        await tx.insert(laduFinishedGoodsTable).values({
          userId,
          flavorId: fgDelta.flavorId,
          size: fgDelta.size,
          qty: newQty,
        });
      }
      const [flavor] = await tx
        .select()
        .from(laduFlavorsTable)
        .where(and(eq(laduFlavorsTable.id, fgDelta.flavorId), eq(laduFlavorsTable.userId, userId)));
      const flavorName = flavor?.name ?? String(fgDelta.flavorId);
      const parts: string[] = [`${flavorName} ${fgDelta.size} ml`];
      if (sold > 0) parts.push(`müüdud: ${sold}`);
      if (given > 0) parts.push(`ära antud: ${given}`);
      if (note?.trim()) parts.push(note.trim());
      const type = sold > 0 && given > 0 ? "väljastamine" : sold > 0 ? "müük" : "kinkimine";
      const newDelta: StoredDelta = { kind: "finished_goods", flavorId: fgDelta.flavorId, size: fgDelta.size, amount: newAmount };
      await tx.update(laduMovementsTable)
        .set({ type, summary: parts.join(" · "), deltas: [newDelta] as unknown[] })
        .where(eq(laduMovementsTable.id, id));
    });
    res.json(await fetchAll(userId));
  } catch (err) {
    if ((err as any).code === "NOT_FOUND") {
      res.status(404).json({ error: (err as Error).message });
      return;
    }
    if ((err as any).code === "FORBIDDEN") {
      res.status(403).json({ error: (err as Error).message });
      return;
    }
    if ((err as any).code === "INSUFFICIENT_STOCK") {
      res.status(409).json({ error: (err as Error).message });
      return;
    }
    req.log.error({ err }, "Failed to patch sale movement");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/ladu/movements/:id", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const { capId, quantity } = req.body as { capId?: number | null; quantity?: number };
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

    // Handle quantity change for villimine movements
    if (quantity !== undefined && movement.type === "villimine") {
      if (!Number.isInteger(quantity) || quantity <= 0) {
        res.status(400).json({ error: "Kogus peab olema positiivne täisarv" });
        return;
      }
      const fgDelta = deltas.find((d): d is { kind: "finished_goods"; flavorId: number; size: number; amount: number } => d.kind === "finished_goods");
      if (!fgDelta) {
        res.status(400).json({ error: "Villimiskanne on vigane — finished_goods delta puudub" });
        return;
      }
      const oldQty = fgDelta.amount;
      if (quantity !== oldQty) {
        const updatedDeltas: StoredDelta[] = deltas.map((d) => {
          if (d.kind === "trace") return d;
          const newAmount = Math.round((d.amount * quantity) / oldQty);
          return { ...d, amount: newAmount } as StoredDelta;
        });

        await db.transaction(async (tx) => {
          for (let i = 0; i < deltas.length; i++) {
            const delta = deltas[i];
            const updated = updatedDeltas[i];
            if (delta.kind === "trace") continue;
            const correction = (updated as { amount: number }).amount - delta.amount;
            if (correction === 0) continue;

            if (delta.kind === "bottle") {
              const [row] = await tx.select().from(laduBottlesTable)
                .where(and(eq(laduBottlesTable.userId, userId), eq(laduBottlesTable.size, delta.key)));
              if (!row) continue;
              const newQtyInTable = row.qty + correction;
              if (newQtyInTable < 0) throw new UserError(`Pudelite varu (${delta.key} ml) läheks miinusesse`);
              await tx.update(laduBottlesTable).set({ qty: newQtyInTable }).where(eq(laduBottlesTable.id, row.id));
            } else if (delta.kind === "cap") {
              const [row] = await tx.select().from(laduCapsTable)
                .where(and(eq(laduCapsTable.userId, userId), eq(laduCapsTable.id, delta.key)));
              if (!row) continue;
              const newQtyInTable = row.qty + correction;
              if (newQtyInTable < 0) throw new UserError("Korkide varu läheks miinusesse");
              await tx.update(laduCapsTable).set({ qty: newQtyInTable }).where(eq(laduCapsTable.id, row.id));
            } else if (delta.kind === "custom_label_bottle") {
              const [row] = await tx.select().from(laduCustomLabelBottlesTable)
                .where(and(eq(laduCustomLabelBottlesTable.userId, userId), eq(laduCustomLabelBottlesTable.size, delta.size)));
              if (!row) continue;
              const newQtyInTable = row.qty + correction;
              if (newQtyInTable < 0) throw new UserError("Kohandatud sildiga pudelite varu läheks miinusesse");
              await tx.update(laduCustomLabelBottlesTable).set({ qty: newQtyInTable }).where(eq(laduCustomLabelBottlesTable.id, row.id));
            } else if (delta.kind === "wire_cage") {
              const [row] = await tx.select().from(laduWireCagesTable)
                .where(eq(laduWireCagesTable.userId, userId));
              if (!row) continue;
              const newQtyInTable = row.qty + correction;
              if (newQtyInTable < 0) throw new UserError("Traatkorkide varu läheks miinusesse");
              await tx.update(laduWireCagesTable).set({ qty: newQtyInTable }).where(eq(laduWireCagesTable.id, row.id));
            } else if (delta.kind === "reusable_cap") {
              const [row] = await tx.select().from(laduReusableCapsTable)
                .where(and(eq(laduReusableCapsTable.userId, userId), eq(laduReusableCapsTable.size, delta.size)));
              if (!row) continue;
              const newQtyInTable = row.qty + correction;
              if (newQtyInTable < 0) throw new UserError("Punnkorkide varu läheks miinusesse");
              await tx.update(laduReusableCapsTable).set({ qty: newQtyInTable }).where(eq(laduReusableCapsTable.id, row.id));
            } else if (delta.kind === "blank_label") {
              const [row] = await tx.select().from(laduBlankLabelsTable)
                .where(and(eq(laduBlankLabelsTable.userId, userId), eq(laduBlankLabelsTable.blankLabelTypeId, delta.blankLabelTypeId), eq(laduBlankLabelsTable.size, delta.size)));
              if (!row) continue;
              const newQtyInTable = row.qty + correction;
              if (newQtyInTable < 0) throw new UserError("Tühja sildi varu läheks miinusesse");
              await tx.update(laduBlankLabelsTable).set({ qty: newQtyInTable }).where(eq(laduBlankLabelsTable.id, row.id));
            } else if (delta.kind === "finished_goods") {
              const [row] = await tx.select().from(laduFinishedGoodsTable)
                .where(and(eq(laduFinishedGoodsTable.userId, userId), eq(laduFinishedGoodsTable.flavorId, delta.flavorId), eq(laduFinishedGoodsTable.size, delta.size)));
              if (!row) continue;
              const newQtyInTable = row.qty + correction;
              if (newQtyInTable < 0) throw new UserError("Valmistoodangu varu läheks miinusesse");
              await tx.update(laduFinishedGoodsTable).set({ qty: newQtyInTable }).where(eq(laduFinishedGoodsTable.id, row.id));
            } else if (delta.kind === "returned_bottle") {
              const [row] = await tx.select().from(laduReturnedBottlesTable)
                .where(and(eq(laduReturnedBottlesTable.userId, userId), eq(laduReturnedBottlesTable.flavorId, delta.flavorId), eq(laduReturnedBottlesTable.size, delta.size)));
              if (!row) continue;
              const newQtyInTable = row.qty + correction;
              if (newQtyInTable < 0) throw new UserError("Tagastatud pudelite varu läheks miinusesse");
              await tx.update(laduReturnedBottlesTable).set({ qty: newQtyInTable }).where(eq(laduReturnedBottlesTable.id, row.id));
            }
          }

          // Replace leading number in summary
          const newSummary = movement.summary.replace(/^\d+/, String(quantity));

          // Also update capId if provided
          let finalDeltas = updatedDeltas;
          if (capId !== undefined && capId !== null) {
            finalDeltas = finalDeltas.map((d) => (d.kind === "cap" ? { ...d, key: capId } : d));
          }

          await tx.update(laduMovementsTable)
            .set({ deltas: finalDeltas as unknown[], summary: newSummary })
            .where(eq(laduMovementsTable.id, id));
        });

        const [result] = await db.select().from(laduMovementsTable).where(eq(laduMovementsTable.id, id));
        res.json(result);
        return;
      }
    }

    // No quantity change — update capId only (existing behaviour)
    const updatedDeltas = capId !== undefined && capId !== null
      ? deltas.map((d) => (d.kind === "cap" ? { ...d, key: capId } : d))
      : deltas;
    const [updated] = await db
      .update(laduMovementsTable)
      .set({ deltas: updatedDeltas as unknown[] })
      .where(eq(laduMovementsTable.id, id))
      .returning();
    res.json(updated);
  } catch (err) {
    if (err instanceof UserError) {
      res.status(400).json({ error: err.message });
      return;
    }
    req.log.error({ err }, "Failed to update movement");
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
        } else if (delta.kind === "returned_bottle") {
          const [existing] = await tx
            .select()
            .from(laduReturnedBottlesTable)
            .where(
              and(
                eq(laduReturnedBottlesTable.userId, userId),
                eq(laduReturnedBottlesTable.flavorId, delta.flavorId),
                eq(laduReturnedBottlesTable.size, delta.size)
              )
            );
          if (existing) {
            await tx
              .update(laduReturnedBottlesTable)
              .set({ qty: existing.qty - delta.amount })
              .where(eq(laduReturnedBottlesTable.id, existing.id));
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

router.put("/ladu/bottling/:id", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = commitSchema.safeParse({ ...req.body, type: "villimine" });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", issues: parsed.error.issues });
    return;
  }
  const { summary, deltas, villimineGoods, bottlingDate } = parsed.data;
  try {
    await db.transaction(async (tx) => {
      const [movement] = await tx
        .select()
        .from(laduMovementsTable)
        .where(and(eq(laduMovementsTable.id, id), eq(laduMovementsTable.userId, userId)));
      if (!movement) throw Object.assign(new Error("Kannet ei leitud"), { code: "NOT_FOUND" });
      if (movement.type !== "villimine") throw Object.assign(new Error("Ainult villimise kannet saab täisvormi kaudu muuta"), { code: "FORBIDDEN" });

      // Reverse old deltas
      const oldDeltas = movement.deltas as StoredDelta[];
      for (const delta of oldDeltas) {
        if (delta.kind === "bottle") {
          const [row] = await tx.select().from(laduBottlesTable).where(and(eq(laduBottlesTable.userId, userId), eq(laduBottlesTable.size, delta.key)));
          if (row) await tx.update(laduBottlesTable).set({ qty: row.qty - delta.amount }).where(eq(laduBottlesTable.id, row.id));
        } else if (delta.kind === "label") {
          const [row] = await tx.select().from(laduLabelsTable).where(and(eq(laduLabelsTable.userId, userId), eq(laduLabelsTable.flavorId, delta.flavorId), eq(laduLabelsTable.size, delta.size)));
          if (row) await tx.update(laduLabelsTable).set({ qty: row.qty - delta.amount }).where(eq(laduLabelsTable.id, row.id));
        } else if (delta.kind === "cap") {
          const [row] = await tx.select().from(laduCapsTable).where(and(eq(laduCapsTable.userId, userId), eq(laduCapsTable.id, delta.key)));
          if (row) await tx.update(laduCapsTable).set({ qty: row.qty - delta.amount }).where(eq(laduCapsTable.id, row.id));
        } else if (delta.kind === "custom_label_bottle") {
          const [row] = await tx.select().from(laduCustomLabelBottlesTable).where(and(eq(laduCustomLabelBottlesTable.userId, userId), eq(laduCustomLabelBottlesTable.size, delta.size)));
          if (row) await tx.update(laduCustomLabelBottlesTable).set({ qty: row.qty - delta.amount }).where(eq(laduCustomLabelBottlesTable.id, row.id));
        } else if (delta.kind === "wire_cage") {
          const [row] = await tx.select().from(laduWireCagesTable).where(eq(laduWireCagesTable.userId, userId));
          if (row) await tx.update(laduWireCagesTable).set({ qty: row.qty - delta.amount }).where(eq(laduWireCagesTable.id, row.id));
        } else if (delta.kind === "reusable_cap") {
          const [row] = await tx.select().from(laduReusableCapsTable).where(and(eq(laduReusableCapsTable.userId, userId), eq(laduReusableCapsTable.size, delta.size)));
          if (row) await tx.update(laduReusableCapsTable).set({ qty: row.qty - delta.amount }).where(eq(laduReusableCapsTable.id, row.id));
        } else if (delta.kind === "blank_label") {
          const [row] = await tx.select().from(laduBlankLabelsTable).where(and(eq(laduBlankLabelsTable.userId, userId), eq(laduBlankLabelsTable.blankLabelTypeId, delta.blankLabelTypeId), eq(laduBlankLabelsTable.size, delta.size)));
          if (row) await tx.update(laduBlankLabelsTable).set({ qty: row.qty - delta.amount }).where(eq(laduBlankLabelsTable.id, row.id));
        } else if (delta.kind === "finished_goods") {
          const [row] = await tx.select().from(laduFinishedGoodsTable).where(and(eq(laduFinishedGoodsTable.userId, userId), eq(laduFinishedGoodsTable.flavorId, delta.flavorId), eq(laduFinishedGoodsTable.size, delta.size)));
          if (row) await tx.update(laduFinishedGoodsTable).set({ qty: row.qty - delta.amount }).where(eq(laduFinishedGoodsTable.id, row.id));
        } else if (delta.kind === "returned_bottle") {
          const [row] = await tx.select().from(laduReturnedBottlesTable).where(and(eq(laduReturnedBottlesTable.userId, userId), eq(laduReturnedBottlesTable.flavorId, delta.flavorId), eq(laduReturnedBottlesTable.size, delta.size)));
          if (row) await tx.update(laduReturnedBottlesTable).set({ qty: row.qty - delta.amount }).where(eq(laduReturnedBottlesTable.id, row.id));
        }
      }

      // Apply new deltas (same logic as POST /ladu/commit)
      const storedDeltas: StoredDelta[] = [];
      for (const delta of deltas) {
        if (delta.kind === "bottle") {
          const [existing] = await tx.select().from(laduBottlesTable).where(and(eq(laduBottlesTable.userId, userId), eq(laduBottlesTable.size, delta.key)));
          if (existing) {
            await tx.update(laduBottlesTable).set({ qty: existing.qty + delta.amount }).where(eq(laduBottlesTable.id, existing.id));
          } else {
            await tx.insert(laduBottlesTable).values({ userId, size: delta.key, qty: delta.amount });
          }
          storedDeltas.push({ kind: "bottle", key: delta.key, amount: delta.amount });
        } else if (delta.kind === "label") {
          const [existing] = await tx.select().from(laduLabelsTable).where(and(eq(laduLabelsTable.userId, userId), eq(laduLabelsTable.flavorId, delta.flavorId), eq(laduLabelsTable.size, delta.size)));
          if (existing) {
            await tx.update(laduLabelsTable).set({ qty: existing.qty + delta.amount }).where(eq(laduLabelsTable.id, existing.id));
          } else {
            await tx.insert(laduLabelsTable).values({ userId, flavorId: delta.flavorId, size: delta.size, qty: delta.amount });
          }
          storedDeltas.push({ kind: "label", flavorId: delta.flavorId, size: delta.size, amount: delta.amount });
        } else if (delta.kind === "cap") {
          if (delta.key !== 0) {
            const [existing] = await tx.select().from(laduCapsTable).where(and(eq(laduCapsTable.userId, userId), eq(laduCapsTable.id, delta.key)));
            if (existing) await tx.update(laduCapsTable).set({ qty: existing.qty + delta.amount }).where(eq(laduCapsTable.id, existing.id));
            storedDeltas.push({ kind: "cap", key: delta.key, amount: delta.amount });
          }
        } else if (delta.kind === "custom_label_bottle") {
          const [existing] = await tx.select().from(laduCustomLabelBottlesTable).where(and(eq(laduCustomLabelBottlesTable.userId, userId), eq(laduCustomLabelBottlesTable.size, delta.size)));
          if (existing) {
            await tx.update(laduCustomLabelBottlesTable).set({ qty: existing.qty + delta.amount }).where(eq(laduCustomLabelBottlesTable.id, existing.id));
          } else {
            await tx.insert(laduCustomLabelBottlesTable).values({ userId, size: delta.size, qty: delta.amount });
          }
          storedDeltas.push({ kind: "custom_label_bottle", size: delta.size, amount: delta.amount });
        } else if (delta.kind === "wire_cage") {
          const [existing] = await tx.select().from(laduWireCagesTable).where(eq(laduWireCagesTable.userId, userId));
          if (existing) {
            await tx.update(laduWireCagesTable).set({ qty: existing.qty + delta.amount }).where(eq(laduWireCagesTable.id, existing.id));
          } else {
            await tx.insert(laduWireCagesTable).values({ userId, qty: delta.amount });
          }
          storedDeltas.push({ kind: "wire_cage", amount: delta.amount });
        } else if (delta.kind === "reusable_cap") {
          const [existing] = await tx.select().from(laduReusableCapsTable).where(and(eq(laduReusableCapsTable.userId, userId), eq(laduReusableCapsTable.size, delta.size)));
          if (existing) {
            await tx.update(laduReusableCapsTable).set({ qty: existing.qty + delta.amount }).where(eq(laduReusableCapsTable.id, existing.id));
          } else {
            await tx.insert(laduReusableCapsTable).values({ userId, size: delta.size, qty: delta.amount });
          }
          storedDeltas.push({ kind: "reusable_cap", size: delta.size, amount: delta.amount });
        } else if (delta.kind === "blank_label") {
          const resolvedTypeId = delta.blankLabelTypeId === 0 ? await resolveDefaultBlankLabelType(tx, userId) : delta.blankLabelTypeId;
          const [existing] = await tx.select().from(laduBlankLabelsTable).where(and(eq(laduBlankLabelsTable.userId, userId), eq(laduBlankLabelsTable.blankLabelTypeId, resolvedTypeId), eq(laduBlankLabelsTable.size, delta.size)));
          if (existing) {
            await tx.update(laduBlankLabelsTable).set({ qty: existing.qty + delta.amount }).where(eq(laduBlankLabelsTable.id, existing.id));
          } else {
            await tx.insert(laduBlankLabelsTable).values({ userId, blankLabelTypeId: resolvedTypeId, size: delta.size, qty: delta.amount });
          }
          storedDeltas.push({ kind: "blank_label", blankLabelTypeId: resolvedTypeId, size: delta.size, amount: delta.amount });
        } else if (delta.kind === "finished_goods") {
          const [existing] = await tx.select().from(laduFinishedGoodsTable).where(and(eq(laduFinishedGoodsTable.userId, userId), eq(laduFinishedGoodsTable.flavorId, delta.flavorId), eq(laduFinishedGoodsTable.size, delta.size)));
          const currentQty = existing?.qty ?? 0;
          if (currentQty + delta.amount < 0) {
            const err = new Error(`Laos pole piisavalt valmistoodangut — laos ${currentQty}, sooviti ${-delta.amount}`);
            (err as any).code = "INSUFFICIENT_STOCK";
            throw err;
          }
          if (existing) {
            await tx.update(laduFinishedGoodsTable).set({ qty: currentQty + delta.amount }).where(eq(laduFinishedGoodsTable.id, existing.id));
          } else {
            await tx.insert(laduFinishedGoodsTable).values({ userId, flavorId: delta.flavorId, size: delta.size, qty: delta.amount });
          }
          storedDeltas.push({ kind: "finished_goods", flavorId: delta.flavorId, size: delta.size, amount: delta.amount });
        } else if (delta.kind === "returned_bottle") {
          const [existing] = await tx.select().from(laduReturnedBottlesTable).where(and(eq(laduReturnedBottlesTable.userId, userId), eq(laduReturnedBottlesTable.flavorId, delta.flavorId), eq(laduReturnedBottlesTable.size, delta.size)));
          const currentQty = existing?.qty ?? 0;
          if (currentQty + delta.amount < 0) {
            const err = new Error(`Tagastatud pudeleid pole piisavalt — laos ${currentQty}, sooviti ${-delta.amount}`);
            (err as any).code = "INSUFFICIENT_STOCK";
            throw err;
          }
          if (existing) {
            await tx.update(laduReturnedBottlesTable).set({ qty: currentQty + delta.amount }).where(eq(laduReturnedBottlesTable.id, existing.id));
          } else {
            await tx.insert(laduReturnedBottlesTable).values({ userId, flavorId: delta.flavorId, size: delta.size, qty: delta.amount });
          }
          storedDeltas.push({ kind: "returned_bottle", flavorId: delta.flavorId, size: delta.size, amount: delta.amount });
        }
      }

      if (villimineGoods) {
        const { flavorId: vFlavorId, size: vSize, amount: vAmount } = villimineGoods;
        const [vExisting] = await tx.select().from(laduFinishedGoodsTable).where(and(eq(laduFinishedGoodsTable.userId, userId), eq(laduFinishedGoodsTable.flavorId, vFlavorId), eq(laduFinishedGoodsTable.size, vSize)));
        if (vExisting) {
          await tx.update(laduFinishedGoodsTable).set({ qty: vExisting.qty + vAmount }).where(eq(laduFinishedGoodsTable.id, vExisting.id));
        } else {
          await tx.insert(laduFinishedGoodsTable).values({ userId, flavorId: vFlavorId, size: vSize, qty: vAmount });
        }
        storedDeltas.push({ kind: "finished_goods", flavorId: vFlavorId, size: vSize, amount: vAmount });
        if (villimineGoods.flavoringEventId != null) {
          storedDeltas.push({ kind: "trace", flavoringEventId: villimineGoods.flavoringEventId });
          const eventUpdate: { savedStarterG?: number; bottlingDate?: string } = {};
          if (villimineGoods.savedStarterG != null) eventUpdate.savedStarterG = villimineGoods.savedStarterG;
          if (bottlingDate) eventUpdate.bottlingDate = bottlingDate;
          if (Object.keys(eventUpdate).length > 0) {
            await tx.update(flavoringEventTable).set(eventUpdate).where(and(eq(flavoringEventTable.id, villimineGoods.flavoringEventId), eq(flavoringEventTable.userId, userId)));
          }
        }
      }

      const movementCreatedAt = bottlingDate ? new Date(bottlingDate) : undefined;
      await tx.update(laduMovementsTable)
        .set({ summary, deltas: storedDeltas as unknown[], ...(movementCreatedAt ? { createdAt: movementCreatedAt } : {}) })
        .where(eq(laduMovementsTable.id, id));
    });
    res.json(await fetchAll(userId));
  } catch (err) {
    if ((err as any).code === "NOT_FOUND") { res.status(404).json({ error: (err as Error).message }); return; }
    if ((err as any).code === "FORBIDDEN") { res.status(403).json({ error: (err as Error).message }); return; }
    if ((err as any).code === "INSUFFICIENT_STOCK") { res.status(409).json({ error: (err as Error).message }); return; }
    req.log.error({ err }, "Failed to edit bottling movement");
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
      res.status(409).json({ error: "Maitsele on laos silte — tühjenda varu enne kustutamist" });
      return;
    }
    const finishedGoodsRows = await db
      .select()
      .from(laduFinishedGoodsTable)
      .where(and(eq(laduFinishedGoodsTable.userId, userId), eq(laduFinishedGoodsTable.flavorId, id), gt(laduFinishedGoodsTable.qty, 0)));
    if (finishedGoodsRows.length > 0) {
      res.status(409).json({ error: "Maitsele on laos valmistoodangut — tühjenda varu enne kustutamist" });
      return;
    }
    const returnedBottleRows = await db
      .select()
      .from(laduReturnedBottlesTable)
      .where(and(eq(laduReturnedBottlesTable.userId, userId), eq(laduReturnedBottlesTable.flavorId, id), gt(laduReturnedBottlesTable.qty, 0)));
    if (returnedBottleRows.length > 0) {
      res.status(409).json({ error: "Maitsele on laos tagasi tulnud pudeleid — tühjenda varu enne kustutamist" });
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
  minStock: z.number().min(0).nullable().optional(),
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
      .values({ userId, name: parsed.data.name.trim(), unit: parsed.data.unit.trim(), qty: 0, minStock: parsed.data.minStock ?? null })
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
      .set({ name: parsed.data.name.trim(), unit: parsed.data.unit.trim(), minStock: parsed.data.minStock ?? null })
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
      await tx.delete(laduReturnedBottlesTable).where(eq(laduReturnedBottlesTable.userId, userId));
    });
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Failed to reset ladu");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
