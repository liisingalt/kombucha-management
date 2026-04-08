import { Router } from "express";
import { db } from "@workspace/db";
import { batchesTable, photosTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";
import { ObjectStorageService } from "../lib/objectStorage";
import { setObjectAclPolicy } from "../lib/objectAcl";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router({ mergeParams: true });
const storageService = new ObjectStorageService();

async function analyzePhoto(objectPath: string): Promise<string | null> {
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
            { type: "text", text: "Please analyze this kombucha SCOBY or fermentation vessel photo." },
          ],
        },
      ],
    });

    return response.choices[0]?.message?.content ?? null;
  } catch {
    return null;
  }
}

router.get("/batches/:batchId/photos", requireAuth, async (req, res) => {
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

    const photos = await db.query.photosTable.findMany({
      where: eq(photosTable.batchId, batchId),
      orderBy: [desc(photosTable.takenAt)],
    });

    res.json(photos);
  } catch (err) {
    req.log.error({ err }, "Failed to list photos");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/batches/:batchId/photos", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const batchId = parseInt(String(req.params.batchId));
  const { objectPath, caption, dayNumber, takenAt, analyzeWithAi } = req.body;

  if (!objectPath) {
    res.status(400).json({ error: "objectPath is required" });
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

    // Set ACL ownership on the object so only this user can access it
    try {
      const objectFile = await storageService.getObjectEntityFile(objectPath);
      await setObjectAclPolicy(objectFile, {
        owner: userId,
        visibility: "private",
      });
    } catch (aclErr) {
      req.log.warn({ err: aclErr }, "Failed to set ACL on uploaded photo object");
    }

    // Optionally analyze with AI
    let aiAnalysis: string | null = null;
    if (analyzeWithAi) {
      aiAnalysis = await analyzePhoto(objectPath);
    }

    const [photo] = await db.insert(photosTable).values({
      batchId,
      objectPath,
      caption: caption ?? null,
      dayNumber: dayNumber ?? null,
      aiAnalysis,
      takenAt: takenAt ? new Date(takenAt) : new Date(),
    }).returning();

    res.status(201).json(photo);
  } catch (err) {
    req.log.error({ err }, "Failed to create photo");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/batches/:batchId/photos/:photoId", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const batchId = parseInt(String(req.params.batchId));
  const photoId = parseInt(String(req.params.photoId));

  try {
    const batch = await db.query.batchesTable.findFirst({
      where: and(eq(batchesTable.id, batchId), eq(batchesTable.userId, userId)),
    });

    if (!batch) {
      res.status(404).json({ error: "Batch not found" });
      return;
    }

    const photo = await db.query.photosTable.findFirst({
      where: and(eq(photosTable.id, photoId), eq(photosTable.batchId, batchId)),
    });

    if (!photo) {
      res.status(404).json({ error: "Photo not found" });
      return;
    }

    await db.delete(photosTable).where(and(eq(photosTable.id, photoId), eq(photosTable.batchId, batchId)));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete photo");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
