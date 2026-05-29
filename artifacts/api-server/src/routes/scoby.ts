import { Router } from "express";
import multer from "multer";
import { randomUUID } from "crypto";
import { db, scobyConditionsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { objectStorageClient } from "../lib/objectStorage";
import type { Request, Response, NextFunction } from "express";

const router = Router();

const PERSONA_ADMIN_SECRET = process.env.PERSONA_ADMIN_SECRET ?? "";
const INSECURE_DEFAULTS = new Set(["", "change-me-in-production", "changeme", "secret", "admin"]);

function requireAdminKey(req: Request, res: Response, next: NextFunction): void {
  const key = req.headers["x-admin-key"] as string | undefined;
  if (INSECURE_DEFAULTS.has(PERSONA_ADMIN_SECRET)) {
    res.status(503).json({ error: "Admin panel disabled: configure PERSONA_ADMIN_SECRET as a secure Replit Secret" });
    return;
  }
  if (!key || key !== PERSONA_ADMIN_SECRET) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if (file.mimetype === "image/jpeg" || file.mimetype === "image/png") {
      cb(null, true);
    } else {
      cb(new Error("Only JPG/PNG images are allowed"));
    }
  },
});

async function uploadImageToStorage(buffer: Buffer, contentType: string): Promise<string> {
  const privateObjectDir = process.env.PRIVATE_OBJECT_DIR;
  if (!privateObjectDir) {
    throw new Error("PRIVATE_OBJECT_DIR not set");
  }

  const objectId = randomUUID();
  const fullPath = `${privateObjectDir}/scoby/${objectId}`;

  const pathParts = fullPath.replace(/^\//, "").split("/");
  const bucketName = pathParts[0];
  const objectName = pathParts.slice(1).join("/");

  const bucket = objectStorageClient.bucket(bucketName);
  const file = bucket.file(objectName);

  await file.save(buffer, {
    contentType,
    resumable: false,
  });

  const entityId = `scoby/${objectId}`;
  return `/objects/${entityId}`;
}

router.get("/scoby/conditions", requireAdminKey, async (req, res) => {
  try {
    const conditions = await db.query.scobyConditionsTable.findMany({
      orderBy: [desc(scobyConditionsTable.createdAt)],
    });
    res.json(conditions);
  } catch (err) {
    req.log.error({ err }, "Failed to list scoby conditions");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post(
  "/scoby/conditions",
  requireAdminKey,
  upload.single("image"),
  async (req, res) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "Image file is required" });
        return;
      }

      const isOkRaw = req.body.is_ok;
      if (isOkRaw === undefined || isOkRaw === null || isOkRaw === "") {
        res.status(400).json({ error: "is_ok is required" });
        return;
      }
      const isOk = isOkRaw === "true" || isOkRaw === true;

      const whatToDo = req.body.what_to_do as string | undefined;
      if (!whatToDo || !whatToDo.trim()) {
        res.status(400).json({ error: "what_to_do is required" });
        return;
      }

      const okReason = isOk ? (req.body.ok_reason as string | undefined) ?? null : null;
      const notOkReason = !isOk ? (req.body.not_ok_reason as string | undefined) ?? null : null;

      const imageUrl = await uploadImageToStorage(req.file.buffer, req.file.mimetype);

      const [condition] = await db
        .insert(scobyConditionsTable)
        .values({
          imageUrl,
          isOk,
          okReason: okReason || null,
          notOkReason: notOkReason || null,
          whatToDo: whatToDo.trim(),
        })
        .returning();

      res.status(201).json(condition);
    } catch (err) {
      req.log.error({ err }, "Failed to create scoby condition");
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

router.delete("/scoby/conditions/:id", requireAdminKey, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  try {
    const deleted = await db
      .delete(scobyConditionsTable)
      .where(eq(scobyConditionsTable.id, id))
      .returning();

    if (deleted.length === 0) {
      res.status(404).json({ error: "Condition not found" });
      return;
    }

    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Failed to delete scoby condition");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/scoby/images/*path", async (req: Request, res: Response) => {
  const key = (req.headers["x-admin-key"] as string | undefined) || (req.query.k as string | undefined);
  if (INSECURE_DEFAULTS.has(PERSONA_ADMIN_SECRET) || !key || key !== PERSONA_ADMIN_SECRET) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const privateObjectDir = process.env.PRIVATE_OBJECT_DIR;
    if (!privateObjectDir) {
      res.status(500).json({ error: "Storage not configured" });
      return;
    }

    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;

    const fullPath = `${privateObjectDir}/scoby/${wildcardPath}`;
    const pathParts = fullPath.replace(/^\//, "").split("/");
    const bucketName = pathParts[0];
    const objectName = pathParts.slice(1).join("/");

    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectName);

    const [exists] = await file.exists();
    if (!exists) {
      res.status(404).json({ error: "Image not found" });
      return;
    }

    const [metadata] = await file.getMetadata();
    const contentType = (metadata.contentType as string) || "image/jpeg";

    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "private, max-age=3600");
    if (metadata.size) {
      res.setHeader("Content-Length", String(metadata.size));
    }

    const nodeStream = file.createReadStream();
    nodeStream.pipe(res);
  } catch (err) {
    req.log.error({ err }, "Failed to serve scoby image");
    res.status(500).json({ error: "Failed to serve image" });
  }
});

export default router;
