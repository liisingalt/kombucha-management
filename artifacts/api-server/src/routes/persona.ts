import { Router } from "express";
import { db } from "@workspace/db";
import { personaMaterialsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import type { Request, Response, NextFunction } from "express";
import {
  PersonaChatBody,
  CreatePersonaMaterialBody,
  DeletePersonaMaterialParams,
} from "@workspace/api-zod";

const router = Router();

const PERSONA_ADMIN_SECRET = process.env.PERSONA_ADMIN_SECRET ?? "";

function requireAdminKey(req: Request, res: Response, next: NextFunction): void {
  const key = req.headers["x-admin-key"] as string | undefined;
  if (!PERSONA_ADMIN_SECRET) {
    res.status(500).json({ error: "Admin secret not configured" });
    return;
  }
  if (!key || key !== PERSONA_ADMIN_SECRET) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

router.get("/persona/materials", requireAdminKey, async (req, res) => {
  try {
    const materials = await db.query.personaMaterialsTable.findMany({
      orderBy: [desc(personaMaterialsTable.createdAt)],
    });
    res.json(materials);
  } catch (err) {
    req.log.error({ err }, "Failed to list persona materials");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/persona/materials", requireAdminKey, async (req, res) => {
  const parsed = CreatePersonaMaterialBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "title and content are required", details: parsed.error.flatten() });
    return;
  }

  const { title, content } = parsed.data;

  try {
    const [material] = await db
      .insert(personaMaterialsTable)
      .values({ title, content })
      .returning();
    res.status(201).json(material);
  } catch (err) {
    req.log.error({ err }, "Failed to create persona material");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/persona/materials/:id", requireAdminKey, async (req, res) => {
  const parsed = DeletePersonaMaterialParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const id = parsed.data.id;

  try {
    const deleted = await db
      .delete(personaMaterialsTable)
      .where(eq(personaMaterialsTable.id, id))
      .returning();

    if (deleted.length === 0) {
      res.status(404).json({ error: "Material not found" });
      return;
    }

    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Failed to delete persona material");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/persona/chat", async (req, res) => {
  const parsed = PersonaChatBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "message is required", details: parsed.error.flatten() });
    return;
  }

  const { message, history } = parsed.data;

  try {
    const materials = await db.query.personaMaterialsTable.findMany({
      orderBy: [desc(personaMaterialsTable.createdAt)],
    });

    const MAX_CONTEXT_CHARS = 12000;
    let contextText = "";
    for (const mat of materials) {
      const snippet = `--- ${mat.title} ---\n${mat.content}\n\n`;
      if (contextText.length + snippet.length > MAX_CONTEXT_CHARS) break;
      contextText += snippet;
    }

    const systemPrompt = contextText
      ? `You are a digital persona — an AI that speaks, thinks, and responds exactly as the person whose writings and ideas are provided below. When you answer, draw directly from these materials to reflect their authentic voice, worldview, and style. Do not break character. If you don't have information on a topic from the materials, answer in a way that feels consistent with their overall voice and perspective.

Here are the owner's personal writings, Q&As, and ideas:

${contextText}`
      : "You are a helpful AI assistant. Answer questions thoughtfully and honestly.";

    const conversationMessages = (history ?? []).slice(-8).map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    }));

    const response = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 600,
      messages: [
        { role: "system", content: systemPrompt },
        ...conversationMessages,
        { role: "user", content: message },
      ],
    });

    const reply = response.choices[0]?.message?.content ?? "I'm unable to respond right now.";
    res.json({ reply });
  } catch (err) {
    req.log.error({ err }, "Failed to run persona chat");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
