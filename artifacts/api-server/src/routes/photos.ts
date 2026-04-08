import { Router } from "express";
import { db } from "@workspace/db";
import { batchesTable, photosTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";
import { ObjectStorageService } from "../lib/objectStorage";
import { setObjectAclPolicy, getObjectAclPolicy } from "../lib/objectAcl";
import { openai } from "@workspace/integrations-openai-ai-server";
import {
  ListPhotosParams,
  CreatePhotoParams,
  CreatePhotoBody,
  DeletePhotoParams,
} from "@workspace/api-zod";

const router = Router({ mergeParams: true });
const storageService = new ObjectStorageService();

async function analyzePhotoForOwner(objectPath: string, userId: string): Promise<string | null> {
  try {
    const objectFile = await storageService.getObjectEntityFile(objectPath);

    // Verify ACL ownership before reading
    const aclPolicy = await getObjectAclPolicy(objectFile);
    if (!aclPolicy || aclPolicy.owner !== userId) {
      return null;
    }

    const downloadResponse = await storageService.downloadObject(objectFile);
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
  const paramsParsed = ListPhotosParams.safeParse({ batchId: Number(req.params.batchId) });
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
  const paramsParsed = CreatePhotoParams.safeParse({ batchId: Number(req.params.batchId) });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid batchId" });
    return;
  }
  const { batchId } = paramsParsed.data;

  const bodyParsed = CreatePhotoBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: "Invalid request body", details: bodyParsed.error.flatten() });
    return;
  }
  const { objectPath, caption, dayNumber, takenAt, analyzeWithAi } = bodyParsed.data;

  try {
    const batch = await db.query.batchesTable.findFirst({
      where: and(eq(batchesTable.id, batchId), eq(batchesTable.userId, userId)),
    });

    if (!batch) {
      res.status(404).json({ error: "Batch not found" });
      return;
    }

    // Only set ACL on freshly uploaded (un-owned) objects to prevent ownership hijacking
    try {
      const objectFile = await storageService.getObjectEntityFile(objectPath);
      const existingAcl = await getObjectAclPolicy(objectFile);
      if (!existingAcl) {
        // Fresh upload — claim ownership
        await setObjectAclPolicy(objectFile, {
          owner: userId,
          visibility: "private",
        });
      } else if (existingAcl.owner !== userId) {
        // Someone else owns this object — reject
        res.status(403).json({ error: "Forbidden: object does not belong to you" });
        return;
      }
    } catch (aclErr) {
      req.log.warn({ err: aclErr }, "Failed to verify/set ACL on uploaded photo object");
      res.status(400).json({ error: "Unable to verify object ownership" });
      return;
    }

    // Run AI analysis with ownership verification
    let aiAnalysis: string | null = null;
    if (analyzeWithAi) {
      aiAnalysis = await analyzePhotoForOwner(objectPath, userId);
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
  const paramsParsed = DeletePhotoParams.safeParse({
    batchId: Number(req.params.batchId),
    photoId: Number(req.params.photoId),
  });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid params" });
    return;
  }
  const { batchId, photoId } = paramsParsed.data;

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
