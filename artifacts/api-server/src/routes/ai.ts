import { Router } from "express";
import { db } from "@workspace/db";
import { batchesTable, logsTable, chatMessagesTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";
import { openai } from "@workspace/integrations-openai-ai-server";
import { textToSpeech } from "@workspace/integrations-openai-ai-server/audio";

import { ObjectStorageService } from "../lib/objectStorage";

const router = Router();
const storageService = new ObjectStorageService();

router.post("/ai/analyze-photo", requireAuth, async (req, res) => {
  const { objectPath } = req.body;
  if (!objectPath) {
    res.status(400).json({ error: "objectPath is required" });
    return;
  }

  try {
    const file = await storageService.getObjectEntityFile(objectPath);
    const downloadResponse = await storageService.downloadObject(file);
    const buffer = Buffer.from(await downloadResponse.arrayBuffer());
    const base64 = buffer.toString("base64");
    const mimeType = downloadResponse.headers.get("content-type") || "image/jpeg";

    const response = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 300,
      messages: [
        {
          role: "system",
          content:
            "You are a kombucha expert analyzing a photo of a SCOBY or fermentation vessel. Provide specific, helpful feedback about what you observe — the SCOBY's health, color, texture, any signs of concern, and what the brewer should do next. Be direct and practical. 2-3 sentences max.",
        },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${base64}` },
            },
            {
              type: "text",
              text: "Please analyze this kombucha SCOBY or fermentation vessel photo.",
            },
          ],
        },
      ],
    });

    const analysis = response.choices[0]?.message?.content ?? "Unable to analyze the photo.";
    res.json({ analysis });
  } catch (err) {
    req.log.error({ err }, "Failed to analyze photo");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/ai/onboarding-advice", requireAuth, async (req, res) => {
  const { hasMadeBefore, hasScoby, currentStage, experienceLevel } = req.body;

  try {
    const parts: string[] = [];
    if (hasMadeBefore) {
      parts.push("I have made kombucha before.");
    } else {
      parts.push("I am new to making kombucha.");
    }
    if (hasScoby) {
      parts.push("I already have a SCOBY.");
    } else {
      parts.push("I do not have a SCOBY yet.");
    }
    if (currentStage) parts.push(`I am currently at stage: ${currentStage}.`);
    if (experienceLevel) parts.push(`My experience level: ${experienceLevel}.`);

    const response = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 400,
      messages: [
        {
          role: "system",
          content:
            "You are a warm and knowledgeable kombucha mentor. Based on the user's profile, give them a personalized welcome guide — practical first steps, what to watch for, and encouragement. Keep it friendly, 3-4 sentences. Do not be generic.",
        },
        {
          role: "user",
          content: parts.join(" "),
        },
      ],
    });

    const advice = response.choices[0]?.message?.content ?? "";
    res.json({ advice });
  } catch (err) {
    req.log.error({ err }, "Failed to get onboarding advice");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/ai/chat", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const { message } = req.body;

  if (!message) {
    res.status(400).json({ error: "message is required" });
    return;
  }

  try {
    const activeBatches = await db.query.batchesTable.findMany({
      where: and(eq(batchesTable.userId, userId), eq(batchesTable.status, "active")),
      orderBy: [desc(batchesTable.createdAt)],
      limit: 3,
    });

    const recentBatch = activeBatches[0];
    const recentLogs = recentBatch
      ? await db.query.logsTable.findMany({
          where: eq(logsTable.batchId, recentBatch.id),
          orderBy: [desc(logsTable.loggedAt)],
          limit: 5,
        })
      : [];

    const previousMessages = await db.query.chatMessagesTable.findMany({
      where: eq(chatMessagesTable.userId, userId),
      orderBy: [desc(chatMessagesTable.createdAt)],
      limit: 10,
    });

    const contextParts: string[] = [];
    if (activeBatches.length > 0) {
      contextParts.push(`Active batches: ${activeBatches.map(b => `"${b.name}" (started ${b.startedAt.toLocaleDateString()})`).join(", ")}.`);
    }
    if (recentLogs.length > 0) {
      const logSummary = recentLogs.slice(0, 3).map(l =>
        `Day ${l.dayNumber}: temp ${l.temperature ?? "?"}°C, smell: ${l.smell ?? "?"}`
      ).join("; ");
      contextParts.push(`Recent logs: ${logSummary}.`);
    }

    const systemContent = `You are a knowledgeable, friendly kombucha expert and brewing mentor. Help the user with their kombucha questions. Be practical, specific, and encouraging.${contextParts.length > 0 ? `\n\nUser's brewing context: ${contextParts.join(" ")}` : ""}`;

    const conversationMessages = previousMessages
      .reverse()
      .slice(-8)
      .map(m => ({ role: m.role as "user" | "assistant", content: m.content }));

    const response = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 500,
      messages: [
        { role: "system", content: systemContent },
        ...conversationMessages,
        { role: "user", content: message },
      ],
    });

    const reply = response.choices[0]?.message?.content ?? "I am unable to respond right now.";

    await db.insert(chatMessagesTable).values([
      { userId, role: "user", content: message },
      { userId, role: "assistant", content: reply },
    ]);

    res.json({ reply });
  } catch (err) {
    req.log.error({ err }, "Failed to chat with advisor");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/ai/chat/history", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;

  try {
    const messages = await db.query.chatMessagesTable.findMany({
      where: eq(chatMessagesTable.userId, userId),
      orderBy: [desc(chatMessagesTable.createdAt)],
      limit: 50,
    });

    res.json(messages.reverse());
  } catch (err) {
    req.log.error({ err }, "Failed to get chat history");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/ai/tts", requireAuth, async (req, res) => {
  const { text } = req.body;
  if (!text) {
    res.status(400).json({ error: "text is required" });
    return;
  }

  try {
    const audioBuffer = await textToSpeech(text, "nova", "mp3");
    const base64Audio = audioBuffer.toString("base64");
    res.json({ audio: base64Audio, format: "mp3" });
  } catch (err) {
    req.log.error({ err }, "Failed to generate TTS");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/ai/flavoring-guide", requireAuth, async (req, res) => {
  const preference = req.query.preference as string | undefined;

  try {
    const prefText = preference ? `The user prefers ${preference} flavors.` : "The user has no specific flavor preference.";

    const response = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 600,
      messages: [
        {
          role: "system",
          content:
            "You are a kombucha flavor expert. Return a JSON object with exactly this structure: { \"suggestions\": [{\"name\": string, \"ingredients\": string, \"tip\": string}], \"generalTips\": string }. Provide 4 flavoring suggestions for second fermentation (F2). Each should have a name, brief ingredients list, and a practical tip. generalTips is 1-2 sentences of general F2 advice.",
        },
        {
          role: "user",
          content: `Give me kombucha second fermentation flavoring suggestions. ${prefText}`,
        },
      ],
    });

    const content = response.choices[0]?.message?.content ?? "{}";
    try {
      const parsed = JSON.parse(content);
      res.json(parsed);
    } catch {
      res.json({
        suggestions: [
          { name: "Ginger Lemon", ingredients: "Fresh ginger slices, lemon juice", tip: "Use 1-2 tsp ginger per 500ml for a spicy kick." },
          { name: "Berry Burst", ingredients: "Mixed berries (fresh or frozen)", tip: "2-3 tbsp of berries per bottle creates a fruity, carbonated brew." },
          { name: "Mango Turmeric", ingredients: "Mango chunks, pinch of turmeric", tip: "Adds a tropical sweetness with anti-inflammatory benefits." },
          { name: "Hibiscus Rose", ingredients: "Dried hibiscus flowers, rose petals", tip: "1 tsp per bottle for a floral, ruby-red F2." },
        ],
        generalTips: "Bottle at room temperature for 2-3 days to build carbonation, then refrigerate. Burp bottles daily to prevent over-carbonation.",
      });
    }
  } catch (err) {
    req.log.error({ err }, "Failed to get flavoring guide");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
