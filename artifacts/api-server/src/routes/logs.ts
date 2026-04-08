import { Router } from "express";
import { db } from "@workspace/db";
import { batchesTable, logsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";
import { openai } from "@workspace/integrations-openai-ai-server";

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
        {
          role: "user",
          content: parts.join(" "),
        },
      ],
    });

    return response.choices[0]?.message?.content ?? "";
  } catch {
    return "";
  }
}

router.get("/batches/:batchId/logs", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const batchId = parseInt(String(req.params.batchId));

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
  const batchId = parseInt(String(req.params.batchId));
  const { dayNumber, temperature, scobylook, smell, color, notes, loggedAt } = req.body;

  if (dayNumber === undefined) {
    res.status(400).json({ error: "dayNumber is required" });
    return;
  }

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
  const batchId = parseInt(String(req.params.batchId));
  const logId = parseInt(String(req.params.logId));

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

export default router;
