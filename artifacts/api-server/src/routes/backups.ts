import { Router } from "express";
import { requireAdmin } from "../middlewares/requireAdmin";
import { createBackup, listBackups, restoreBackup } from "../lib/backup";

const router = Router();

router.get("/backups", requireAdmin, async (req, res) => {
  try {
    const backups = await listBackups();
    res.json(backups);
  } catch (err) {
    req.log.error({ err }, "Failed to list backups");
    res.status(500).json({ error: "Failed to list backups" });
  }
});

router.post("/backups", requireAdmin, async (req, res) => {
  try {
    const backup = await createBackup();
    res.json(backup);
  } catch (err) {
    req.log.error({ err }, "Failed to create backup");
    res.status(500).json({ error: "Failed to create backup" });
  }
});

router.post("/backups/restore/:filename", requireAdmin, async (req, res) => {
  const { filename } = req.params;
  if (!filename || !filename.endsWith(".sql")) {
    res.status(400).json({ error: "Invalid filename" });
    return;
  }
  try {
    await restoreBackup(filename);
    res.json({ ok: true, message: "Restore complete" });
  } catch (err) {
    req.log.error({ err }, "Failed to restore backup");
    res.status(500).json({ error: "Failed to restore backup" });
  }
});

export default router;
