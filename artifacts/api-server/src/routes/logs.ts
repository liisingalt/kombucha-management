import { Router } from "express";
import { db } from "@workspace/db";
import { batchesTable, logsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";
import { openai } from "@workspace/integrations-openai-ai-server";
import {
  ListLogsParams,
  CreateLogParams,
  CreateLogBody,
  GetLogParams,
  UpdateLogParams,
  UpdateLogBody,
  DeleteLogParams,
} from "@workspace/api-zod";

const router = Router({ mergeParams: true });

async function generateLogTip(log: {
  temperature?: number | null;
  smell?: string | null;
  scobylook?: string | null;
  dayNumber: number;
}): Promise<string> {
  try {
    const parts: string[] = [`Day ${log.dayNumber} of fermentation.`];
    if (log.temperature != null) parts.push(`Temperature: ${log.temperature}°C.`);
    if (log.smell) parts.push(`Smell: ${log.smell}.`);
    if (log.scobylook) parts.push(`SCOBY appearance: ${log.scobylook}.`);

    const response = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 150,
      messages: [
        {
          role: "system",
          content:
            "You are a helpful kombucha expert. Give a short, practical tip (1-2 sentences) based on the user's daily fermentation log. Be direct and actionable. Do not greet or be verbose.",
        },
        { role: "user", content: parts.join(" ") },
      ],
    });

    return response.choices[0]?.message?.content ?? "";
  } catch {
    return "";
  }
}

router.get("/batches/:batchId/logs", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const paramsParsed = ListLogsParams.safeParse({ batchId: Number(req.params.batchId) });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid batchId" });
    return;
  }
  const { batchId } = paramsParsed.data;

  try {
    const batch = await db.query.batchesTable.findFirst({
      where: and(eq(batchesTable.id, batchId), eq(batchesTable.userId, userId)),
    });

    if (!batch) {
      res.status(404).json({ error: "Batch not found" });
      return;
    }

    const logs = await db.query.logsTable.findMany({
      where: eq(logsTable.batchId, batchId),
      orderBy: [desc(logsTable.loggedAt)],
    });

    res.json(logs);
  } catch (err) {
    req.log.error({ err }, "Failed to list logs");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/batches/:batchId/logs", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const paramsParsed = CreateLogParams.safeParse({ batchId: Number(req.params.batchId) });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid batchId" });
    return;
  }
  const { batchId } = paramsParsed.data;

  const bodyParsed = CreateLogBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: "Invalid request body", details: bodyParsed.error.flatten() });
    return;
  }
  const { dayNumber, temperature, scobylook, smell, color, notes, loggedAt } = bodyParsed.data;

  try {
    const batch = await db.query.batchesTable.findFirst({
      where: and(eq(batchesTable.id, batchId), eq(batchesTable.userId, userId)),
    });

    if (!batch) {
      res.status(404).json({ error: "Batch not found" });
      return;
    }

    const aiTip = await generateLogTip({ temperature, smell, scobylook, dayNumber });

    const [log] = await db.insert(logsTable).values({
      batchId,
      dayNumber,
      temperature: temperature ?? null,
      scobylook: scobylook ?? null,
      smell: smell ?? null,
      color: color ?? null,
      notes: notes ?? null,
      aiTip: aiTip || null,
      loggedAt: loggedAt ? new Date(loggedAt) : new Date(),
    }).returning();

    res.status(201).json(log);
  } catch (err) {
    req.log.error({ err }, "Failed to create log");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/batches/:batchId/logs/:logId", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const paramsParsed = GetLogParams.safeParse({
    batchId: Number(req.params.batchId),
    logId: Number(req.params.logId),
  });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid params" });
    return;
  }
  const { batchId, logId } = paramsParsed.data;

  try {
    const batch = await db.query.batchesTable.findFirst({
      where: and(eq(batchesTable.id, batchId), eq(batchesTable.userId, userId)),
    });

    if (!batch) {
      res.status(404).json({ error: "Batch not found" });
      return;
    }

    const log = await db.query.logsTable.findFirst({
      where: and(eq(logsTable.id, logId), eq(logsTable.batchId, batchId)),
    });

    if (!log) {
      res.status(404).json({ error: "Log not found" });
      return;
    }

    res.json(log);
  } catch (err) {
    req.log.error({ err }, "Failed to get log");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/batches/:batchId/logs/:logId", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const paramsParsed = UpdateLogParams.safeParse({
    batchId: Number(req.params.batchId),
    logId: Number(req.params.logId),
  });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid params" });
    return;
  }
  const bodyParsed = UpdateLogBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: "Invalid body", details: bodyParsed.error.flatten() });
    return;
  }
  const { batchId, logId } = paramsParsed.data;
  const { dayNumber, temperature, scobylook, smell, color, notes, loggedAt } = bodyParsed.data;

  try {
    const batch = await db.query.batchesTable.findFirst({
      where: and(eq(batchesTable.id, batchId), eq(batchesTable.userId, userId)),
    });

    if (!batch) {
      res.status(404).json({ error: "Batch not found" });
      return;
    }

    const existing = await db.query.logsTable.findFirst({
      where: and(eq(logsTable.id, logId), eq(logsTable.batchId, batchId)),
    });

    if (!existing) {
      res.status(404).json({ error: "Log not found" });
      return;
    }

    const updateValues: Record<string, unknown> = {};
    if (dayNumber !== undefined) updateValues.dayNumber = dayNumber;
    if (temperature !== undefined) updateValues.temperature = temperature;
    if (scobylook !== undefined) updateValues.scobylook = scobylook;
    if (smell !== undefined) updateValues.smell = smell;
    if (color !== undefined) updateValues.color = color;
    if (notes !== undefined) updateValues.notes = notes;
    if (loggedAt !== undefined) updateValues.loggedAt = new Date(loggedAt);

    const [updated] = await db
      .update(logsTable)
      .set(updateValues)
      .where(and(eq(logsTable.id, logId), eq(logsTable.batchId, batchId)))
      .returning();

    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update log");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/batches/:batchId/logs/:logId", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const paramsParsed = DeleteLogParams.safeParse({
    batchId: Number(req.params.batchId),
    logId: Number(req.params.logId),
  });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid params" });
    return;
  }
  const { batchId, logId } = paramsParsed.data;

  try {
    const batch = await db.query.batchesTable.findFirst({
      where: and(eq(batchesTable.id, batchId), eq(batchesTable.userId, userId)),
    });

    if (!batch) {
      res.status(404).json({ error: "Batch not found" });
      return;
    }

    const existing = await db.query.logsTable.findFirst({
      where: and(eq(logsTable.id, logId), eq(logsTable.batchId, batchId)),
    });

    if (!existing) {
      res.status(404).json({ error: "Log not found" });
      return;
    }

    await db.delete(logsTable).where(and(eq(logsTable.id, logId), eq(logsTable.batchId, batchId)));

    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete log");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
