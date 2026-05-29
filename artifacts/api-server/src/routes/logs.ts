import { Router } from "express";
import { db } from "@workspace/db";
import { logsTable, photosTable, fermentationBatchTable } from "@workspace/db";
import { eq, and, desc, gte, lte } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";
import { openai } from "@workspace/integrations-openai-ai-server";
import { ObjectStorageService } from "../lib/objectStorage";
import { getObjectAclPolicy } from "../lib/objectAcl";

const router = Router();
const storageService = new ObjectStorageService();

async function getBatchForUser(batchId: number, userId: string) {
  return db.query.fermentationBatchTable.findFirst({
    where: and(
      eq(fermentationBatchTable.id, batchId),
      eq(fermentationBatchTable.userId, userId),
    ),
  });
}

function computeLogDate(startDate: string, dayNumber: number): string {
  const d = new Date(startDate);
  d.setUTCDate(d.getUTCDate() + (dayNumber - 1));
  return d.toISOString().slice(0, 10);
}

async function getProximityPhoto(
  userId: string,
  batchId: number,
  logDate: string,
) {
  // Prefer a photo taken on the same calendar day as the log entry
  const sameDay = await db.query.photosTable.findFirst({
    where: and(
      eq(photosTable.userId, userId),
      eq(photosTable.phase, "fermentation"),
      eq(photosTable.stageRefId, batchId),
      eq(photosTable.photoDate, logDate),
    ),
    orderBy: [desc(photosTable.createdAt)],
  });
  if (sameDay) return sameDay;

  // Fall back to the most recent batch photo within ±1 day
  const dayBefore = new Date(logDate);
  dayBefore.setUTCDate(dayBefore.getUTCDate() - 1);
  const dayAfter = new Date(logDate);
  dayAfter.setUTCDate(dayAfter.getUTCDate() + 1);
  const nearby = await db.query.photosTable.findFirst({
    where: and(
      eq(photosTable.userId, userId),
      eq(photosTable.phase, "fermentation"),
      eq(photosTable.stageRefId, batchId),
      gte(photosTable.photoDate, dayBefore.toISOString().slice(0, 10)),
      lte(photosTable.photoDate, dayAfter.toISOString().slice(0, 10)),
    ),
    orderBy: [desc(photosTable.createdAt)],
  });
  if (nearby) return nearby;

  // Final fallback: any photo for this batch
  return db.query.photosTable.findFirst({
    where: and(
      eq(photosTable.userId, userId),
      eq(photosTable.phase, "fermentation"),
      eq(photosTable.stageRefId, batchId),
    ),
    orderBy: [desc(photosTable.createdAt)],
  });
}

async function generateAiTip(
  logFields: {
    dayNumber: number | null;
    temperature: number | null;
    ph: number | null;
    smell: string | null;
    color: string | null;
    taste: string[] | null;
    carbonation: string | null;
    notes: string | null;
    scobylook: string | null;
  },
  photoObjectPath: string | null,
  userId: string,
): Promise<string | null> {
  try {
    const parts: string[] = [];
    if (logFields.dayNumber != null) parts.push(`Käärimispäev: ${logFields.dayNumber}`);
    if (logFields.temperature != null) parts.push(`Temperatuur: ${logFields.temperature}°C`);
    if (logFields.ph != null) parts.push(`pH: ${logFields.ph}`);
    if (logFields.smell) parts.push(`Lõhn: ${logFields.smell}`);
    if (logFields.color) parts.push(`Värvus: ${logFields.color}`);
    if (logFields.taste && logFields.taste.length > 0) parts.push(`Maitse: ${logFields.taste.join(", ")}`);
    if (logFields.carbonation) parts.push(`Karbonisatsioon: ${logFields.carbonation}`);
    if (logFields.scobylook) parts.push(`SCOBY välimus: ${logFields.scobylook}`);
    if (logFields.notes) parts.push(`Märkmed: ${logFields.notes}`);

    if (parts.length === 0) return null;

    const observationText = parts.join(". ");

    const systemPrompt =
      "Sa oled kogenud kombucha ekspert. Sinu ülesanne on vaadata üle käärimise päeviku kanne ja anda lühike, praktiline nõuanne (2–4 lauset) eesti keeles. Ole konkreetne ja keskendu sellele, mida numbrid ja vaatlused tegelikult näitavad — mis läheb hästi, mis vajab tähelepanu ja mida peaks edasi tegema. Ära ole üldine.";

    const userContent: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
      { type: "text", text: `Kombucha käärimise vaatlused: ${observationText}` },
    ];

    if (photoObjectPath) {
      try {
        const objectFile = await storageService.getObjectEntityFile(photoObjectPath);
        // Enforce ACL ownership — same guard as /ai/analyze-photo
        const aclPolicy = await getObjectAclPolicy(objectFile);
        if (aclPolicy && aclPolicy.owner !== userId) {
          // Photo does not belong to the requesting user — skip it silently
        } else {
          const downloadResponse = await storageService.downloadObject(objectFile);
          const buffer = Buffer.from(await downloadResponse.arrayBuffer());
          const base64 = buffer.toString("base64");
          const mimeType = downloadResponse.headers.get("content-type") || "image/jpeg";
          userContent.unshift({
            type: "image_url",
            image_url: { url: `data:${mimeType};base64,${base64}` },
          });
        }
      } catch {
        // Photo download failed — continue with text only
      }
    }

    const response = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 250,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent as Parameters<typeof openai.chat.completions.create>[0]["messages"][0]["content"] },
      ],
    });

    return response.choices[0]?.message?.content ?? null;
  } catch {
    return null;
  }
}

router.get("/fermentations/:batchId/logs", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const batchId = parseInt(req.params.batchId, 10);
  if (isNaN(batchId)) {
    res.status(400).json({ error: "Invalid batchId" });
    return;
  }
  try {
    const batch = await getBatchForUser(batchId, userId);
    if (!batch) {
      res.status(404).json({ error: "Batch not found" });
      return;
    }

    const rows = await db
      .select()
      .from(logsTable)
      .where(eq(logsTable.batchId, batchId))
      .orderBy(desc(logsTable.dayNumber));
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch logs");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/fermentations/:batchId/logs", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const batchId = parseInt(req.params.batchId, 10);
  if (isNaN(batchId)) {
    res.status(400).json({ error: "Invalid batchId" });
    return;
  }

  const b = req.body as {
    dayNumber?: number;
    temperature?: number | null;
    ph?: number | null;
    smell?: string | null;
    color?: string | null;
    taste?: string[] | null;
    carbonation?: string | null;
    notes?: string | null;
    scobylook?: string | null;
    activities?: string[] | null;
    flavourAdditions?: string[] | null;
  };

  try {
    const batch = await getBatchForUser(batchId, userId);
    if (!batch) {
      res.status(404).json({ error: "Batch not found" });
      return;
    }

    const [inserted] = await db
      .insert(logsTable)
      .values({
        batchId,
        dayNumber: b.dayNumber ?? 1,
        temperature: b.temperature ?? null,
        ph: b.ph ?? null,
        smell: b.smell ?? null,
        color: b.color ?? null,
        taste: b.taste ?? null,
        carbonation: b.carbonation ?? null,
        notes: b.notes ?? null,
        scobylook: b.scobylook ?? null,
        activities: b.activities ?? null,
        flavourAdditions: b.flavourAdditions ?? null,
      })
      .returning();

    const logDate = computeLogDate(batch.startDate, inserted.dayNumber);
    const proximityPhoto = await getProximityPhoto(userId, batchId, logDate);

    const tip = await generateAiTip(
      {
        dayNumber: inserted.dayNumber,
        temperature: inserted.temperature ?? null,
        ph: inserted.ph ?? null,
        smell: inserted.smell ?? null,
        color: inserted.color ?? null,
        taste: inserted.taste ?? null,
        carbonation: inserted.carbonation ?? null,
        notes: inserted.notes ?? null,
        scobylook: inserted.scobylook ?? null,
      },
      proximityPhoto?.objectPath ?? null,
      userId,
    );

    if (tip) {
      await db.update(logsTable).set({ aiTip: tip }).where(eq(logsTable.id, inserted.id));
      inserted.aiTip = tip;
    }

    res.status(201).json(inserted);
  } catch (err) {
    req.log.error({ err }, "Failed to create log");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/fermentations/:batchId/logs/:logId", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const batchId = parseInt(req.params.batchId, 10);
  const logId = parseInt(req.params.logId, 10);
  if (isNaN(batchId) || isNaN(logId)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const b = req.body as {
    dayNumber?: number;
    temperature?: number | null;
    ph?: number | null;
    smell?: string | null;
    color?: string | null;
    taste?: string[] | null;
    carbonation?: string | null;
    notes?: string | null;
    scobylook?: string | null;
    activities?: string[] | null;
    flavourAdditions?: string[] | null;
  };

  const observationFields = ["dayNumber", "temperature", "ph", "smell", "color", "taste", "carbonation", "notes", "scobylook"];
  const observationsChanged = observationFields.some((f) => f in b);

  try {
    const batch = await getBatchForUser(batchId, userId);
    if (!batch) {
      res.status(404).json({ error: "Batch not found" });
      return;
    }

    const set: Record<string, unknown> = {};
    if (b.dayNumber !== undefined) set.dayNumber = b.dayNumber;
    if (b.temperature !== undefined) set.temperature = b.temperature;
    if (b.ph !== undefined) set.ph = b.ph;
    if (b.smell !== undefined) set.smell = b.smell;
    if (b.color !== undefined) set.color = b.color;
    if (b.taste !== undefined) set.taste = b.taste;
    if (b.carbonation !== undefined) set.carbonation = b.carbonation;
    if (b.notes !== undefined) set.notes = b.notes;
    if (b.scobylook !== undefined) set.scobylook = b.scobylook;
    if (b.activities !== undefined) set.activities = b.activities;
    if (b.flavourAdditions !== undefined) set.flavourAdditions = b.flavourAdditions;

    if (Object.keys(set).length === 0) {
      res.status(400).json({ error: "No fields to update" });
      return;
    }

    const [updated] = await db
      .update(logsTable)
      .set(set)
      .where(and(eq(logsTable.id, logId), eq(logsTable.batchId, batchId)))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Log not found" });
      return;
    }

    if (observationsChanged) {
      const logDate = computeLogDate(batch.startDate, updated.dayNumber);
      const proximityPhoto = await getProximityPhoto(userId, batchId, logDate);

      const tip = await generateAiTip(
        {
          dayNumber: updated.dayNumber,
          temperature: updated.temperature ?? null,
          ph: updated.ph ?? null,
          smell: updated.smell ?? null,
          color: updated.color ?? null,
          taste: updated.taste ?? null,
          carbonation: updated.carbonation ?? null,
          notes: updated.notes ?? null,
          scobylook: updated.scobylook ?? null,
        },
        proximityPhoto?.objectPath ?? null,
        userId,
      );

      if (tip) {
        await db.update(logsTable).set({ aiTip: tip }).where(eq(logsTable.id, logId));
        updated.aiTip = tip;
      }
    }

    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update log");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/fermentations/:batchId/logs/:logId", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const batchId = parseInt(req.params.batchId, 10);
  const logId = parseInt(req.params.logId, 10);
  if (isNaN(batchId) || isNaN(logId)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  try {
    const batch = await getBatchForUser(batchId, userId);
    if (!batch) {
      res.status(404).json({ error: "Batch not found" });
      return;
    }

    await db
      .delete(logsTable)
      .where(and(eq(logsTable.id, logId), eq(logsTable.batchId, batchId)));
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Failed to delete log");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
